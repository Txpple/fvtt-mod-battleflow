// Live suite: THE THREE SURFACES NOTHING ELSE OPENS — the settings form, the activity usage
// dialog, and the measured-template CRUD seam.
//
// ⚠ WHY THIS SUITE EXISTS. D11's first coverage reading (2026-08-23) left five hook names on the
// never-fired list. Two closed the same day. These three stayed open for the same structural
// reason: **every other suite is built to avoid exactly the surfaces they live on.** Suites pass
// `configure: false` precisely so no dialog renders, and nothing anywhere opens the settings
// form. A path no suite can reach by accident needs a suite that reaches it on purpose.
//
// ⚠ AND ONE OF THE THREE TURNED OUT NOT TO BE A COVERAGE GAP AT ALL. `createMeasuredTemplate`
// and `updateMeasuredTemplate` are **not dispatched by Foundry 14 at all** — measured, not
// reasoned about (`tools/probe-surfaces.mjs`, 2026-08-24): a template create moves
// `scene.templates` 0→1 **and `scene.regions` 0→1**, and the hooks that fire are
// `preCreateRegion`/`createRegion`/`drawRegion`. §3 pins that measurement so a platform upgrade
// that gives the name back FAILS here and says so, instead of quietly restoring a fast-path
// nobody remembers asking for. See ARCHITECTURE §10 D12.
//
//   node tools/smoke-surfaces.mjs            all sections
//   node tools/smoke-surfaces.mjs --list     what the sections are
//   node tools/smoke-surfaces.mjs --section 2
//
// ⚠ Disconnect the bridge. One suite at a time.
import { announcePlan, connectSuite, loadEnv, sectionPlan, sectionArg, finish }
  from "./harness.mjs";

