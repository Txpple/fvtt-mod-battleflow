// Live suite: THE THREE SURFACES NOTHING ELSE OPENS — the settings form, the activity usage
// dialog, and the measured-template CRUD seam. Every other suite passes `configure: false`, so
// these need a suite that reaches them on purpose.
//
// ⚠ Foundry 14 does NOT dispatch `createMeasuredTemplate`/`updateMeasuredTemplate`: a template
// create adds a Region and fires the Region hooks (tools/probe-surfaces.mjs). §3 pins that, so a
// platform that gives the names back FAILS here (ARCHITECTURE §10 D12).
//
//   node tools/smoke-surfaces.mjs [--list | --section N]
//
// ⚠ Disconnect the bridge. One suite at a time.
import { announcePlan, connectSuite, loadEnv, sectionPlan, sectionArg, finish }
  from "./harness.mjs";

const TAG = "smoke-surfaces";

// The machines this suite drives (tools/coverage-map.mjs parses this). ⚠ NEVER import a suite:
// it connects on evaluation.
export const COVERS = [
  "polish.js"               // §2 — the usage dialog's target block (renderActivityUsageDialog)
];

const SECTIONS = {
  1: "settings — the config form renders, the dividers land, and the interlock greys its dependents",
  2: "usage dialog — a real ActivityUsageDialog renders and carries the target block",
  3: "templates — the pinned platform fact: v14 dispatches Region hooks, never MeasuredTemplate"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);

