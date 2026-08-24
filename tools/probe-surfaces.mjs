// Live forensic for the THREE SURFACES the battery has never walked (D11's open triage lines):
// the settings form, the activity usage dialog, and the measured-template CRUD hooks.
// Prints, asserts nothing.
//
// ⚠ WHY A PROBE FIRST, AND NOT JUST A SUITE SECTION. One of the three is not a coverage gap at
// all until it is measured. `smoke-saves` §8 has counted `createMeasuredTemplate` fires around a
// real embedded create since 2026-08-16 and has always read ZERO, and saves.js routes around it
// through the card's render hook. Two things could produce that reading — the hook exists and
// something suppresses it, or THE NAME IS WRONG and the handler has been dead since the day it
// was written. Those want opposite fixes, and a suite section written against the wrong one
// would pass while proving nothing. **This is D10's failure class on the CORE side, where no
// `check-hook-dispatch` equivalent exists**: the dispatch gate reads dnd5e's bundle for
// `dnd5e.*` names and says nothing at all about core hooks.
//
// So this probe wraps dispatch and prints EVERY hook name that fires around each action. The
// delta is the answer — it names the real hook rather than confirming a guess.
//
// Run:  node tools/probe-surfaces.mjs
// ⚠ Read HANDOFF.md's operational rules first: disconnect the bridge, one suite at a time.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-surfaces";

const f = await connectSuite({ tag: TAG, watchdogMs: 240_000, requireElect: false, env: loadEnv() });

const out = await f.evaluate(async () => {
  const report = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* --- the recorder --------------------------------------------------------------------- */
  // The harness's ledger already wraps dispatch; this reads it rather than wrapping again, so
  // there is only ever one wrapper in the page (a second would double-count).
  const ledger = globalThis.__bfHookLedger ?? null;
  if (!ledger) return { fatal: "no __bfHookLedger in the page — the harness did not install it" };
  const snap = () => ({ ...ledger });
  // Every name whose count moved, with its delta. This is the whole instrument.
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
  // The question: does `createMeasuredTemplate` dispatch at all on this page, and if not, what
  // name DOES the create fire under?
  const scene = game.scenes.active ?? game.scenes.viewed ?? game.scenes.contents[0];
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
      // ⚠ THE RED HERRING TEST. Run 1 saw create/drawRegion fire around this create and no
      // createMeasuredTemplate at all. Either v14 spawns a companion Region per template, or
      // those Region hooks belong to something else on this scene. The collection counts
      // answer it without any reasoning about what v14 "should" do.
      report.templates.counts = {
        before: countsBefore,
        after: { templates: scene.templates.size, regions: scene.regions.size }
      };
      report.templates.created = !!tpl;
      // ⚠ The document-class names, printed rather than assumed — the hook name is derived
      // from `documentName`, so if that has moved the hook has moved with it.
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
      // ⚠ A leftover template on the active scene would poison smoke-saves §8's containment
      // arithmetic — it re-derives target sets from whatever areas are standing.
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
      // Did the handler's own marks land? Both are its visible output.
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
      // ⚠ The tab matters: ApplicationV2 settings render every package's pane, but only the
      // ACTIVE one is in the DOM in some versions. Report what we can see either way.
      report.settings.moduleTabPresent = !!el.querySelector(`[data-tab="${MOD}"], [data-category="${MOD}"]`);
    }
    await sheet.close();
  } catch (err) {
    report.settings.error = err.message;
  }

  /* --- 3: the activity usage dialog ------------------------------------------------------ */
  // Every suite passes `configure: false` precisely so no dialog renders, which is why this
  // hook has never fired. The question here is only: what does it take to make one appear?
  report.usage = {};
  try {
    const casters = game.actors.filter(a => a.type === "character"
      && a.items.some(i => i.type === "spell" && (i.system.level ?? 0) > 0));
    report.usage.casters = casters.map(a => a.name);
    // ⚠ Run 1 bet on "BF Test Bard" and it carries SLOTS but no levelled spell item, so the
    // probe reported nothing at all. Walk every candidate and take the first that can actually
    // open a dialog — the fixture that can drive this is a finding in itself.
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
        // ⚠ NOT awaited: `use()` with a dialog does not settle until the dialog is answered,
        // and nothing here is going to answer it. Fire it, look at the page, close it.
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
        // polish.js's paint is the observable half — does the target block exist in there?
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