const TAG = "smoke-surfaces";

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
  // ⚠ Wait for WHAT THE NEXT ASSERTION READS, never a flat sleep (§11, "Adding a TEST" rule 3).
  const until = async (fn, ms = 10_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
    return fn();
  };

  try {
    /* --- 1: the settings form ---------------------------------------------------------- */
    if (has(1)) {
      // ⚠ THE HOOK ITSELF IS THE FIRST ASSERTION (§11 rule: a live suite asserts a hook FIRED,
      // never that it was registered). Everything below is only meaningful if it did.
      let fired = 0;
      const hid = Hooks.on("renderSettingsConfig", () => { fired++; });
      const sheet = game.settings.sheet;
      // The no-write guard, read BEFORE anything is touched. §1 toggles a checkbox in the DOM
      // to exercise the interlock, and the one thing that must not happen is that toggle
      // reaching the world. Asserted at the end of the section rather than hoped for.
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

        // The handler's visible output. Nine `addDivider` calls, nine headers — and the count
        // is read from the DOM rather than typed, so adding a tenth divider updates the
        // expectation by construction (the "never hand-carry a counted number" rule).
        const dividers = [...el.querySelectorAll("h4.bf-divider")].map(h => h.textContent.trim());
        ok("the section dividers are inserted into the form", dividers.length > 0,
          `${dividers.length}: ${dividers.join(" · ")}`);
        ok("every divider carries a label, none blank", dividers.every(d => d.length > 0),
          JSON.stringify(dividers));
        // ⚠ Idempotence is the real risk here: the form re-renders on tab changes and the
        // handler runs again each time. `addDivider` guards on the previous sibling, and this
        // is what proves the guard — a second render must not double them.
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
        // The hold's dependents, named by settings.js's own list.
        const DEPENDENTS = ["interruptList", "blockList", "holdReveal", "holdTimer",
          "holdSkipFutile", "holdSettle", "holdApplyEffect"];
        const disabledNow = () => DEPENDENTS.map(k => [k, !!input(k)?.disabled]);
        if (!hold) {
          skips.push("section 1: no reactionHold control in the DOM — interlock unexercised");
        } else if (hold.checked !== true) {
          // The reference table has the hold ON; if the world has drifted, say so rather than
          // asserting against a state this section did not set up.
          skips.push(`section 1: reactionHold is ${hold.checked} in this world, not the `
            + "reference true — interlock direction unexercised");
        } else {
          ok("with the hold ON, its dependents are live",
            disabledNow().every(([, d]) => !d), JSON.stringify(disabledNow()));
          // ⚠ DOM ONLY. `SettingsConfig` saves on its own submit button; a `change` event runs
          // the module's `syncAll` listener and nothing else. The world read at the end of the
          // section is what proves that claim rather than assuming it.
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

        // ⚠ THE TWO-OWNER CONTROL, which is the one piece of this interlock with a comment
        // explaining why it is not the obvious rule: `playerRollDamage` fires for attacks under
        // the resolver AND for save spells under Saving Throws, so it stays live while EITHER
        // is on. Asserted here because "greyed out and still fires" is the failure it was
        // written against.
        const prd = input("playerRollDamage");
        const auto = input("autoDamage");
        const saves = input("saves");
        if (prd && auto && saves) {
          const expect = (auto.value !== "off") || !!saves.checked;
          ok("playerRollDamage is live while EITHER owner is on (the two-owner rule)",
            prd.disabled === !expect,
            `autoDamage=${auto.value} saves=${saves.checked} disabled=${prd.disabled}`);
        } else skips.push("section 1: the two-owner controls are not all in the DOM");

        // The guard fires last, and it is an ASSERTION.
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
      // ⚠ The fixture that can drive this is a finding in its own right: "BF Test Bard" carries
      // SLOTS but no levelled spell ITEM, so the obvious pick renders nothing. Walk the
      // candidates and take the first that can actually open a dialog.
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
          // ⚠ NOT AWAITED, on purpose. `use()` with a dialog does not settle until the dialog is
          // answered, and nothing here is going to answer it — awaiting would hang the suite
          // until the watchdog killed it. Fire it, read the page, close the dialog.
          const pending = activity.use({}, { configure: true }, { create: false });
          pending?.catch?.(() => { /* closing the dialog is the expected end of this promise */ });
          dialog = await until(() => [...(foundry.applications?.instances?.values?.() ?? [])]
            .find(a => /ActivityUsageDialog/.test(a?.constructor?.name ?? "")));
          ok("renderActivityUsageDialog fires for a real spell usage dialog", fired > 0,
            fired ? `${fired}×` : "NEVER DISPATCHED — the name is wrong");
          ok("the dialog is the class polish.js names", !!dialog,
            dialog?.constructor?.name ?? "no ActivityUsageDialog instance");
          const del = dialog?.element instanceof HTMLElement ? dialog.element : dialog?.element?.[0];
          // The handler's whole job: paint the target block into the dialog. polish.js's
          // comment says this was VERIFIED by hand in 2026-08-19 and never since — this is the
          // assertion that replaces the hand check.
          ok("the target block is painted into the usage dialog",
            !!del?.querySelector(".battleflow-target-block"),
            del ? `blocks=${del.querySelectorAll(".battleflow-target-block").length}` : "no element");
          // ⚠ Same idempotence risk as the dividers: this hook repaints on EVERY render by
          // design, and the paint removes its own stale copies first. One block, not two.
          ok("exactly one block, however many times it repaints",
            del ? del.querySelectorAll(".battleflow-target-block").length === 1 : false,
            `count=${del ? del.querySelectorAll(".battleflow-target-block").length : "n/a"}`);
        } finally {
          Hooks.off("renderActivityUsageDialog", hid);
          try { await dialog?.close?.(); } catch { /* already gone */ }
          await sleep(400);
        }
        // Opening a dialog must not spend or announce anything — `create: false` and a closed
        // dialog together mean the activity was never actually used.
        ok("opening and closing the dialog creates no chat message",
          game.messages.size === msgsBefore,
          `before=${msgsBefore} after=${game.messages.size}`);
      }
    }

    /* --- 3: the measured-template CRUD seam --------------------------------------------- */
    if (has(3)) {
      // ⚠ THIS SECTION ASSERTS A NEGATIVE, WHICH IS NORMALLY THE WRONG SHAPE — and here it is
      // the point. `saves.js` registers two handlers on hooks Foundry 14 never dispatches, and
      // the module has been fine anyway because the CRUD path is a fast-path over the card's
      // RENDER hook, which is the reliability floor that actually carries template adoption
      // (smoke-saves §8, table-proven on Shatter and Moonbeam).
      //
      // Pinning the measurement is what makes the fact self-expiring: the day a platform
      // upgrade dispatches the name again, THIS FAILS and points at the decision, instead of a
      // dead fast-path quietly coming back to life under a feature nobody re-tested.
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
        try {
          const before = { templates: scene.templates.size, regions: scene.regions.size };
          // Far from the fixture tokens on purpose — nothing here should touch containment.
          const made = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
            t: "circle", x: 100, y: 100, distance: 5
          }]);
          tpl = made?.[0] ?? null;
          await sleep(600);
          ok("a MeasuredTemplate really was created", !!tpl && scene.templates.size === before.templates + 1,
            `templates ${before.templates}→${scene.templates.size}`);
          // The positive half — something DID fire, so a zero above is a real absence and not
          // a broken listener or a create that never happened.
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
          // ⚠ A leftover template on the active scene poisons smoke-saves §8, which re-derives
          // its target sets from whatever areas are standing. Deleted in a `finally` for the
          // same reason smoke-hold §7 deletes its combat.
          try { if (tpl) await tpl.delete(); } catch { /* already gone */ }
          await sleep(300);
          ok("the template is cleaned up — no area left standing for the next suite",
            !tpl || !scene.templates.get(tpl.id), `templates=${scene.templates.size}`);
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
