// Live suite: the D20 FOLDS (v1.23.0) — Heroic Inspiration, Tactical Mind, a Bardic die.
//
// ⚠ WHAT THIS SUITE IS FOR, AND WHAT IT DELIBERATELY IS NOT. The fold ARITHMETIC is unit-tested
// (tests/decide-verdict.test.js, no Foundry, 270ms) and the tier rule says an assertion that can
// be decided from plain objects does not belong in a live suite. What can only be decided here
// is the half that touches real documents: does the flag STAMP on a real missed attack, does the
// SPEND actually take the resource away, and does the die that gets rolled come from the right
// actor's content. Those are the three things that were wrong in the scoping and could only be
// found by measuring.
//
//   node tools/smoke-d20-folds.mjs            all sections
//   node tools/smoke-d20-folds.mjs --list     what the sections are
//   node tools/smoke-d20-folds.mjs --section 2
//
// ⚠ Needs the fixtures: node tools/fixture-d20-folds.mjs (idempotent). Disconnect the bridge.
import { announcePlan, connectSuite, loadEnv, sectionPlan, sectionArg, finish }
  from "./harness.mjs";

const TAG = "smoke-d20-folds";

const SECTIONS = {
  1: "content — the three markers resolve, and the bardic die comes from the BARD",
  2: "spend — each kind actually takes its resource away",
  3: "attack — a forced miss stamps, the reroll REPLACES, the verdict flips, damage drives",
  4: "hooks — every hook the module registers for a d20 fold ACTUALLY FIRES",
  5: "offer — a real roll stamps a flag offering EVERY eligible fold, kind-matched"
};
const DEPENDS = { 2: [1], 3: [1], 5: [1] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);

