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
  5: "offer — a real roll stamps a flag offering EVERY eligible fold, kind-matched",
  6: "TWO RESCUES, ONE ROLL — precision must compose with a fold already spent"
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

    /* --- 6: TWO RESCUES, ONE ROLL ------------------------------------------------------ */
    if (has(6)) {
      // ⚠ WHAT THIS SECTION IS FOR. A Battle Master holding a Bardic die who misses is stamped
      // TWICE on ONE attack message — `precision` by maneuvers.js and `d20fold` by d20-folds.js
      // — and only one of the two machines composes. `resolveFold` walks the whole registry
      // (the D8 ruling); `resolvePrecision` still adds its die to `flag.attackTotal`, the number
      // the d20 rolled before anything was spent. The consequences were named by READING the
      // code on 2026-08-23 and a later session was right to drop them as unexecuted. This
      // section is the answer to that objection: it drives the exact ordering and asserts what
      // the TABLE would see — the sentence on the card, and whether the damage arrives.
      //
      // ⚠ THE BAND, so the three forced faces are not magic. Attack +5 against AC 18:
      //     d20 5        → 10             misses by 8    → BOTH flags stamp
      //     + bardic 3   → 13             still misses   → precision stays pending and offers
      //     + precision 6
      //          composed   10 + 3 + 6 = 19  ≥ 18 → HIT   ← what hitTargets, walking the
      //                                                      registry, already answers
      //          un-composed     10 + 6 = 16  < 18 → MISS  ← what precision's own card says
      //   16 and 19 STRADDLE the AC, and no other pair of numbers can tell the two arithmetics
      //   apart: any band where both land the same side proves nothing.
      //
      // ⚠ ORDER MATTERS AND ONLY ONE ORDER IS BROKEN. Fold-side first (this one) is wrong;
      // precision-side first is fine, because the fold machine composes over precision's flag.
      // A suite that spent them the other way round would go green over a live bug.
      const scene = game.scenes.active;
      const foeToken = scene?.tokens?.find(t => t.actor && (t.actor.type === "npc"));
      const placed = foeToken ? canvas.tokens.get(foeToken.id) : null;
      const sword = fighter.items.find(i => i.name === "Longsword");
      const act = sword?.system.activities?.find(a => a.type === "attack");
      const maneuver = fighter.items.find(i => i.name === "Precision Attack");
      const superiority = fighter.items.find(i => i.name === "Combat Superiority");
      if (!placed || !act || !maneuver || !superiority) {
        skips.push("section 6: needs an NPC token, the Longsword, and the Battle Master kit "
          + `(token=${!!placed} weapon=${!!act} maneuver=${!!maneuver} pool=${!!superiority})`
          + " — run tools/fixture-d20-folds.mjs");
      } else {
        const foe = foeToken.actor;
        const realPRNG = CONFIG.Dice.randomUniform;
        // The §3 technique, and the same warning: force the face by inverting
        // `mapRandomFace(u) = ceil((1 - u) * faces)`, never 1 or 20, restore in `finally`.
        // ⚠ `faces` IS AN ARGUMENT HERE, unlike §3, because this section forces THREE dice of
        // TWO sizes. A d8 rolled under a d20's stub lands on 2 rather than the number asked
        // for — the stub is a uniform, not a face, and it only means a face against the die
        // it was computed for. Re-force immediately before each roll.
        const face = (n, faces) => {
          CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);
        };
        const priorAC = {
          calc: foe.system._source.attributes.ac.calc ?? "default",
          flat: foe.system._source.attributes.ac.flat ?? null
        };
        const priorHP = foe.system.attributes.hp.value;
        const priorInspiration = fighter.system.attributes.inspiration;
        const priorTimer = game.settings.get(MODULE_ID, "holdTimer");
        let attackMsg = null;
        try {
          // ⚠ THE CLOCK GOES OFF. Two offers, two answers and two public die rolls do not fit
          // inside a 15-second house window, and a timer that passes an offer mid-section would
          // report a bug this suite did not find. `holdTimer 0` is the shipped wait-forever
          // escape hatch, not a test-only door — smoke-maneuvers pins it the same way.
          await game.settings.set(MODULE_ID, "holdTimer", 0);
          // ⚠ HEROIC IS TURNED OFF ON PURPOSE. It is legal on an attack, so leaving it on makes
          // the fold machine RE-OFFER after the bardic spend, and this section is about the two
          // MACHINES composing, not about the fold machine's own re-offer (§3's business). One
          // fold kind on the fold side keeps the receipt readable.
          await fighter.update({ "system.attributes.inspiration": false });
          // ⚠ SEED THE BARDIC MARKER — §2 runs first in a full pass and DELETES it (its own log
          // line says so). Same shape and same origin as the fixture: the die is resolved
          // bard-side through this uuid, so a marker without it is worth literally zero.
          if (!fighter.effects.find(e => (e.name === "Inspired") && !e.disabled)) {
            const feat = bard.items.find(i => i.name === "Bardic Inspiration");
            if (!feat) { skips.push("section 6: the bard has no Bardic Inspiration item"); }
            else {
              await fighter.createEmbeddedDocuments("ActiveEffect", [{
                name: "Inspired", img: "icons/magic/light/hand-sparks-smoke-green.webp",
                origin: feat.uuid, duration: { seconds: 3600 }, transfer: false,
                disabled: false, changes: []
              }]);
              log.push("section 6: re-seeded the Inspired effect §2 spends");
            }
          }
          // ⚠ SWEEP EVERY UNANSWERED RESCUE OFFER FIRST, and this is not tidiness — it is the
          // difference between measuring this run and measuring a previous one. A pending
          // rescue flag is CRASH-RESUMABLE on purpose: the module re-offers it as soon as the
          // chat log renders, so an earlier run of this section that ended without answering
          // greets the next one with an identical popup — same title, same band, same buttons —
          // sitting IN FRONT of the popup this run is about to open. Any finder that matches on
          // prose takes the older one. That is not hypothetical: it happened here, and it looks
          // exactly like a bug in the code under test — the card announced the right composed
          // sentence and drove the right damage while this run's flag stayed `pending` forever,
          // because the click had resolved a message from twenty minutes ago.
          const stale = game.messages.contents.filter(m =>
            (m.getFlag(MODULE_ID, "precision")?.status === "pending")
            || (m.getFlag(MODULE_ID, "d20fold")?.status === "pending"));
          if (stale.length) {
            await ChatMessage.deleteDocuments(stale.map(m => m.id));
            await sleep(500);   // the delete-sweep closes their popups on the way out
            log.push(`section 6: swept ${stale.length} unanswered offer(s) from an earlier run`);
          }

          await foe.update({
            "system.attributes.ac.calc": "flat", "system.attributes.ac.flat": 18,
            "system.attributes.hp.value": foe.system.attributes.hp.max
          });

          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          placed.setTarget(true, { releaseOthers: true });
          await sleep(200);

          // ⚠ AND REMEMBER WHICH DIALOGS ALREADY EXIST, because deleting a message closes its
          // popups ASYNCHRONOUSLY and a closed DialogV2 can still be in the DOM for a while.
          // A leftover is indistinguishable from this run's popup by prose, by title and by
          // buttons — and clicking one is a silent no-op in the worst possible way: the callback
          // runs, writes to a DELETED message, the write fails where nothing logs it, and the
          // section sees a popup that "does not respond". Dialog ids only ever climb, so
          // "not in this set" means "opened for the attack below" and nothing else.
          const priorDialogs = new Set(
            [...document.querySelectorAll(".application")]
              .filter(el => el.tagName === "DIALOG").map(el => el.id));

          face(5, 20);
          const use = await act.use({ subsequentActions: false }, { configure: false }, {});
          const usageId = use?.message?.id ?? null;
          const rolls = await act.rollAttack({ advantage: false, disadvantage: false },
            { configure: false },
            usageId ? { data: { "flags.dnd5e.originatingMessage": usageId } } : {});
          attackMsg = rolls?.[0]?.parent ?? null;

          const fold = await until(() => attackMsg?.getFlag(MODULE_ID, "d20fold"), 8000);
          const prec = await until(() => attackMsg?.getFlag(MODULE_ID, "precision"), 8000);

          // ⚠ THE PREMISE OF THE WHOLE PASS, asserted rather than assumed. If the two machines
          // ever stop landing on the same message, everything below is measuring nothing.
          ok("ONE missed attack carries BOTH rescue flags",
            !!fold && !!prec && (fold.status === "pending") && (prec.status === "pending"),
            JSON.stringify({ d20fold: fold?.status, precision: prec?.status,
              base: fold?.baseTotal, attackTotal: prec?.attackTotal }));
          ok("…and both offer against the same rolled number",
            (fold?.baseTotal === 10) && (prec?.attackTotal === 10),
            `d20fold.baseTotal=${fold?.baseTotal} precision.attackTotal=${prec?.attackTotal}`);

          // ⚠ FIND THE POPUP BY ITS BUTTON, NOT BY ITS PROSE. `dialogsWith` walks EVERY
          // `.application`, and both of these sentences also appear in the durable card rows
          // inside the chat sidebar — which is an `.application` too, and whichever ancestor
          // matches first is what `[0]` hands back. A run against a cold world returned the
          // same element for both queries and the section reported "two windows" while looking
          // at one sidebar. The DialogV2 buttons carry `data-action`; `momentButton` (the card
          // rows) deliberately does not — so the button IS the discriminator, and demanding it
          // makes the finder and the assertion the same act.
          const momentPopup = (text, action) => [...document.querySelectorAll(".application")]
            .find(el => (el.tagName === "DIALOG")
              && !priorDialogs.has(el.id)
              && (el.innerHTML ?? "").includes(text)
              && !!el.querySelector(`button[data-action="${action}"]`));
          const foldPopup = await until(() => momentPopup("Patch this roll", "bardic"), 8000);
          const precPopup = await until(() => momentPopup("The attack missed", "use"), 8000);
          ok("TWO windows open for ONE decision — the discombobulation this pass exists to fix",
            !!foldPopup && !!precPopup && (foldPopup !== precPopup),
            `fold=${foldPopup?.id ?? "none"} precision=${precPopup?.id ?? "none"}`);

          /* --- the fold spends first, and lands SHORT ---------------------------------- */
          face(3, 8);
          foldPopup?.querySelector('button[data-action="bardic"]')?.click();
          const foldDone = await until(() => {
            const cur = attackMsg?.getFlag(MODULE_ID, "d20fold");
            return (cur?.status === "resolved") ? cur : null;
          }, 20_000);
          ok("the bardic die is spent and composed, and the attack STILL misses",
            !!foldDone && (foldDone.foldedTotal === 13)
              && (foldDone.targets?.[0]?.verdict === "miss"),
            `folded=${foldDone?.foldedTotal} verdict=${foldDone?.targets?.[0]?.verdict}`);

          /* --- then precision, whose die closes the gap the fold left ------------------- */
          const before = game.messages.size;
          face(6, 8);
          const stillOpen = momentPopup("The attack missed", "use") ?? precPopup;
          stillOpen?.querySelector('button[data-action="use"]')?.click();
          // ⚠ A LONG BUDGET, AND THE ELAPSED TIME REPORTED. `resolvePrecision` really uses the
          // activity (a system consumption AND a card), rolls a public die, writes the flag,
          // posts its own card and then re-drives the damage — a chain of real documents, not
          // a computation. A budget that fits the fast path and not the slow one turns a
          // green feature into a red suite, which is the failure this line exists to prevent.
          const t0 = Date.now();
          const precDone = await until(() => {
            const cur = attackMsg?.getFlag(MODULE_ID, "precision");
            return (cur?.status === "resolved") ? cur : null;
          }, 25_000);
          ok("the superiority die is really rolled and recorded",
            !!precDone && (precDone.outcome === "used") && (precDone.die === 6),
            JSON.stringify({ outcome: precDone?.outcome, die: precDone?.die,
              ms: Date.now() - t0 }));

          // The composed number, from the MODULE'S OWN records — the fold machine wrote
          // `foldedTotal`, the precision machine wrote `die`. This suite adds them; it does not
          // re-implement the composition it is testing.
          const composed = (foldDone?.foldedTotal ?? 0) + (precDone?.die ?? 0);

          /* ⚠ THE RECEIPT — the two assertions that answer the drop's objection. Both are
           * EXPECTED RED against v1.23.2 and both are one bug: `resolvePrecision` composes
           * against `flag.attackTotal` instead of walking the registry the way `resolveFold`
           * and `hitTargets` do. */
          ok("⚠ RECEIPT 1: precision's verdict is the COMPOSED one, not its own die alone",
            precDone?.targets?.[0]?.verdict === "hit",
            `composed ${composed} vs AC 18 → expected hit; flag says `
            + `${precDone?.targets?.[0]?.verdict} (un-composed ${precDone?.attackTotal} + `
            + `${precDone?.die} = ${(precDone?.attackTotal ?? 0) + (precDone?.die ?? 0)})`);

          const card = await until(() => game.messages.contents.slice(before).findLast(m =>
            (m.content ?? "").includes("Precision Attack") && (m.content ?? "").includes("vs AC")),
            15_000);
          const text = (card?.content ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          ok("⚠ RECEIPT 2: precision's CARD announces the composed sum and calls it a hit",
            !!card && text.includes(`= ${composed} vs AC 18`) && /now hits/.test(text),
            text || "no precision card");

          // ⚠ The third consequence, and the one the table actually loses: `!anyHit` gates the
          // re-drive, so a composed hit that precision scored as a miss pays no damage at all
          // while `hitTargets` — which every other reader goes through — says the target was
          // hit. Which shape to look for depends on a setting, so it is read, never assumed.
          const playerRolls = game.settings.get(MODULE_ID, "playerRollDamage");
          if (playerRolls) {
            const bar = await until(() => attackMsg?.getFlag(MODULE_ID, "damageOffer"), 12_000);
            ok("⚠ RECEIPT 3: the damage OFFER is raised on the composed hit (playerRollDamage on)",
              !!bar, bar ? "offered" : "NO DAMAGE OFFER after the composed hit");
          } else {
            const dmg = await until(() => game.messages.contents.findLast(m =>
              (m.getFlag("dnd5e", "roll.type") === "damage")
              && (m.speaker?.actor === fighter.id)
              && (m.timestamp >= (attackMsg?.timestamp ?? 0))), 15_000);
            ok("⚠ RECEIPT 3: the damage re-drives itself on the composed hit",
              !!dmg, dmg ? `damage ${dmg.rolls?.[0]?.total}` : "NO DAMAGE ROLLED after the composed hit");
          }
          log.push(`section 6: AC 18 · base ${prec?.attackTotal} → fold ${foldDone?.foldedTotal}`
            + ` → +${precDone?.die} = ${composed} · precision says `
            + `${precDone?.targets?.[0]?.verdict}`);
        } finally {
          // ⚠ PRNG first — everything after it rolls dice — then the setting, then the world.
          // The Inspired effect is re-seeded because this section SPENDS it and the sections
          // are not allowed to leave the fixture thinner than they found it; the superiority
          // pool is refilled for the same reason, and it is the one this suite could exhaust
          // silently (four `--section 6` runs and the fifth stamps nothing at all).
          CONFIG.Dice.randomUniform = realPRNG;
          await game.settings.set(MODULE_ID, "holdTimer", priorTimer).catch(() => {});
          await foe.update({
            "system.attributes.ac.calc": priorAC.calc, "system.attributes.ac.flat": priorAC.flat,
            "system.attributes.hp.value": priorHP
          }).catch(() => {});
          await fighter.update({ "system.attributes.inspiration": priorInspiration })
            .catch(() => {});
          const pool = fighter.items.find(i => i.name === "Combat Superiority");
          if ((pool?.system.uses?.spent ?? 0) > 0) {
            await pool.update({ "system.uses.spent": 0 }).catch(() => {});
          }
          if (!fighter.effects.find(e => (e.name === "Inspired") && !e.disabled)) {
            const feat = bard.items.find(i => i.name === "Bardic Inspiration");
            if (feat) await fighter.createEmbeddedDocuments("ActiveEffect", [{
              name: "Inspired", img: "icons/magic/light/hand-sparks-smoke-green.webp",
              origin: feat.uuid, duration: { seconds: 3600 }, transfer: false,
              disabled: false, changes: []
            }]).catch(() => {});
          }
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        }
      }
    }
  } catch (err) {
    fatal = `${err?.message}\n${err?.stack ?? ""}`;
  }
  return { fatal, results, log, skips };
}, sectionArg(plan, SECTIONS));

// ⚠ `finish` calls `report` itself — calling both prints the whole body twice, which is
// exactly the output drift the one-reporter rule exists to prevent.
await finish({ tag: TAG, out, plan, f });
