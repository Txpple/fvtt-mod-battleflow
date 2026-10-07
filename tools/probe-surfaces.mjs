// Live forensic for three surfaces no suite reached by accident: the settings form, the activity
// usage dialog, and the measured-template CRUD hooks. Prints, asserts nothing.
//
// It prints EVERY hook name that fires around each action, so the delta names the real hook rather
// than confirming a guess — core hooks have no `check-hook-dispatch` equivalent.
//
// Run:  node tools/probe-surfaces.mjs
// ⚠ Disconnect the bridge; one suite at a time.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-surfaces";

const f = await connectSuite({ tag: TAG, watchdogMs: 240_000, requireElect: false, env: loadEnv() });

const out = await f.evaluate(async () => {
  const report = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* --- the recorder --------------------------------------------------------------------- */
  // Reads the harness's ledger rather than wrapping dispatch again (a second wrapper double-counts).
  const ledger = globalThis.__bfHookLedger ?? null;
  if (!ledger) return { fatal: "no __bfHookLedger in the page — the harness did not install it" };
  const snap = () => ({ ...ledger });
  // Every name whose count moved, with its delta.
  const delta = (before, after) => Object.fromEntries(
    Object.keys(after)
      .filter(k => (after[k] ?? 0) > (before[k] ?? 0))
      .map(k => [k, (after[k] ?? 0) - (before[k] ?? 0)])
  );

  const MOD = "fvtt-mod-battleflow";
  report.module = {
    active: !!game.modules.get(MOD)?.active,
    version: game.modules.get(MOD)?.version ?? null,
    foundry: game.version,
    system: `${game.system.id} ${game.system.version}`
  };

  /* --- 1: the measured-template CRUD hooks ---------------------------------------------- */
  // Does `createMeasuredTemplate` dispatch at all, and if not, what name DOES the create fire under?
  // ⚠ The test range only (fixture-suite), never the world's own active scene.
  const scene = game.scenes.getName("Battle Flow Test Range");
  report.templates = { scene: scene?.name ?? null };
  if (scene) {
    let tpl = null;
    try {
      const b1 = snap();
      const countsBefore = { templates: scene.templates.size, regions: scene.regions.size };
      const made = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
        t: "circle", x: 1000, y: 1000, distance: 5
      }]);
      tpl = made?.[0] ?? null;
      await sleep(400);
      report.templates.onCreate = delta(b1, snap());
      // ⚠ The collection counts answer whether v14 spawns a companion Region per template.
      report.templates.counts = {
        before: countsBefore,
        after: { templates: scene.templates.size, regions: scene.regions.size }
      };
      report.templates.created = !!tpl;
      // ⚠ The hook name derives from `documentName`, so print it rather than assume it.
      report.templates.documentName = tpl?.documentName ?? null;
      report.templates.className = tpl?.constructor?.name ?? null;
      report.templates.inScene = scene.templates.size;

      if (tpl) {
        const b2 = snap();
        await tpl.update({ distance: 10 });
        await sleep(400);
        report.templates.onUpdate = delta(b2, snap());

        const b3 = snap();
        await tpl.delete();
        await sleep(400);
        report.templates.onDelete = delta(b3, snap());
        tpl = null;
      }
    } catch (err) {
      report.templates.error = err.message;
    } finally {
      // ⚠ A leftover template would poison smoke-saves §8's containment arithmetic.
      try { if (tpl) await tpl.delete(); } catch { /* already gone */ }
    }
    // What the module registered, read from the live table rather than from the source.
    report.templates.listeners = {
      create: Hooks.events?.createMeasuredTemplate?.length ?? 0,
      update: Hooks.events?.updateMeasuredTemplate?.length ?? 0
    };
  }

  /* --- 2: the settings form -------------------------------------------------------------- */
  report.settings = {};
  try {
    const b = snap();
    const sheet = game.settings.sheet;
    await sheet.render(true);
    await sleep(1200);
    report.settings.fired = delta(b, snap());
    const el = sheet.element instanceof HTMLElement ? sheet.element : sheet.element?.[0];
    report.settings.rendered = !!el;
    if (el) {
      report.settings.dividers = el.querySelectorAll("h4.bf-divider").length;
      const input = key => el.querySelector(`[name="${MOD}.${key}"]`);
      const probe = key => {
        const node = input(key);
        return node ? { present: true, disabled: !!node.disabled } : { present: false };
      };
      report.settings.controls = {
        autoDamage: input("autoDamage")?.value ?? null,
        saves: input("saves")?.checked ?? null,
        reactionHold: input("reactionHold")?.checked ?? null,
        playerRollDamage: probe("playerRollDamage"),
        holdTimer: probe("holdTimer"),
        volleys: probe("volleys")
      };
      // ⚠ Some versions put only the ACTIVE settings pane in the DOM: report what is visible.
      report.settings.moduleTabPresent = !!el.querySelector(`[data-tab="${MOD}"], [data-category="${MOD}"]`);
    }
    await sheet.close();
  } catch (err) {
    report.settings.error = err.message;
  }

  /* --- 3: the activity usage dialog ------------------------------------------------------ */
  // Every suite passes `configure: false`, so: what does it take to make one appear?
  report.usage = {};
  try {
    const casters = game.actors.filter(a => a.type === "character"
      && a.items.some(i => i.type === "spell" && (i.system.level ?? 0) > 0));
    report.usage.casters = casters.map(a => a.name);
    // ⚠ "BF Test Bard" carries slots but no levelled spell item: take the first candidate that can
    // actually open a dialog.
    const pick = casters.map(a => ({
      actor: a,
      spell: a.items.find(i => i.type === "spell" && (i.system.level ?? 0) > 0
        && i.system.activities?.size)
    })).find(c => c.spell) ?? { actor: null, spell: null };
    const actor = pick.actor;
    report.usage.actor = actor?.name ?? null;
    if (actor) {
      const spell = pick.spell;
      report.usage.spell = spell?.name ?? null;
      report.usage.spellLevel = spell?.system?.level ?? null;
      report.usage.slots = Object.fromEntries(Object.entries(actor.system.spells ?? {})
        .filter(([, v]) => (v?.max ?? 0) > 0).map(([k, v]) => [k, `${v.value}/${v.max}`]));
      const activity = spell?.system.activities?.contents?.[0] ?? null;
      report.usage.activityType = activity?.type ?? null;
      if (activity) {
        const b = snap();
        // ⚠ NOT awaited: `use()` with a dialog settles only when answered.
        const pending = activity.use({}, { configure: true }, { create: false });
        pending?.catch?.(() => { /* cancelled below — that rejection is the expected end */ });
        await sleep(1500);
        report.usage.fired = delta(b, snap());
        const apps = Object.values(ui.windows ?? {}).concat(
          [...(foundry.applications?.instances?.values?.() ?? [])]);
        const dialog = apps.find(a => /ActivityUsageDialog|UsageDialog/.test(a?.constructor?.name ?? ""));
        report.usage.dialogClass = dialog?.constructor?.name ?? null;
        report.usage.openApps = apps.map(a => a?.constructor?.name).filter(Boolean);
        const del = dialog?.element instanceof HTMLElement ? dialog.element : dialog?.element?.[0];
        // polish.js's paint is the observable half.
        report.usage.targetBlockPainted = del ? !!del.querySelector(".battleflow-target-block") : null;
        report.usage.dialogHtmlHead = del ? (del.innerHTML ?? "").slice(0, 300) : null;
        try { await dialog?.close?.(); } catch { /* it may already be gone */ }
      }
    }
  } catch (err) {
    report.usage.error = err.message;
  }

  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