const f = await connectSuite({ tag: TAG, watchdogMs: 600_000, requireElect: true, env: loadEnv() });
announcePlan(TAG, plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const results = [];
  const log = [];
  const skips = [];
  let fatal = null;
  const ok = (name, pass, detail = "") => results.push({ name, pass, detail });
  // The three-line predicate the closure has to spell itself — it cannot import `want()`, so
  // the plan travels as DATA (harness.mjs, sectionArg). A null plan means "run everything".
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
  const dialogsWith = text => [...document.querySelectorAll(".application")]
    .filter(el => (el.innerHTML ?? "").includes(text));

  try {
    const fighter = game.actors.getName("BF Test Fighter");
    const bard = game.actors.getName("BF Test Bard");
    if (!fighter || !bard) {
      fatal = "fixtures missing — run tools/fixture-d20-folds.mjs first";
      return { fatal, results, log, skips };
    }

    /* --- 1: content ------------------------------------------------------------------- */
    if (has(1)) {
      const entries = game.modules.get(MODULE_ID)?.api?.registries?.d20Folds?.() ?? [];
      ok("all three kinds are listed and live",
        entries.length === 3 && entries.every(e => ["heroic", "tactical", "bardic"].includes(e.kind)),
        JSON.stringify(entries));

      ok("heroic marker is a boolean on the sheet",
        fighter.system.attributes.inspiration === true,
        `inspiration=${fighter.system.attributes.inspiration}`);

      const tm = fighter.items.find(i => i.name === "Tactical Mind");
      const sw = fighter.items.find(i => i.name === "Second Wind");
      const act = tm?.system.activities?.contents?.[0];
      const target = act?.consumption?.targets?.[0]?.target;
      // ⚠ The silent-death case: the stored target is a COMPENDIUM UUID and only dnd5e's
      // prepareData remap makes it findable. If this ever fails, Tactical Mind offers nothing
      // forever with no error — so it is asserted rather than assumed.
      ok("tactical's consumption target is remapped to the actor's own Second Wind",
        !!target && (target === sw?.id) && !!fighter.items.get(target),
        `target=${target} secondWind=${sw?.id}`);
      ok("tactical's die is read from the content, not typed",
        act?.roll?.formula === "1d10", `formula=${act?.roll?.formula}`);

      const eff = fighter.effects.find(e => e.name === "Inspired" && !e.disabled);
      ok("bardic marker is an effect, not an item", !!eff && !fighter.items.find(i => i.name === "Inspired"),
        `effect=${!!eff}`);
      const originItem = eff?.origin ? await fromUuid(eff.origin) : null;
      ok("the effect leads back to the granting bard", originItem?.actor?.name === "BF Test Bard",
        `origin=${eff?.origin} → ${originItem?.actor?.name}`);

      // ⚠ THE CROSS-ACTOR TRAP, asserted in both directions. Against the bard the token is a
      // real die; against the RECIPIENT it collapses to literal 0 with no error at all.
      const bardRoll = new Roll("@scale.bard.inspiration", bard.getRollData());
      await bardRoll.evaluate();
      const recipientRoll = new Roll("@scale.bard.inspiration", fighter.getRollData());
      await recipientRoll.evaluate();
      ok("the bardic token resolves to a real die against the BARD",
        bardRoll.formula === "1d8", `bard formula=${bardRoll.formula}`);
      ok("…and silently collapses to ZERO against the recipient — why it must be resolved bard-side",
        recipientRoll.formula === "0" && recipientRoll.total === 0,
        `recipient formula=${recipientRoll.formula} total=${recipientRoll.total}`);
    }

    /* --- 2: spend --------------------------------------------------------------------- */
    if (has(2)) {
      // heroic — the write
      await fighter.update({ "system.attributes.inspiration": true });
      await fighter.update({ "system.attributes.inspiration": false });
      ok("heroic spends by writing the boolean false",
        fighter.system.attributes.inspiration === false,
        `inspiration=${fighter.system.attributes.inspiration}`);
      await fighter.update({ "system.attributes.inspiration": true });   // restore the fixture

      // tactical — the activity use()
      const sw = fighter.items.find(i => i.name === "Second Wind");
      const before = sw.system.uses.value;
      const tm = fighter.items.find(i => i.name === "Tactical Mind");
      const act = tm.system.activities.contents[0];
      await act.use({ subsequentActions: false }, { configure: false }, { create: false });
      await sleep(400);
      const after = fighter.items.get(sw.id).system.uses.value;
      ok("tactical spends a use of Second Wind through the system's own consumption",
        after === before - 1, `uses ${before} → ${after}`);

      // bardic — the delete
      const eff = fighter.effects.find(e => e.name === "Inspired");
      const effId = eff?.id;
      await eff.delete();
      await sleep(300);
      ok("bardic spends by deleting the effect", !fighter.effects.get(effId), `deleted ${effId}`);
      log.push("⚠ section 2 CONSUMES the fixtures — re-run tools/fixture-d20-folds.mjs after it");
    }

    /* --- 3: the attack path ------------------------------------------------------------ */
    if (has(3)) {
      // ⚠ THIS SECTION WAS A NAMED GAP FOR A DAY, and the reason is worth keeping: the attack
      // path was table-verified by a human (user, 2026-08-23 — spend → reroll → re-verdict →
      // damage re-drive) and UNREACHABLE from here, because the fixture fighter had no weapon.
      // "Verified but not covered" is exactly the state the offer half was in when it shipped
      // four dead paths past a green suite, so the fixture grants a PHB Longsword now and this
      // section drives the whole chain.
      const scene = game.scenes.active;
      const foeToken = scene?.tokens?.find(t => t.actor && (t.actor.type === "npc"));
      const placed = foeToken ? canvas.tokens.get(foeToken.id) : null;
      const sword = fighter.items.find(i => i.name === "Longsword");
      const act = sword?.system.activities?.find(a => a.type === "attack");
      if (!placed || !act) {
        skips.push("section 3: needs an NPC token on the active scene and the fighter's "
          + `Longsword (token=${!!placed} weapon=${!!act}) — run tools/fixture-d20-folds.mjs`);
      } else {
        const foe = foeToken.actor;
        ok("an NPC target is available to attack", true, foe.name);

        /* ⚠ THE DICE ARE FORCED, AND THAT IS WHAT MAKES THIS AN ASSERTION RATHER THAN A RETRY
         * LOOP. Every other fold suite in this tree rolls until it happens to miss
         * (`missUntilStamped`), which works for a STAMP but cannot test an OUTCOME: whether a
         * reroll turns the miss into a hit is the whole feature, and it is not observable while
         * the reroll is random. Foundry routes every die through `CONFIG.Dice.randomUniform`
         * and `Die#mapRandomFace(u) = ceil((1 - u) * faces)`, so a face is chosen by inverting
         * it — the midpoint of the band that maps to `n`.
         *
         * ⚠ 5 then 19, never 1 or 20. A natural 20 is a crit and a natural 1 a fumble; both take
         * a different path through the verdict and neither is the case under test.
         *
         * ⚠ RESTORED IN `finally`. A suite that left the world's PRNG stubbed would make every
         * later section deterministic without saying so — a silent instrument failure of exactly
         * the kind §4 exists to catch. */
        const realPRNG = CONFIG.Dice.randomUniform;
        const face = (n, faces = 20) => {
          CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);
        };
        const priorAC = {
          calc: foe.system._source.attributes.ac.calc ?? "default",
          flat: foe.system._source.attributes.ac.flat ?? null
        };
        const priorHP = foe.system.attributes.hp.value;
        const priorInspiration = fighter.system.attributes.inspiration;
        let attackMsg = null;
        try {
          // AC 18: a forced 5 (+5 to hit) totals 10 and misses; a forced 19 totals 24 and hits.
          // The band is stated here so the two numbers below are not magic.
          await foe.update({
            "system.attributes.ac.calc": "flat", "system.attributes.ac.flat": 18,
            "system.attributes.hp.value": foe.system.attributes.hp.max
          });
          if (!fighter.system.attributes.inspiration) {
            await fighter.update({ "system.attributes.inspiration": true });
          }

          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          placed.setTarget(true, { releaseOthers: true });
          await sleep(200);

          face(5);
          const use = await act.use({ subsequentActions: false }, { configure: false }, {});
          const usageId = use?.message?.id ?? null;
          const rolls = await act.rollAttack({ advantage: false, disadvantage: false },
            { configure: false },
            usageId ? { data: { "flags.dnd5e.originatingMessage": usageId } } : {});
          attackMsg = rolls?.[0]?.parent ?? null;
          const flag = await until(() => attackMsg?.getFlag(MODULE_ID, "d20fold"), 8000);

          ok("a clean miss stamps a pending attack fold, with the target it missed",
            !!flag && (flag.status === "pending") && (flag.testKind === "attack")
              && (flag.targets?.length === 1),
            JSON.stringify({ status: flag?.status, testKind: flag?.testKind,
              base: flag?.baseTotal, targets: flag?.targets?.length }));

          const kinds = (flag?.offers ?? []).map(o => o.kind);
          ok("the attack offers heroic and NEVER tactical — Tactical Mind is checks-only",
            kinds.includes("heroic") && !kinds.includes("tactical"),
            `offers=[${kinds.join(", ")}]`);

          const popup = await until(() => dialogsWith("Patch this roll")[0], 8000);
          ok("the offer pops, carrying the spend and the pass",
            !!popup?.querySelector('button[data-action="heroic"]')
              && !!popup?.querySelector('button[data-action="pass"]'),
            `popup=${!!popup}`);

          // The reroll: forced to 19, so 24 clears AC 18 and the verdict MUST flip.
          face(19);
          popup?.querySelector('button[data-action="heroic"]')?.click();
          const done = await until(() => {
            const cur = attackMsg?.getFlag(MODULE_ID, "d20fold");
            return (cur?.status === "resolved") ? cur : null;
          }, 20_000);

          ok("the spend is recorded on the flag, with the reroll that replaced the d20",
            !!done && (done.spends?.length === 1) && (done.spends[0].kind === "heroic")
              && Number.isFinite(done.spends?.[0]?.reroll?.total),
            JSON.stringify(done?.spends ?? null));

          // ⚠ The resource is really gone — the "recorded a spend that did not happen" class.
          ok("Heroic Inspiration is really spent, not just announced",
            fighter.system.attributes.inspiration === false,
            `inspiration=${fighter.system.attributes.inspiration}`);

          // ⚠ REPLACE, NOT ADD — and forcing the faces is what lets this be exact rather than
          // a plausibility check. Both rolls carry the same modifier, so a REPLACE lands on
          // `base + 14` (19 − 5) and equals the reroll's own total; an ADD would land on
          // `base + reroll` (~29 here). A reroll modelled as an `add` would read as a lucky
          // player and hit against a number nobody rolled.
          ok("the reroll REPLACES the d20 rather than adding to it",
            !!done && (done.foldedTotal === done.spends[0].reroll.total)
              && (done.foldedTotal === done.baseTotal + 14),
            `base=${done?.baseTotal} folded=${done?.foldedTotal} `
            + `reroll=${done?.spends?.[0]?.reroll?.total} (add would be `
            + `${(done?.baseTotal ?? 0) + (done?.spends?.[0]?.reroll?.total ?? 0)})`);

          ok("the composed total re-verdicts the target from MISS to HIT",
            !!done && (done.targets?.[0]?.verdict === "hit") && (done.foldedTotal >= 18),
            `folded=${done?.foldedTotal} vs AC ${done?.targets?.[0]?.ac} `
            + `verdict=${done?.targets?.[0]?.verdict}`);

          // ⚠ The last link, and the one the table cares about: a fold that turns a miss into a
          // hit must DRIVE THE DAMAGE, not merely say so. Which of the two shapes is correct
          // depends on a setting, so it is read rather than assumed.
          const playerRolls = game.settings.get(MODULE_ID, "playerRollDamage");
          if (playerRolls) {
            const bar = await until(() => attackMsg?.getFlag(MODULE_ID, "damageOffer"), 12_000);
            ok("…and the damage OFFER is raised (playerRollDamage is on)", !!bar,
              bar ? "offered" : "no damage offer");
          } else {
            const dmg = await until(() => game.messages.contents.findLast(m =>
              (m.getFlag("dnd5e", "roll.type") === "damage")
              && (m.speaker?.actor === fighter.id)
              && (m.timestamp >= (attackMsg?.timestamp ?? 0))), 15_000);
            ok("…and the damage re-drives itself on the new verdict", !!dmg,
              dmg ? `damage ${dmg.rolls?.[0]?.total}` : "NO DAMAGE ROLLED after the fold hit");
          }
          log.push(`section 3: ${foe.name} AC 18 · base ${done?.baseTotal} → `
            + `folded ${done?.foldedTotal} · ${done?.targets?.[0]?.verdict}`);
        } finally {
          // ⚠ Restore in this order and unconditionally: the PRNG first (everything after it
          // rolls dice), then the world. §5 needs Heroic Inspiration back — it asserts that a
          // check offers more than one kind, and this section just spent one of them.
          CONFIG.Dice.randomUniform = realPRNG;
          await foe.update({
            "system.attributes.ac.calc": priorAC.calc, "system.attributes.ac.flat": priorAC.flat,
            "system.attributes.hp.value": priorHP
          }).catch(() => {});
          await fighter.update({ "system.attributes.inspiration": priorInspiration })
            .catch(() => {});
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        }
      }
    }

    /* --- 4: THE HOOKS ACTUALLY FIRE ---------------------------------------------------- */
    if (has(4)) {
      // ⚠ THIS SECTION EXISTS BECAUSE ITS ABSENCE COST A TABLE SESSION. v1 registered
      // `dnd5e.rollAbilityCheckV2` and `dnd5e.rollToolV2`. NEITHER HOOK EXISTS — dnd5e's
      // `#rollD20Test` serves ability checks AND saving throws and fires only the non-V2 name,
      // while `#rollSkillTool` fires a V2 pair and calls the tool one `rollToolCheck`. A hook
      // name that is never dispatched registers cleanly, costs nothing, and does nothing,
      // forever. Registration proves NOTHING; only dispatch does.
      const WANT = [
        ["dnd5e.rollAttackV2", "attack"],
        ["dnd5e.rollAbilityCheck", "check"],
        ["dnd5e.rollSkill", "skill"],
        ["dnd5e.rollToolCheck", "tool"],
        ["dnd5e.rollSavingThrow", "save"]
      ];
      const seen = new Set();
      const ids = WANT.map(([h]) => [h, Hooks.on(h, () => seen.add(h))]);
      try {
        // `create: false` — no chat spam; the hooks fire regardless of message creation.
        const quiet = [{ configure: false }, { create: false }];
        await fighter.rollAbilityCheck({ ability: "str" }, ...quiet);
        await fighter.rollSkill({ skill: "ath" }, ...quiet);
        await fighter.rollSavingThrow({ ability: "dex" }, ...quiet);
        const tool = fighter.items.find(i => i.type === "tool");
        if (tool) await fighter.rollToolCheck({ tool: tool.system.type?.baseItem }, ...quiet);
        else skips.push("section 4: no tool on the fixture — dnd5e.rollToolCheck unexercised");

        for (const [hook, label] of WANT) {
          if (hook === "dnd5e.rollAttackV2") continue;               // §3's business
          if ((hook === "dnd5e.rollToolCheck") && !tool) continue;
          ok(`${hook} fires (${label})`, seen.has(hook),
            seen.has(hook) ? "dispatched" : "NEVER DISPATCHED — the name is wrong");
        }
      } finally {
        for (const [hook, id] of ids) Hooks.off(hook, id);
      }
    }

    /* --- 5: the offer is stamped, complete, and kind-matched ---------------------------- */
    if (has(5)) {
      // ⚠ Asserts the OFFER LIST, not just that something was stamped. v1 offered only the
      // first eligible fold, so `heroic` — first in the shipped list — hid Tactical Mind and
      // Bardic completely: three separate table reports, one cause.
      const before = game.messages.size;
      await fighter.rollAbilityCheck({ ability: "str" }, { configure: false }, { create: true });
      await sleep(600);
      const msg = game.messages.contents.slice(before).findLast(m => m.getFlag(MODULE_ID, "d20fold"));
      const flag = msg?.getFlag(MODULE_ID, "d20fold");
      ok("an ability check stamps a d20 fold offer", !!flag, flag ? "stamped" : "NO FLAG");
      if (flag) {
        const kinds = (flag.offers ?? []).map(o => o.kind).sort();
        // The fixture carries all three markers. On a CHECK all three are legal.
        ok("every eligible fold is offered, not just the first",
          kinds.length >= 2, `offers=[${kinds.join(", ")}]`);
        ok("the offer carries no spends until one is answered",
          (flag.spends ?? []).length === 0, `spends=${(flag.spends ?? []).length}`);
        // ⚠ A check offer DOES run a clock (user ruling): it pops like every other moment, and
        // law 11 says a moment that pops must have something that resolves it. Expiry passes
        // and spends nothing. `holdTimer: 0` remains the wait-forever escape hatch.
        const window = game.settings.get(MODULE_ID, "holdTimer");
        ok("a check offer runs the house clock, so its popup cannot go stale",
          window ? Number.isFinite(flag.deadline) : !flag.deadline,
          `holdTimer=${window} deadline=${flag.deadline ?? "none"}`);
        log.push(`section 5 offers on a check: ${JSON.stringify(flag.offers)}`);
      }
      if (msg) await msg.delete();

      // ⚠ Kind-matching: Tactical Mind is ability-check-only by its own rules text, so it must
      // NOT appear on an attack or a save. v1 had no such matching at all.
      const before2 = game.messages.size;
      await fighter.rollSavingThrow({ ability: "dex" }, { configure: false }, { create: true });
      await sleep(600);
      const sMsg = game.messages.contents.slice(before2).findLast(m => m.getFlag(MODULE_ID, "d20fold"));
      const sFlag = sMsg?.getFlag(MODULE_ID, "d20fold");
      ok("a native save stamps an offer too", !!sFlag, sFlag ? "stamped" : "NO FLAG");
      if (sFlag) {
        const kinds = (sFlag.offers ?? []).map(o => o.kind);
        ok("Tactical Mind is NOT offered on a save — checks only, by its own text",
          !kinds.includes("tactical"), `offers=[${kinds.join(", ")}]`);
      }
      if (sMsg) await sMsg.delete();
    }
  } catch (err) {
    fatal = `${err?.message}\n${err?.stack ?? ""}`;
  }
  return { fatal, results, log, skips };
}, sectionArg(plan, SECTIONS));

// ⚠ `finish` calls `report` itself — calling both prints the whole body twice, which is
// exactly the output drift the one-reporter rule exists to prevent.
await finish({ tag: TAG, out, plan, f });