const f = await connectSuite({ tag: TAG, watchdogMs: 300_000, requireElect: true, env: loadEnv() });
announcePlan(TAG, plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const results = [];
  const log = [];
  const skips = [];
  let fatal = null;
  const ok = (name, pass, detail = "") => results.push({ name, pass, detail });
  const has = n => {
    if (!sections) return true;
    if (sections.includes(String(n))) return true;
    skips.push(`section ${n}: ${titles[n] ?? ""} — not in this run`);
    return false;
  };
  const MODULE_ID = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // ⚠ Wait for what the next assertion reads, never a flat sleep.
  const until = async (fn, ms = 10_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
    return fn();
  };

  try {
    /* --- 1: the settings form ---------------------------------------------------------- */
    if (has(1)) {
      // ⚠ The hook FIRED is the first assertion; everything below depends on it.
      let fired = 0;
      const hid = Hooks.on("renderSettingsConfig", () => { fired++; });
      const sheet = game.settings.sheet;
      // The no-write guard, read BEFORE anything is touched: §1's DOM toggle must never reach the world.
      const before = {
        reactionHold: game.settings.get(MODULE_ID, "reactionHold"),
        autoDamage: game.settings.get(MODULE_ID, "autoDamage"),
        saves: game.settings.get(MODULE_ID, "saves")
      };
      try {
        await sheet.render(true);
        const el = await until(() => {
          const node = sheet.element instanceof HTMLElement ? sheet.element : sheet.element?.[0];
          return node?.querySelector(`[name="${MODULE_ID}.reactionHold"]`) ? node : null;
        });
        ok("renderSettingsConfig fires when the form opens", fired > 0,
          fired ? `${fired}×` : "NEVER DISPATCHED — the name is wrong");
        ok("the module's own pane is in the form", !!el,
          el ? "found by one of its controls" : "no control with the module prefix");
        if (!el) throw new Error("settings form never rendered a module control");

        // Nine `addDivider` headers, counted from the DOM rather than typed.
        const dividers = [...el.querySelectorAll("h4.bf-divider")].map(h => h.textContent.trim());
        ok("the section dividers are inserted into the form", dividers.length > 0,
          `${dividers.length}: ${dividers.join(" · ")}`);
        ok("every divider carries a label, none blank", dividers.every(d => d.length > 0),
          JSON.stringify(dividers));
        // ⚠ The form re-renders on tab changes: a second render must not double the dividers.
        const firstCount = dividers.length;
        await sheet.render(true);
        await sleep(600);
        const el2 = sheet.element instanceof HTMLElement ? sheet.element : sheet.element?.[0];
        const after = el2 ? el2.querySelectorAll("h4.bf-divider").length : -1;
        ok("a re-render does not double the dividers", after === firstCount,
          `first=${firstCount} second=${after}`);

        const node = el2 ?? el;
        const input = key => node.querySelector(`[name="${MODULE_ID}.${key}"]`);
        const hold = input("reactionHold");
        const DEPENDENTS = ["interruptList", "blockList", "holdReveal", "holdTimer",
          "holdSkipFutile", "holdSettle", "holdApplyEffect"];
        const disabledNow = () => DEPENDENTS.map(k => [k, !!input(k)?.disabled]);
        if (!hold) {
          skips.push("section 1: no reactionHold control in the DOM — interlock unexercised");
        } else if (hold.checked !== true) {
          // The reference table has the hold ON; a drifted world is reported, not asserted against.
          skips.push(`section 1: reactionHold is ${hold.checked} in this world, not the `
            + "reference true — interlock direction unexercised");
        } else {
          ok("with the hold ON, its dependents are live",
            disabledNow().every(([, d]) => !d), JSON.stringify(disabledNow()));
          // ⚠ DOM ONLY: `SettingsConfig` saves on its own submit; a `change` runs only `syncAll`.
          hold.checked = false;
          hold.dispatchEvent(new Event("change", { bubbles: true }));
          await sleep(300);
          ok("switching the hold OFF greys every one of its dependents",
            disabledNow().every(([, d]) => d), JSON.stringify(disabledNow()));
          hold.checked = true;
          hold.dispatchEvent(new Event("change", { bubbles: true }));
          await sleep(300);
          ok("…and switching it back restores them", disabledNow().every(([, d]) => !d),
            JSON.stringify(disabledNow()));
        }

        // ⚠ THE TWO-OWNER CONTROL: `playerRollDamage` serves attacks under the resolver AND save spells
        // under Saving Throws, so it stays live while EITHER is on.
        const prd = input("playerRollDamage");
        const auto = input("autoDamage");
        const saves = input("saves");
        if (prd && auto && saves) {
          const expect = (auto.value !== "off") || !!saves.checked;
          ok("playerRollDamage is live while EITHER owner is on (the two-owner rule)",
            prd.disabled === !expect,
            `autoDamage=${auto.value} saves=${saves.checked} disabled=${prd.disabled}`);
        } else skips.push("section 1: the two-owner controls are not all in the DOM");

        ok("the form was read, not written — no world setting moved",
          game.settings.get(MODULE_ID, "reactionHold") === before.reactionHold
          && game.settings.get(MODULE_ID, "autoDamage") === before.autoDamage
          && game.settings.get(MODULE_ID, "saves") === before.saves,
          JSON.stringify({ before, now: {
            reactionHold: game.settings.get(MODULE_ID, "reactionHold"),
            autoDamage: game.settings.get(MODULE_ID, "autoDamage"),
            saves: game.settings.get(MODULE_ID, "saves")
          } }));
      } finally {
        Hooks.off("renderSettingsConfig", hid);
        try { await sheet.close(); } catch { /* already closed */ }
      }
    }

    /* --- 2: the activity usage dialog --------------------------------------------------- */
    if (has(2)) {
      // ⚠ "BF Test Bard" carries slots but no levelled spell item: take the first candidate that can
      // actually open a dialog.
      const candidates = game.actors.filter(a => a.type === "character").map(a => ({
        actor: a,
        spell: a.items.find(i => i.type === "spell" && (i.system.level ?? 0) > 0
          && i.system.activities?.size)
      })).filter(c => c.spell);
      const pick = candidates.find(c => c.actor.name.startsWith("BF Test")) ?? candidates[0];
      if (!pick) {
        skips.push("section 2: no character carries a levelled spell with an activity — "
          + "renderActivityUsageDialog unexercised");
      } else {
        let fired = 0;
        const hid = Hooks.on("renderActivityUsageDialog", () => { fired++; });
        const msgsBefore = game.messages.size;
        let dialog = null;
        try {
          const activity = pick.spell.system.activities.contents[0];
          log.push(`section 2: ${pick.actor.name} → ${pick.spell.name} `
            + `(level ${pick.spell.system.level}, ${activity.type})`);
          // ⚠ NOT AWAITED: `use()` with a dialog settles only when answered, which would hang the suite.
          const pending = activity.use({}, { configure: true }, { create: false });
          pending?.catch?.(() => { /* closing the dialog is the expected end of this promise */ });
          dialog = await until(() => [...(foundry.applications?.instances?.values?.() ?? [])]
            .find(a => /ActivityUsageDialog/.test(a?.constructor?.name ?? "")));
          ok("renderActivityUsageDialog fires for a real spell usage dialog", fired > 0,
            fired ? `${fired}×` : "NEVER DISPATCHED — the name is wrong");
          ok("the dialog is the class polish.js names", !!dialog,
            dialog?.constructor?.name ?? "no ActivityUsageDialog instance");
          const del = dialog?.element instanceof HTMLElement ? dialog.element : dialog?.element?.[0];
          ok("the target block is painted into the usage dialog",
            !!del?.querySelector(".battleflow-target-block"),
            del ? `blocks=${del.querySelectorAll(".battleflow-target-block").length}` : "no element");
          // ⚠ This hook repaints on EVERY render and removes its stale copies first: one block, not two.
          ok("exactly one block, however many times it repaints",
            del ? del.querySelectorAll(".battleflow-target-block").length === 1 : false,
            `count=${del ? del.querySelectorAll(".battleflow-target-block").length : "n/a"}`);
        } finally {
          Hooks.off("renderActivityUsageDialog", hid);
          try { await dialog?.close?.(); } catch { /* already gone */ }
          await sleep(400);
        }
        // `create: false` and a closed dialog: the activity was never used.
        ok("opening and closing the dialog creates no chat message",
          game.messages.size === msgsBefore,
          `before=${msgsBefore} after=${game.messages.size}`);
      }
    }

    /* --- 3: the measured-template CRUD seam --------------------------------------------- */
    if (has(3)) {
      // ⚠ ASSERTS A NEGATIVE on purpose: `saves.js` registers handlers Foundry 14 never dispatches, and
      // template adoption rides the card's RENDER hook instead. The day the names dispatch again, this
      // fails and points at the decision.
      const scene = game.scenes.active ?? game.scenes.viewed ?? game.scenes.contents[0];
      if (!scene) {
        skips.push("section 3: no scene to place a template on");
      } else {
        const seen = { createMT: 0, updateMT: 0, createRegion: 0 };
        const ids = [
          ["createMeasuredTemplate", Hooks.on("createMeasuredTemplate", () => { seen.createMT++; })],
          ["updateMeasuredTemplate", Hooks.on("updateMeasuredTemplate", () => { seen.updateMT++; })],
          ["createRegion", Hooks.on("createRegion", () => { seen.createRegion++; })]
        ];
        let tpl = null;
        // `Scene#templates` is deprecated in Foundry 14: the shim's region wears `flags.core.MeasuredTemplate`.
        const drawn = () => scene.regions.filter(r => r.getFlag("core", "MeasuredTemplate")).length;
        try {
          const before = { templates: drawn(), regions: scene.regions.size };
          // Far from the fixture tokens: nothing here should touch containment.
          const made = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
            t: "circle", x: 100, y: 100, distance: 5
          }]);
          tpl = made?.[0] ?? null;
          await sleep(600);
          ok("a MeasuredTemplate really was created", !!tpl && drawn() === before.templates + 1,
            `templates ${before.templates}→${drawn()}`);
          // The positive half: something DID fire, so the zero above is a real absence.
          ok("…and Foundry 14 dispatches it as a REGION", seen.createRegion > 0
            && scene.regions.size === before.regions + 1,
            `createRegion=${seen.createRegion}× regions ${before.regions}→${scene.regions.size}`);
          ok("PIN: createMeasuredTemplate is still never dispatched", seen.createMT === 0,
            seen.createMT === 0 ? "0× — the pin holds"
              : `${seen.createMT}× — THE PIN IS STALE: the platform gives the name back. Delete `
                + "the NOT_DISPATCHED_HERE row in tools/hook-coverage.mjs and decide D12.");
          if (tpl) {
            await tpl.update({ distance: 10 });
            await sleep(600);
            ok("PIN: updateMeasuredTemplate is still never dispatched", seen.updateMT === 0,
              seen.updateMT === 0 ? "0× — the pin holds"
                : `${seen.updateMT}× — THE PIN IS STALE, see above`);
          }
          log.push(`section 3: ${JSON.stringify(seen)} on Foundry ${game.version}`);
        } finally {
          for (const [hook, id] of ids) Hooks.off(hook, id);
          // ⚠ A leftover template poisons smoke-saves §8 (it re-derives targets from standing areas).
          try { if (tpl) await (scene.regions.get(tpl.id) ?? tpl).delete(); } catch { /* already gone */ }
          await sleep(300);
          ok("the template is cleaned up — no area left standing for the next suite",
            !tpl || !scene.regions.get(tpl.id), `drawn templates=${drawn()}`);
        }
      }
    }
  } catch (err) {
    fatal = `${err?.message}\n${err?.stack ?? ""}`;
  }
  return { fatal, results, log, skips };
}, sectionArg(plan, SECTIONS));

// ⚠ `finish` calls `report` itself — calling both prints the whole body twice.
await finish({ tag: TAG, out, plan, f });
