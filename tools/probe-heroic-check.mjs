// Probe (2026-09-11): HEROIC INSPIRATION ON AN ABILITY CHECK, THE WAY A PLAYER ROLLS ONE.
//
// The user: "heroic inspiration fires on saves now, so we need to add it to ability checks".
// The machine has offered `heroic` on checks since v1 (`HEROIC.tests` carries "check";
// smoke-d20-folds §5 asserts a check stamps the offer) — but §5 rolls with the dialog SKIPPED
// (`configure: false`). A player rolls through the system's roll dialog, so this probe rolls an
// ability check AND a skill check with the dialog UP, presses its button, and reports whether
// the offer stamps and the rescue window carries the heroic row. Prints, asserts nothing.
//
//   node tools/probe-heroic-check.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-heroic-check";
const f = await connectSuite({ tag: TAG, watchdogMs: 180_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 10_000) => {
    const end = Date.now() + ms;
    while ( Date.now() < end ) { const v = await fn(); if ( v ) return v; await sleep(150); }
    return null;
  };
  const report = { module: game.modules.get(MOD)?.version, steps: [] };
  const fighter = game.actors.getName("BF Test Fighter");
  if ( !fighter ) return { fatal: "no BF Test Fighter — run tools/fixture-d20-folds.mjs" };
  const priorInspiration = fighter.system.attributes.inspiration;
  const priorTimer = game.settings.get(MOD, "holdTimer");
  const made = [];
  try {
    await fighter.update({ "system.attributes.inspiration": true });
    await game.settings.set(MOD, "holdTimer", 30);

    const roll = async (label, start) => {
      const priorDialogs = new Set([...document.querySelectorAll(".application")].map(el => el.id));
      const before = game.messages.size;
      // The DIALOG path — the promise resolves only after the dialog is answered.
      const pending = start();
      const dialog = await until(() => [...document.querySelectorAll(".application")]
        .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
          && !!el.querySelector('button[data-action="normal"]')), 8000);
      const step = { label, dialogOpened: !!dialog };
      dialog?.querySelector('button[data-action="normal"]')?.click();
      await pending.catch(() => null);
      const msg = await until(() => game.messages.contents.slice(before)
        .findLast(m => m.getFlag(MOD, "d20fold")), 8000);
      const flag = msg?.getFlag(MOD, "d20fold");
      step.stamped = !!flag;
      step.offers = (flag?.offers ?? []).map(o => o.kind);
      step.testKind = flag?.testKind ?? null;
      const win = await until(() => [...document.querySelectorAll(".application")]
        .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
          && !!el.querySelector('[data-bf-rescue-action="heroic"]')), 8000);
      step.rescueWindowWithHeroicRow = !!win;
      win?.querySelector('button[data-action="pass"]')?.click();
      await sleep(600);
      step.afterPass = msg?.getFlag(MOD, "d20fold")?.outcome ?? null;
      if ( msg ) made.push(msg);
      report.steps.push(step);
    };

    await roll("ability check (Strength) through the roll dialog", () => fighter.rollAbilityCheck({ ability: "str" }));
    await roll("skill check (Athletics) through the roll dialog", () => fighter.rollSkill({ skill: "ath" }));
  } finally {
    await game.settings.set(MOD, "holdTimer", priorTimer).catch(() => {});
    await fighter.update({ "system.attributes.inspiration": priorInspiration }).catch(() => {});
    for ( const m of made ) await m.delete().catch(() => {});
  }
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
