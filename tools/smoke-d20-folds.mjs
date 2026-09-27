// Live suite: the D20 FOLDS — Heroic Inspiration, Tactical Mind, a Bardic die.
//
// The fold arithmetic is unit-tested (tests/decide-verdict.test.js); this suite covers only what
// needs real documents: the flag STAMPS on a real miss, the SPEND takes the resource, and the
// rolled die comes from the right actor's content.
//
//   node tools/smoke-d20-folds.mjs [--list | --section N]
//
// ⚠ Needs the fixtures: node tools/fixture-d20-folds.mjs (idempotent). Disconnect the bridge.
import { announcePlan, connectSuite, loadEnv, sectionPlan, sectionArg, finish }
  from "./harness.mjs";

const TAG = "smoke-d20-folds";

// The machines this suite drives (tools/coverage-map.mjs parses this). ⚠ NEVER import a suite:
// it connects on evaluation.
export const COVERS = [
  "d20-folds.js",           // Heroic Inspiration, Tactical Mind, the Bardic die — stamp, spend, reroll
  "precision.js"            // §5 rolls the Precision Attack card beside the folds
];

const SECTIONS = {
  1: "content — the three markers resolve, and the bardic die comes from the BARD",
  2: "spend — each kind actually takes its resource away",
  3: "attack — a forced miss stamps, the reroll REPLACES, the verdict flips, damage drives",
  4: "hooks — every hook the module registers for a d20 fold ACTUALLY FIRES",
  5: "offer — a real roll stamps a flag offering EVERY eligible fold, kind-matched",
  6: "TWO RESCUES, ONE WINDOW — the merged view, and the composition under it",
  7: "TWO TARGETS, ONE DIE — the fold's card counts the die once, not once per target",
  8: "THE WINDOW CLOSES — when the clock runs out, and when a spend makes it moot",
  9: "THE WASTED-SPEND RACE — a click on a dead premise burns nothing",
  10: "THE REFUND ASK — Tactical Mind on a raw check asks whether it failed; refund restores the use, keep does not",
  11: "GUARDED MIND (the PHB feats, group 4) — a Wisdom save rolled from the sheet is offered the `succeed` fold; pressed, the use is spent and the card says the save succeeds instead; a Dexterity save never is"
};
const DEPENDS = { 2: [1], 3: [1], 5: [1], 10: [1], 11: [1] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);

const f = await connectSuite({ tag: TAG, watchdogMs: 600_000, requireElect: true, env: loadEnv() });
announcePlan(TAG, plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const results = [];
  const log = [];
  const skips = [];
  let fatal = null;
  const ok = (name, pass, detail = "") => results.push({ name, pass, detail });
  // The closure cannot import `want()`, so the plan travels as DATA (harness.mjs, sectionArg).
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
    const fighter = game.actors.getName("BF Test Fighter");
    const bard = game.actors.getName("BF Test Bard");
    if (!fighter || !bard) {
      fatal = "fixtures missing — run tools/fixture-d20-folds.mjs first";
      return { fatal, results, log, skips };
    }

    /* --- 1: content ------------------------------------------------------------------- */
    if (has(1)) {
      const entries = game.modules.get(MODULE_ID)?.api?.registries?.d20Folds?.() ?? [];
      // Every entry is one of the fold kinds and each is represented; an older stored list may lack some.
      const KINDS = ["heroic", "tactical", "bardic", "seeking", "advantage", "succeed"];
      const REQUIRED = ["heroic", "tactical", "bardic", "seeking", "advantage"];
      ok("all six kinds are known, and the five surveyed before group 4 are listed and live",
        (entries.length >= REQUIRED.length) && entries.every(e => KINDS.includes(e.kind))
          && REQUIRED.every(k => entries.some(e => e.kind === k)),
        JSON.stringify(entries));

      ok("heroic marker is a boolean on the sheet",
        fighter.system.attributes.inspiration === true,
        `inspiration=${fighter.system.attributes.inspiration}`);

      const tm = fighter.items.find(i => i.name === "Tactical Mind");
      const sw = fighter.items.find(i => i.name === "Second Wind");
      const act = tm?.system.activities?.contents?.[0];
      const target = act?.consumption?.targets?.[0]?.target;
      // ⚠ The stored target is a COMPENDIUM UUID only dnd5e's prepareData remaps; if it fails,
      // Tactical Mind offers nothing forever with no error.
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

      // ⚠ Cross-actor trap: against the bard the token is a real die; against the recipient it is 0.
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
      await fighter.update({ "system.attributes.inspiration": true });
      await fighter.update({ "system.attributes.inspiration": false });
      ok("heroic spends by writing the boolean false",
        fighter.system.attributes.inspiration === false,
        `inspiration=${fighter.system.attributes.inspiration}`);
      await fighter.update({ "system.attributes.inspiration": true });   // restore the fixture

      const sw = fighter.items.find(i => i.name === "Second Wind");
      const before = sw.system.uses.value;
      const tm = fighter.items.find(i => i.name === "Tactical Mind");
      const act = tm.system.activities.contents[0];
      await act.use({ subsequentActions: false }, { configure: false }, { create: false });
      await sleep(400);
      const after = fighter.items.get(sw.id).system.uses.value;
      ok("tactical spends a use of Second Wind through the system's own consumption",
        after === before - 1, `uses ${before} → ${after}`);

      const eff = fighter.effects.find(e => e.name === "Inspired");
      const effId = eff?.id;
      await eff.delete();
      await sleep(300);
      ok("bardic spends by deleting the effect", !fighter.effects.get(effId), `deleted ${effId}`);
      log.push("⚠ section 2 CONSUMES the fixtures — re-run tools/fixture-d20-folds.mjs after it");
    }

    /* --- 3: the attack path ------------------------------------------------------------ */
    if (has(3)) {
      // Drives the whole chain: spend → reroll → re-verdict → damage (the fixture grants a Longsword).
      const scene = game.scenes.active;
      const foeToken = scene?.tokens?.find(t => t.actor && (t.actor.type === "npc") && !t.actorLink);   // UNLINKED: a linked foe collapses two tokens onto one actor
      const placed = foeToken ? canvas.tokens.get(foeToken.id) : null;
      const sword = fighter.items.find(i => i.name === "Longsword");
      const act = sword?.system.activities?.find(a => a.type === "attack");
      if (!placed || !act) {
        skips.push("section 3: needs an NPC token on the active scene and the fighter's "
          + `Longsword (token=${!!placed} weapon=${!!act}) — run tools/fixture-d20-folds.mjs`);
      } else {
        const foe = foeToken.actor;
        ok("an NPC target is available to attack", true, foe.name);

        /* ⚠ THE DICE ARE FORCED so a reroll's OUTCOME is observable. Every die goes through
         * `CONFIG.Dice.randomUniform` and `mapRandomFace(u) = ceil((1 - u) * faces)`, so a face is forced
         * by inverting it. 5 then 19, never 1 or 20 (crit and fumble take other paths). Restored in
         * `finally`: a stubbed PRNG would make every later section silently deterministic. */
        const realPRNG = CONFIG.Dice.randomUniform;
        const face = (n, faces = 20) => {
          CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);
        };
        const priorAC = {
          override: foe.system._source.attributes.ac.override ?? null
        };
        const priorHP = foe.system.attributes.hp.value;
        const priorInspiration = fighter.system.attributes.inspiration;
        let attackMsg = null;
        try {
          // AC 18: a forced 5 (+5) totals 10 and misses; a forced 19 totals 24 and hits.
          await foe.update({
            "system.attributes.ac.override": 18,
            "system.attributes.hp.value": foe.system.attributes.hp.max
          });
          if (!fighter.system.attributes.inspiration) {
            await fighter.update({ "system.attributes.inspiration": true });
          }

          // ⚠ SWEEP, THEN REMEMBER: a rescue offer is crash-resumable, so an unanswered one from an
          // earlier run re-opens identical to this one; clicking it fails silently (see §6).
          const stale = game.messages.contents.filter(m =>
            (m.getFlag(MODULE_ID, "precision")?.status === "pending")
            || (m.getFlag(MODULE_ID, "d20fold")?.status === "pending"));
          if (stale.length) {
            await ChatMessage.deleteDocuments(stale.map(m => m.id));
            await sleep(500);
          }

          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          placed.setTarget(true, { releaseOthers: true });
          await sleep(200);
          const priorDialogs = new Set(
            [...document.querySelectorAll(".application")]
              .filter(el => el.tagName === "DIALOG").map(el => el.id));

          face(5);
          // Someone is TYPING when the window opens: the popup must leave the keyboard where it was.
          const typing = document.createElement("input");
          typing.id = "bf-smoke-typing";
          document.body.append(typing);
          typing.focus();
          const use = await act.use({ subsequentActions: false }, { configure: false }, {});
          const usageId = use?.message?.id ?? null;
          const rolls = await act.rollAttack({ advantage: false, disadvantage: false },
            { configure: false },
            usageId ? { data: { 'system.origin': usageId } } : {});
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

          // Every rescue is a ROW in one spine-drawn window: `[data-bf-rescue-action]` on a div, Pass the
          // only button. A Precision row may stand beside it (the fixture is a Battle Master); press heroic only.
          const popup = await until(() => [...document.querySelectorAll(".application")]
            .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
              && !!el.querySelector('[data-bf-rescue-action="heroic"]')), 8000);
          ok("the offer pops, carrying the spend and the pass",
            !!popup?.querySelector('[data-bf-rescue-action="heroic"]')
              && !!popup?.querySelector('button[data-action="pass"]'),
            `popup=${!!popup} rows=${popup?.querySelectorAll("[data-bf-rescue-row]").length ?? 0}`);
          ok("the window leaves the keyboard where it was — an Enter in chat is not a Pass",
            (document.activeElement === typing) && !popup?.contains(document.activeElement),
            `active=${document.activeElement?.id || document.activeElement?.tagName || "none"}`);
          typing.remove();

          face(19);
          popup?.querySelector('[data-bf-rescue-action="heroic"]')?.click();
          const done = await until(() => {
            const cur = attackMsg?.getFlag(MODULE_ID, "d20fold");
            return (cur?.status === "resolved") ? cur : null;
          }, 20_000);

          ok("the spend is recorded on the flag, with the reroll that replaced the d20",
            !!done && (done.spends?.length === 1) && (done.spends[0].kind === "heroic")
              && Number.isFinite(done.spends?.[0]?.reroll?.total),
            JSON.stringify(done?.spends ?? null));

          ok("Heroic Inspiration is really spent, not just announced",
            fighter.system.attributes.inspiration === false,
            `inspiration=${fighter.system.attributes.inspiration}`);

          // ⚠ REPLACE, NOT ADD: same modifier, so a replace lands on `base + 14` (19 − 5) and equals the
          // reroll's own total; an add would land near 29.
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

          // ⚠ The fold must DRIVE the damage; which shape depends on a setting, so it is read.
          const playerRolls = game.settings.get(MODULE_ID, "playerRollDamage");
          if (playerRolls) {
            const bar = await until(() => attackMsg?.getFlag(MODULE_ID, "damageOffer"), 12_000);
            ok("…and the damage OFFER is raised (playerRollDamage is on)", !!bar,
              bar ? "offered" : "no damage offer");
          } else {
            const dmg = await until(() => game.messages.contents.findLast(m =>
              (m.type === "damage")
              && (m.speaker?.actor === fighter.id)
              && (m.timestamp >= (attackMsg?.timestamp ?? 0))), 15_000);
            ok("…and the damage re-drives itself on the new verdict", !!dmg,
              dmg ? `damage ${dmg.rolls?.[0]?.total}` : "NO DAMAGE ROLLED after the fold hit");
          }
          log.push(`section 3: ${foe.name} AC 18 · base ${done?.baseTotal} → `
            + `folded ${done?.foldedTotal} · ${done?.targets?.[0]?.verdict}`);
        } finally {
          // ⚠ Restore unconditionally, PRNG first; §5 needs Heroic Inspiration back.
          CONFIG.Dice.randomUniform = realPRNG;
          await foe.update({
            "system.attributes.ac.override": priorAC.override,
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
      // ⚠ Registration proves nothing; only dispatch does. dnd5e's `#rollD20Test` fires only the
      // non-V2 check/save names, `#rollSkillTool` a V2 pair and `rollToolCheck` for tools.
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
      // ⚠ Asserts the whole OFFER LIST: offering only the first eligible fold hides the rest.
      // ⚠ A COUNT IS NOT A CURSOR: a deletion elsewhere shifts the log index, so every find matches
      // by content created since a pre-click TIMESTAMP.
      const since = Date.now();
      await fighter.rollAbilityCheck({ ability: "str" }, { configure: false }, { create: true });
      await sleep(600);
      const msg = game.messages.contents.findLast(m => (m.timestamp >= since) && m.getFlag(MODULE_ID, "d20fold"));
      const flag = msg?.getFlag(MODULE_ID, "d20fold");
      ok("an ability check stamps a d20 fold offer", !!flag, flag ? "stamped" : "NO FLAG");
      if (flag) {
        const kinds = (flag.offers ?? []).map(o => o.kind).sort();
        ok("every eligible fold is offered, not just the first",
          kinds.length >= 2, `offers=[${kinds.join(", ")}]`);
        ok("the offer carries no spends until one is answered",
          (flag.spends ?? []).length === 0, `spends=${(flag.spends ?? []).length}`);
        // A check offer runs a clock like every moment; expiry passes and spends nothing.
        const window = game.settings.get(MODULE_ID, "holdTimer");
        ok("a check offer runs the house clock, so its popup cannot go stale",
          window ? Number.isFinite(flag.deadline) : !flag.deadline,
          `holdTimer=${window} deadline=${flag.deadline ?? "none"}`);
        log.push(`section 5 offers on a check: ${JSON.stringify(flag.offers)}`);
      }
      if (msg) await msg.delete();

      // Tactical Mind is ability-check-only: it must NOT appear on an attack or a save.
      const since2 = Date.now();
      await fighter.rollSavingThrow({ ability: "dex" }, { configure: false }, { create: true });
      await sleep(600);
      const sMsg = game.messages.contents.findLast(m => (m.timestamp >= since2) && m.getFlag(MODULE_ID, "d20fold"));
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
      // ⚠ One missed attack stamped TWICE — `precision` and `d20fold` — must compose: precision's
      // verdict walks the registry, not `flag.attackTotal`. Asserts what the table sees: the card's
      // sentence and whether damage arrives.
      // ⚠ THE BAND (attack +5, AC 18): d20 5 → 10 (both stamp); bardic 3 → 13 (still misses);
      // precision 6 → composed 19 HITS, un-composed 16 misses. The two must straddle the AC.
      // ⚠ Fold first, then precision: the only order that can break.
      const scene = game.scenes.active;
      const foeToken = scene?.tokens?.find(t => t.actor && (t.actor.type === "npc") && !t.actorLink);   // UNLINKED: a linked foe collapses two tokens onto one actor
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
        // Force faces as in §3. ⚠ `faces` is an argument: a uniform computed for a d20 means a
        // different face on a d8, so re-force immediately before each roll.
        const face = (n, faces) => {
          CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);
        };
        const priorAC = {
          override: foe.system._source.attributes.ac.override ?? null
        };
        const priorHP = foe.system.attributes.hp.value;
        const priorInspiration = fighter.system.attributes.inspiration;
        const priorTimer = game.settings.get(MODULE_ID, "holdTimer");
        let attackMsg = null;
        try {
          // ⚠ Wait forever (`holdTimer 0`): two offers and two rolls do not fit a 15-second window.
          await game.settings.set(MODULE_ID, "holdTimer", 0);
          // ⚠ Heroic off: it would re-offer after the bardic spend, which is §3's business.
          await fighter.update({ "system.attributes.inspiration": false });
          // ⚠ Re-seed the bardic marker (§2 deletes it), with the fixture's origin: the die resolves
          // bard-side through that uuid.
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
          // ⚠ SWEEP EVERY UNANSWERED RESCUE OFFER FIRST: a pending rescue is crash-resumable and
          // re-opens an identical popup in front of this run's, so a prose finder would click the stale one.
          const stale = game.messages.contents.filter(m =>
            (m.getFlag(MODULE_ID, "precision")?.status === "pending")
            || (m.getFlag(MODULE_ID, "d20fold")?.status === "pending"));
          if (stale.length) {
            await ChatMessage.deleteDocuments(stale.map(m => m.id));
            await sleep(500);
            log.push(`section 6: swept ${stale.length} unanswered offer(s) from an earlier run`);
          }

          await foe.update({
            "system.attributes.ac.override": 18,
            "system.attributes.hp.value": foe.system.attributes.hp.max
          });

          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          placed.setTarget(true, { releaseOthers: true });
          await sleep(200);

          // ⚠ Remember existing dialogs: deleting a message closes its popups ASYNCHRONOUSLY, and a
          // leftover's callback writes to a deleted message silently. Dialog ids only climb.
          const priorDialogs = new Set(
            [...document.querySelectorAll(".application")]
              .filter(el => el.tagName === "DIALOG").map(el => el.id));

          face(5, 20);
          const use = await act.use({ subsequentActions: false }, { configure: false }, {});
          const usageId = use?.message?.id ?? null;
          const rolls = await act.rollAttack({ advantage: false, disadvantage: false },
            { configure: false },
            usageId ? { data: { 'system.origin': usageId } } : {});
          attackMsg = rolls?.[0]?.parent ?? null;

          const fold = await until(() => attackMsg?.getFlag(MODULE_ID, "d20fold"), 8000);
          const prec = await until(() => attackMsg?.getFlag(MODULE_ID, "precision"), 8000);

          ok("ONE missed attack carries BOTH rescue flags",
            !!fold && !!prec && (fold.status === "pending") && (prec.status === "pending"),
            JSON.stringify({ d20fold: fold?.status, precision: prec?.status,
              base: fold?.baseTotal, attackTotal: prec?.attackTotal }));
          ok("…and both offer against the same rolled number",
            (fold?.baseTotal === 10) && (prec?.attackTotal === 10),
            `d20fold.baseTotal=${fold?.baseTotal} precision.attackTotal=${prec?.attackTotal}`);

          // ⚠ Find the window by its controls, not its prose: the chat sidebar is an `.application`
          // carrying the same sentences.
          const rescueWindow = () => [...document.querySelectorAll(".application")]
            .find(el => (el.tagName === "DIALOG")
              && !priorDialogs.has(el.id)
              && !!el.querySelector("[data-bf-rescue-row]"));
          const rowFor = (win, action) =>
            win?.querySelector(`[data-bf-rescue-action="${action}"]`) ?? null;
          const win = await until(() => {
            const w = rescueWindow();
            return (w && rowFor(w, "bardic") && rowFor(w, "use")) ? w : null;
          }, 8000);

          // ONE window carrying a row from each machine (the spawn coalesce renders it complete).
          const windows = [...document.querySelectorAll(".application")]
            .filter(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
              && !!el.querySelector("[data-bf-rescue-row]"));
          ok("ONE window carries BOTH rescues — two machines, one decision",
            (windows.length === 1) && !!rowFor(win, "bardic") && !!rowFor(win, "use"),
            `windows=${windows.length} rows=${win ? win.querySelectorAll("[data-bf-rescue-row]").length : 0}`);
          ok("…and it shows ONE Pass, not one per machine",
            (win?.querySelectorAll('button[data-action="pass"]').length === 1),
            `pass buttons=${win?.querySelectorAll('button[data-action="pass"]').length ?? 0}`);
          // ⚠ Every rule quote is in one grid cell, exactly one VISIBLE (hover flips visibility so the
          // box never resizes) — count what is shown, not what is present.
          const pane = win?.querySelector("[data-bf-rescue-pane]");
          const shownQuotes = [...(pane?.querySelectorAll("[data-bf-rescue-quote]") ?? [])]
            .filter(q => q.style.visibility !== "hidden");
          ok("the quote pane shows exactly one verbatim rule",
            !!pane && (shownQuotes.length === 1) && /expend/i.test(shownQuotes[0]?.textContent ?? ""),
            `panes=${win?.querySelectorAll("[data-bf-rescue-pane]").length ?? 0} `
            + `quotes=${pane?.querySelectorAll("[data-bf-rescue-quote]").length ?? 0} `
            + `shown=${shownQuotes.length}`);

          /* --- the fold spends first, and lands SHORT ---------------------------------- */
          face(3, 8);
          rowFor(win, "bardic")?.click();
          const foldDone = await until(() => {
            const cur = attackMsg?.getFlag(MODULE_ID, "d20fold");
            return (cur?.status === "resolved") ? cur : null;
          }, 20_000);
          ok("the bardic die is spent and composed, and the attack STILL misses",
            !!foldDone && (foldDone.foldedTotal === 13)
              && (foldDone.targets?.[0]?.verdict === "miss"),
            `folded=${foldDone?.foldedTotal} verdict=${foldDone?.targets?.[0]?.verdict}`);

          /* --- then precision, whose die closes the gap the fold left ------------------- */
          // The window survives the spend: the spent row greys in place.
          const after = await until(() => {
            const w = rescueWindow();
            return (w && !rowFor(w, "bardic") && rowFor(w, "use")) ? w : null;
          }, 12_000);
          ok("the spend greys IN PLACE and the survivor stays pressable",
            !!after && (after.querySelectorAll("[data-bf-rescue-row]").length === 2)
              && !rowFor(after, "bardic") && !!rowFor(after, "use"),
            after ? `rows=${after.querySelectorAll("[data-bf-rescue-row]").length} `
              + `bardic pressable=${!!rowFor(after, "bardic")} precision pressable=${!!rowFor(after, "use")}`
              : "the window did not redraw");
          // A spend that leaves the roll short says so.
          ok("…and the window SAYS the spend was not enough",
            /not enough yet/i.test(after?.textContent ?? "")
              && /Bardic Inspiration/.test(after?.textContent ?? ""),
            (after?.textContent ?? "").replace(/s+/g, " ").slice(0, 160));
          ok("…and the greyed row reports the die it actually rolled",
            /rolled/i.test(after?.querySelector('[data-bf-rescue-row$=":bardic"]')?.textContent ?? "")
              && /\b3\b/.test(after?.querySelector('[data-bf-rescue-row$=":bardic"]')?.textContent ?? ""),
            (after?.querySelector('[data-bf-rescue-row$=":bardic"]')?.textContent ?? "no row")
              .replace(/\s+/g, " ").trim());

          const since = Date.now();
          face(6, 8);
          rowFor(after ?? win, "use")?.click();
          // ⚠ A long budget: `resolvePrecision` runs a chain of real documents (activity, card, die,
          // damage re-drive).
          const t0 = Date.now();
          const precDone = await until(() => {
            const cur = attackMsg?.getFlag(MODULE_ID, "precision");
            return (cur?.status === "resolved") ? cur : null;
          }, 25_000);
          ok("the superiority die is really rolled and recorded",
            !!precDone && (precDone.outcome === "used") && (precDone.die === 6),
            JSON.stringify({ outcome: precDone?.outcome, die: precDone?.die,
              ms: Date.now() - t0 }));

          // Composed from the module's own records (`foldedTotal` + precision's `die`).
          const composed = (foldDone?.foldedTotal ?? 0) + (precDone?.die ?? 0);

          /* ⚠ THE RECEIPT: precision composes by walking the registry, like `resolveFold` and
           * `hitTargets`. */
          ok("⚠ RECEIPT 1: precision's verdict is the COMPOSED one, not its own die alone",
            precDone?.targets?.[0]?.verdict === "hit",
            `composed ${composed} vs AC 18 → expected hit; flag says `
            + `${precDone?.targets?.[0]?.verdict} (un-composed ${precDone?.attackTotal} + `
            + `${precDone?.die} = ${(precDone?.attackTotal ?? 0) + (precDone?.die ?? 0)})`);

          const card = await until(() => game.messages.contents.findLast(m => (m.timestamp >= since) &&
            (m.content ?? "").includes("Precision Attack") && (m.content ?? "").includes("vs AC")),
            15_000);
          const text = (card?.content ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          ok("⚠ RECEIPT 2: precision's CARD announces the composed sum and calls it a hit",
            !!card && text.includes(`= ${composed} vs AC 18`) && /now hits/.test(text),
            text || "no precision card");

          // ⚠ `!anyHit` gates the re-drive: a composed hit scored as a miss pays no damage. The shape
          // depends on a setting, so it is read.
          const playerRolls = game.settings.get(MODULE_ID, "playerRollDamage");
          if (playerRolls) {
            const bar = await until(() => attackMsg?.getFlag(MODULE_ID, "damageOffer"), 12_000);
            ok("⚠ RECEIPT 3: the damage OFFER is raised on the composed hit (playerRollDamage on)",
              !!bar, bar ? "offered" : "NO DAMAGE OFFER after the composed hit");
          } else {
            const dmg = await until(() => game.messages.contents.findLast(m =>
              (m.type === "damage")
              && (m.speaker?.actor === fighter.id)
              && (m.timestamp >= (attackMsg?.timestamp ?? 0))), 15_000);
            ok("⚠ RECEIPT 3: the damage re-drives itself on the composed hit",
              !!dmg, dmg ? `damage ${dmg.rolls?.[0]?.total}` : "NO DAMAGE ROLLED after the composed hit");
          }
          log.push(`section 6: AC 18 · base ${prec?.attackTotal} → fold ${foldDone?.foldedTotal}`
            + ` → +${precDone?.die} = ${composed} · precision says `
            + `${precDone?.targets?.[0]?.verdict}`);
        } finally {
          // ⚠ PRNG first, then the setting, then the world. Re-seed Inspired and refill superiority:
          // repeated runs would otherwise exhaust the pool silently.
          CONFIG.Dice.randomUniform = realPRNG;
          await game.settings.set(MODULE_ID, "holdTimer", priorTimer).catch(() => {});
          await foe.update({
            "system.attributes.ac.override": priorAC.override,
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
    /* --- 7: TWO TARGETS, ONE DIE ------------------------------------------------------- */
    if (has(7)) {
      // ⚠ An attack is ONE roll judged against MANY targets, so two missed targets and one bardic die
      // give two `add`s of the die; the card's sentence and `foldedTotal` must count it once.
      // ⚠ THE BAND: attack +5, d20 5 → 10, bardic 3, AC 30: right 13, wrong 16 — both miss on purpose
      // (the verdict is not under test). AC 30 also keeps precision's hopeless gate shut.
      const scene = game.scenes.active;
      const foeToken = scene?.tokens?.find(t => t.actor && (t.actor.type === "npc") && !t.actorLink);   // UNLINKED: a linked foe collapses two tokens onto one actor
      const sword = fighter.items.find(i => i.name === "Longsword");
      const act = sword?.system.activities?.find(a => a.type === "attack");
      if (!foeToken || !act) {
        skips.push("section 7: needs an NPC token on the active scene and the fighter's "
          + `Longsword (token=${!!foeToken} weapon=${!!act}) — run tools/fixture-d20-folds.mjs`);
      } else {
        const realPRNG = CONFIG.Dice.randomUniform;
        const face = (n, faces) => {
          CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);
        };
        const priorInspiration = fighter.system.attributes.inspiration;
        const priorTimer = game.settings.get(MODULE_ID, "holdTimer");
        let scratchId = null;
        const priorAC = new Map();
        try {
          await game.settings.set(MODULE_ID, "holdTimer", 0);
          await fighter.update({ "system.attributes.inspiration": false });
          if (!fighter.effects.find(e => (e.name === "Inspired") && !e.disabled)) {
            const feat = bard.items.find(i => i.name === "Bardic Inspiration");
            if (feat) await fighter.createEmbeddedDocuments("ActiveEffect", [{
              name: "Inspired", img: "icons/magic/light/hand-sparks-smoke-green.webp",
              origin: feat.uuid, duration: { seconds: 3600 }, transfer: false,
              disabled: false, changes: []
            }]);
          }
          const stale = game.messages.contents.filter(m =>
            (m.getFlag(MODULE_ID, "precision")?.status === "pending")
            || (m.getFlag(MODULE_ID, "d20fold")?.status === "pending"));
          if (stale.length) {
            await ChatMessage.deleteDocuments(stale.map(m => m.id));
            await sleep(500);
          }

          // ⚠ The second target is BUILT (a scratch token of the same unlinked actor): one AC to set and
          // restore. Deleted in `finally`.
          const [scratch] = await scene.createEmbeddedDocuments("Token", [
            foundry.utils.mergeObject(foeToken.toObject(),
              { x: foeToken.x + (scene.grid?.size ?? 100), y: foeToken.y },
              { inplace: false, performDeletions: true })
          ]);
          scratchId = scratch?.id ?? null;
          for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(scratchId)); i++) {
            await sleep(250);
          }
          const placedA = canvas.tokens.get(foeToken.id);
          const placedB = canvas.tokens.get(scratchId);
          if (!placedA || !placedB) {
            skips.push("section 7: the second token never reached the canvas");
          } else {
            // ⚠ AC is set on each token's own (unlinked) actor, in its delta. ⚠ Capture once per uuid: a
            // linked foe collapses both tokens onto one actor and the second capture reads the written 30.
            for (const t of [placedA, placedB]) {
              const a = t.actor;
              if ( !priorAC.has(a.uuid) ) priorAC.set(a.uuid, {
                override: a.system._source.attributes.ac.override ?? null,
                hp: a.system.attributes.hp.value
              });
              await a.update({
                "system.attributes.ac.override": 30,
                "system.attributes.hp.value": a.system.attributes.hp.max
              });
            }

            game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
            placedA.setTarget(true, { releaseOthers: true });
            placedB.setTarget(true, { releaseOthers: false });
            await sleep(300);
            const priorDialogs = new Set(
              [...document.querySelectorAll(".application")]
                .filter(el => el.tagName === "DIALOG").map(el => el.id));

            face(5, 20);
            const use = await act.use({ subsequentActions: false }, { configure: false }, {});
            const usageId = use?.message?.id ?? null;
            const rolls = await act.rollAttack({ advantage: false, disadvantage: false },
              { configure: false },
              usageId ? { data: { 'system.origin': usageId } } : {});
            const attackMsg = rolls?.[0]?.parent ?? null;
            const flag = await until(() => {
              const cur = attackMsg?.getFlag(MODULE_ID, "d20fold");
              return (cur?.targets?.length === 2) ? cur : null;
            }, 8000);

            ok("one attack roll is judged against TWO missed targets",
              !!flag && (flag.status === "pending") && (flag.targets?.length === 2),
              JSON.stringify({ status: flag?.status, base: flag?.baseTotal,
                targets: flag?.targets?.length }));
            ok("precision stays out of it — a d8 cannot reach AC 30, so it never stamps",
              !attackMsg?.getFlag(MODULE_ID, "precision"),
              attackMsg?.getFlag(MODULE_ID, "precision") ? "STAMPED" : "no precision flag");

            const popup = await until(() => [...document.querySelectorAll(".application")]
              .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
                && !!el.querySelector('[data-bf-rescue-action="bardic"]')), 8000);
            const since = Date.now();
            face(3, 8);
            popup?.querySelector('[data-bf-rescue-action="bardic"]')?.click();
            const done = await until(() => {
              const cur = attackMsg?.getFlag(MODULE_ID, "d20fold");
              return (cur?.status === "resolved") ? cur : null;
            }, 25_000);

            ok("⚠ RECEIPT: the composed total counts the die ONCE, not once per target",
              done?.foldedTotal === 13,
              `foldedTotal=${done?.foldedTotal} (13 is the die counted once; `
              + `16 is it counted per target)`);
            ok("both verdicts stand — the verdict half was never the broken one",
              (done?.targets ?? []).length === 2
                && (done?.targets ?? []).every(t => t.verdict === "miss"),
              JSON.stringify((done?.targets ?? []).map(t => t.verdict)));

            const card = await until(() => game.messages.contents.findLast(m => (m.timestamp >= since) &&
              (m.content ?? "").includes("vs AC 30")), 15_000);
            const text = (card?.content ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
            const sums = [...text.matchAll(/10 \+ (\d+) = (\d+) vs AC 30/g)].map(m => m[2]);
            ok("⚠ RECEIPT: the CARD says the same number on every row, and says it once",
              (sums.length === 2) && sums.every(s => s === "13"),
              sums.length ? `rows announced [${sums.join(", ")}]` : (text || "no fold card"));
            log.push(`section 7: two targets AC 30 · base ${flag?.baseTotal} → `
              + `folded ${done?.foldedTotal} · rows [${sums.join(", ")}]`);
          }
        } finally {
          // PRNG, setting, world — the scratch token LAST: restoring its AC needs it to exist.
          CONFIG.Dice.randomUniform = realPRNG;
          await game.settings.set(MODULE_ID, "holdTimer", priorTimer).catch(() => {});
          for (const [uuid, prior] of priorAC) {
            const a = await fromUuid(uuid).catch(() => null);
            if (a) await a.update({
              "system.attributes.ac.override": prior.override,
              "system.attributes.hp.value": prior.hp
            }).catch(() => {});
          }
          await fighter.update({ "system.attributes.inspiration": priorInspiration })
            .catch(() => {});
          if (!fighter.effects.find(e => (e.name === "Inspired") && !e.disabled)) {
            const feat = bard.items.find(i => i.name === "Bardic Inspiration");
            if (feat) await fighter.createEmbeddedDocuments("ActiveEffect", [{
              name: "Inspired", img: "icons/magic/light/hand-sparks-smoke-green.webp",
              origin: feat.uuid, duration: { seconds: 3600 }, transfer: false,
              disabled: false, changes: []
            }]).catch(() => {});
          }
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          if (scratchId) {
            await scene.deleteEmbeddedDocuments("Token", [scratchId]).catch(() => {});
          }
        }
      }
    }
    /* --- 8: THE WINDOW CLOSES --------------------------------------------------------- */
    if (has(8)) {
      // ⚠ The merged window must go away when nothing is left to ask:
      //   (a) the clock ran out;
      //   (b) a spend fixed the roll — a click would spend a real die on a target already hit.
      const scene = game.scenes.active;
      const foeToken = scene?.tokens?.find(t => t.actor && (t.actor.type === "npc") && !t.actorLink);   // UNLINKED: a linked foe collapses two tokens onto one actor
      const placed = foeToken ? canvas.tokens.get(foeToken.id) : null;
      const sword = fighter.items.find(i => i.name === "Longsword");
      const act = sword?.system.activities?.find(a => a.type === "attack");
      if (!placed || !act) {
        skips.push("section 8: needs an NPC token and the fighter's Longsword "
          + `(token=${!!placed} weapon=${!!act}) — run tools/fixture-d20-folds.mjs`);
      } else {
        const foe = foeToken.actor;
        const realPRNG = CONFIG.Dice.randomUniform;
        const face = (n, faces) => {
          CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);
        };
        const priorAC = {
          override: foe.system._source.attributes.ac.override ?? null
        };
        const priorHP = foe.system.attributes.hp.value;
        const priorInspiration = fighter.system.attributes.inspiration;
        const priorTimer = game.settings.get(MODULE_ID, "holdTimer");
        try {
          // ⚠ A short clock: this section's subject is the buzzer.
          await game.settings.set(MODULE_ID, "holdTimer", 2);
          await fighter.update({ "system.attributes.inspiration": false });
          if (!fighter.effects.find(e => (e.name === "Inspired") && !e.disabled)) {
            const feat = bard.items.find(i => i.name === "Bardic Inspiration");
            if (feat) await fighter.createEmbeddedDocuments("ActiveEffect", [{
              name: "Inspired", img: "icons/magic/light/hand-sparks-smoke-green.webp",
              origin: feat.uuid, duration: { seconds: 3600 }, transfer: false,
              disabled: false, changes: []
            }]);
          }
          const sweep = async () => {
            const stale = game.messages.contents.filter(m =>
              (m.getFlag(MODULE_ID, "precision")?.status === "pending")
              || (m.getFlag(MODULE_ID, "d20fold")?.status === "pending"));
            if (stale.length) {
              await ChatMessage.deleteDocuments(stale.map(m => m.id));
              await sleep(500);
            }
          };
          const windows = prior => [...document.querySelectorAll(".application")]
            .filter(el => (el.tagName === "DIALOG") && !prior.has(el.id)
              && !!el.querySelector("[data-bf-rescue-row]"));
          const swing = async (ac, d20) => {
            await sweep();
            await foe.update({
              "system.attributes.ac.override": ac,
              "system.attributes.hp.value": foe.system.attributes.hp.max
            });
            game.user.targets.forEach(x => { x.setTarget(false, { releaseOthers: true }); });
            placed.setTarget(true, { releaseOthers: true });
            await sleep(200);
            const prior = new Set([...document.querySelectorAll(".application")]
              .filter(el => el.tagName === "DIALOG").map(el => el.id));
            face(d20, 20);
            const use = await act.use({ subsequentActions: false }, { configure: false }, {});
            const usageId = use?.message?.id ?? null;
            const rolls = await act.rollAttack({ advantage: false, disadvantage: false },
              { configure: false },
              usageId ? { data: { 'system.origin': usageId } } : {});
            const msg = rolls?.[0]?.parent ?? null;
            await until(() => msg?.getFlag(MODULE_ID, "precision"), 8000);
            await until(() => windows(prior).length === 1, 8000);
            return { msg, prior };
          };

          /* --- (a) the clock runs out ------------------------------------------------- */
          {
            // 8 → 13 against AC 18 misses by 5, in a d8's reach, so precision stays in.
            const { msg, prior } = await swing(18, 8);
            ok("§8a the window opens with something to ask", windows(prior).length === 1,
              `windows=${windows(prior).length}`);
            const timedOut = await until(() => {
              const p = msg?.getFlag(MODULE_ID, "precision");
              const d = msg?.getFlag(MODULE_ID, "d20fold");
              return ((p?.status === "resolved") && (d?.status === "resolved")) ? { p, d } : null;
            }, 15_000);
            ok("§8a both offers really expire on the house clock",
              !!timedOut, JSON.stringify({ precision: timedOut?.p?.outcome,
                d20fold: timedOut?.d?.outcome }));
            const gone = await until(() => (windows(prior).length === 0) ? "gone" : null, 10_000);
            ok("⚠ §8a RECEIPT: …and the window CLOSES when the clock takes the last offer",
              gone === "gone", `windows still open=${windows(prior).length}`);
          }

          /* --- (b) a spend makes the rest moot ---------------------------------------- */
          {
            await game.settings.set(MODULE_ID, "holdTimer", 0);   // the human's own pace
            // 8 → 13 against AC 15: short by 2; a bardic 4 makes 17 and precision has no premise left.
            const { msg, prior } = await swing(15, 8);
            const row = () => windows(prior)[0]?.querySelector('[data-bf-rescue-action="bardic"]');
            const pressable = await until(row, 8000);
            ok("§8b the bardic row is there to press", !!pressable,
              `rows=${windows(prior)[0]?.querySelectorAll("[data-bf-rescue-row]").length ?? 0}`);
            face(4, 8);
            pressable?.click();
            const hit = await until(() => {
              const d = msg?.getFlag(MODULE_ID, "d20fold");
              return (d?.targets ?? []).some(x => x.verdict === "hit") ? d : null;
            }, 20_000);
            ok("§8b the bardic die turns the miss into a hit",
              !!hit && (hit.foldedTotal === 17), `folded=${hit?.foldedTotal}`);
            const moot = await until(() => {
              const p = msg?.getFlag(MODULE_ID, "precision");
              return (p?.status === "resolved") ? p : null;
            }, 15_000);
            ok("⚠ §8b RECEIPT: the survivor withdraws itself — nothing spent",
              (moot?.outcome === "no longer needed") && !Number.isFinite(moot?.die),
              JSON.stringify({ outcome: moot?.outcome, die: moot?.die ?? null }));
            const gone = await until(() => (windows(prior).length === 0) ? "gone" : null, 10_000);
            ok("⚠ §8b RECEIPT: …and the window gets out of the way of the damage",
              gone === "gone", `windows still open=${windows(prior).length}`);
          }
        } finally {
          CONFIG.Dice.randomUniform = realPRNG;
          await game.settings.set(MODULE_ID, "holdTimer", priorTimer).catch(() => {});
          await foe.update({
            "system.attributes.ac.override": priorAC.override,
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
          game.user.targets.forEach(x => { x.setTarget(false, { releaseOthers: true }); });
        }
      }
    }
    /* --- 9: THE WASTED-SPEND RACE ----------------------------------------------------- */
    if (has(9)) {
      // ⚠ THE WASTED-SPEND RACE: a click arriving after a sibling fixed the roll must not spend. A
      // click can be in flight when the window closes, and crash-resume calls the resolver directly.
      // Asserts the OUTCOME (the die is still there), not which guard caught it.
      const scene = game.scenes.active;
      const foeToken = scene?.tokens?.find(t => t.actor && (t.actor.type === "npc") && !t.actorLink);   // UNLINKED: a linked foe collapses two tokens onto one actor
      const placed = foeToken ? canvas.tokens.get(foeToken.id) : null;
      const sword = fighter.items.find(i => i.name === "Longsword");
      const act = sword?.system.activities?.find(a => a.type === "attack");
      if (!placed || !act) {
        skips.push("section 9: needs an NPC token and the fighter's Longsword "
          + `(token=${!!placed} weapon=${!!act}) — run tools/fixture-d20-folds.mjs`);
      } else {
        const foe = foeToken.actor;
        const realPRNG = CONFIG.Dice.randomUniform;
        const face = (n, faces) => {
          CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);
        };
        const priorAC = {
          override: foe.system._source.attributes.ac.override ?? null
        };
        const priorHP = foe.system.attributes.hp.value;
        const priorInspiration = fighter.system.attributes.inspiration;
        const priorTimer = game.settings.get(MODULE_ID, "holdTimer");
        try {
          await game.settings.set(MODULE_ID, "holdTimer", 0);      // no buzzer in this race
          await fighter.update({ "system.attributes.inspiration": false });
          if (!fighter.effects.find(e => (e.name === "Inspired") && !e.disabled)) {
            const feat = bard.items.find(i => i.name === "Bardic Inspiration");
            if (feat) await fighter.createEmbeddedDocuments("ActiveEffect", [{
              name: "Inspired", img: "icons/magic/light/hand-sparks-smoke-green.webp",
              origin: feat.uuid, duration: { seconds: 3600 }, transfer: false,
              disabled: false, changes: []
            }]);
          }
          const stale = game.messages.contents.filter(m =>
            (m.getFlag(MODULE_ID, "precision")?.status === "pending")
            || (m.getFlag(MODULE_ID, "d20fold")?.status === "pending"));
          if (stale.length) {
            await ChatMessage.deleteDocuments(stale.map(m => m.id));
            await sleep(500);
          }
          await foe.update({
            "system.attributes.ac.override": 15,
            "system.attributes.hp.value": foe.system.attributes.hp.max
          });
          game.user.targets.forEach(x => { x.setTarget(false, { releaseOthers: true }); });
          placed.setTarget(true, { releaseOthers: true });
          await sleep(200);
          const priorDialogs = new Set([...document.querySelectorAll(".application")]
            .filter(el => el.tagName === "DIALOG").map(el => el.id));
          const windows = () => [...document.querySelectorAll(".application")]
            .filter(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
              && !!el.querySelector("[data-bf-rescue-row]"));

          // 8 → 13 against AC 15: short by 2, which either die can close.
          face(8, 20);
          const use = await act.use({ subsequentActions: false }, { configure: false }, {});
          const usageId = use?.message?.id ?? null;
          const rolls = await act.rollAttack({ advantage: false, disadvantage: false },
            { configure: false },
            usageId ? { data: { 'system.origin': usageId } } : {});
          const attackMsg = rolls?.[0]?.parent ?? null;
          const win = await until(() => {
            const w = windows()[0];
            return (w?.querySelector('[data-bf-rescue-action="bardic"]')
              && w.querySelector('[data-bf-rescue-action="use"]')) ? w : null;
          }, 8000);
          ok("§9 both rescues are on the window before anything is spent",
            !!win, `rows=${win?.querySelectorAll("[data-bf-rescue-row]").length ?? 0}`);

          // ⚠ A detached element keeps its listeners: this is what an in-flight click looks like.
          const staleBardic = win?.querySelector('[data-bf-rescue-action="bardic"]') ?? null;
          const inspiredBefore = fighter.effects.find(e =>
            (e.name === "Inspired") && !e.disabled)?.id ?? null;
          ok("§9 the Bardic die is really there to lose", !!inspiredBefore,
            `effect=${inspiredBefore}`);

          face(4, 8);
          win?.querySelector('[data-bf-rescue-action="use"]')?.click();
          const hit = await until(() => {
            const p = attackMsg?.getFlag(MODULE_ID, "precision");
            return ((p?.outcome === "used") && (p.targets ?? []).some(x => x.verdict === "hit"))
              ? p : null;
          }, 20_000);
          ok("§9 precision lands and the attack now hits",
            !!hit && (hit.die === 4), JSON.stringify({ die: hit?.die,
              verdict: hit?.targets?.[0]?.verdict }));

          staleBardic?.click();
          await sleep(2500);
          const fold = attackMsg?.getFlag(MODULE_ID, "d20fold");
          ok("⚠ §9 RECEIPT: the stale click spends NOTHING",
            !(fold?.spends ?? []).length,
            JSON.stringify({ status: fold?.status, outcome: fold?.outcome,
              spends: (fold?.spends ?? []).length }));
          ok("⚠ §9 RECEIPT: …and the Bardic die is still on the sheet",
            !!fighter.effects.get(inspiredBefore ?? "")
              && !fighter.effects.get(inspiredBefore ?? "")?.disabled,
            `effect ${inspiredBefore} survives=${!!fighter.effects.get(inspiredBefore ?? "")}`);
          log.push(`section 9: precision ${hit?.die} closed a 2-point gap; the bardic click after `
            + `it left ${(fold?.spends ?? []).length} spend(s) and outcome "${fold?.outcome}"`);
        } finally {
          CONFIG.Dice.randomUniform = realPRNG;
          await game.settings.set(MODULE_ID, "holdTimer", priorTimer).catch(() => {});
          await foe.update({
            "system.attributes.ac.override": priorAC.override,
            "system.attributes.hp.value": priorHP
          }).catch(() => {});
          await fighter.update({ "system.attributes.inspiration": priorInspiration })
            .catch(() => {});
          const pool = fighter.items.find(i => i.name === "Combat Superiority");
          if ((pool?.system.uses?.spent ?? 0) > 0) {
            await pool.update({ "system.uses.spent": 0 }).catch(() => {});
          }
          game.user.targets.forEach(x => { x.setTarget(false, { releaseOthers: true }); });
        }
      }
    }

    /* --- 10: THE REFUND ASK ------------------------------------------------------------ */
    if (has(10)) {
      // Tactical Mind's refund ASKS (DESIGN *Tactical Mind's refund*): refund writes the use back with a
      // receipt, keep leaves it spent. Both asserted against the POOL.
      const sw = fighter.items.find(i => i.name === "Second Wind");
      const tm = fighter.items.find(i => i.name === "Tactical Mind");
      if (!sw || !tm) {
        skips.push("section 10: the fixture needs Second Wind and Tactical Mind");
      } else {
        const priorTimer = game.settings.get(MODULE_ID, "holdTimer");
        const priorSpent = sw.system.uses.spent ?? 0;
        const priorInspiration = fighter.system.attributes.inspiration;
        const made = [];
        try {
          await game.settings.set(MODULE_ID, "holdTimer", 40);
          if (priorSpent > 0) await sw.update({ "system.uses.spent": 0 });
          // Heroic off: the tactical row is the only rescue, so no re-offer precedes the ask.
          await fighter.update({ "system.attributes.inspiration": false });

          const run = async choice => {
            const priorDialogs = new Set([...document.querySelectorAll(".application")].map(el => el.id));
            const since = Date.now();
            const usesBefore = fighter.items.get(sw.id).system.uses.value;
            await fighter.rollAbilityCheck({ ability: "str" }, { configure: false }, { create: true });
            const msg = await until(() => game.messages.contents
              .findLast(m => (m.timestamp >= since) && (m.getFlag(MODULE_ID, "d20fold")?.status === "pending")), 8000);
            if (msg) made.push(msg);
            const popup = await until(() => [...document.querySelectorAll(".application")]
              .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
                && !!el.querySelector('[data-bf-rescue-action="tactical:Tactical Mind"]')), 8000);
            ok(`§10 (${choice}) the check offers Tactical Mind`, !!popup, popup ? "row present" : "NO WINDOW");
            popup?.querySelector('[data-bf-rescue-action="tactical:Tactical Mind"]')?.click();
            // A check never moots, so the bardic die is re-offered and the fold stays pending until Pass;
            // the refund ask waits for that settle.
            await until(() => {
              const cur = msg?.getFlag(MODULE_ID, "d20fold");
              return ((cur?.status === "resolved") || (cur?.spends?.length && !cur.answer)) ? cur : null;
            }, 20_000);
            await sleep(400);
            [...document.querySelectorAll(".application")]
              .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id) && !!el.querySelector('button[data-action="pass"]'))
              ?.querySelector('button[data-action="pass"]')?.click();
            const fold = await until(() => {
              const cur = msg?.getFlag(MODULE_ID, "d20fold");
              return (cur?.status === "resolved") ? cur : null;
            }, 20_000);
            ok(`§10 (${choice}) the die is added and the fold settles`,
              !!fold && fold.spends?.some(s => s.kind === "tactical") && Number.isFinite(fold.foldedTotal),
              JSON.stringify(fold?.spends ?? null));
            const usesSpent = fighter.items.get(sw.id).system.uses.value;
            ok(`§10 (${choice}) a use of Second Wind is really spent first`,
              usesSpent === usesBefore - 1, `uses ${usesBefore} → ${usesSpent}`);

            const ask = await until(() => {
              const r = msg?.getFlag(MODULE_ID, "tacticalRefund");
              return (r?.status === "pending") ? r : null;
            }, 8000);
            ok(`§10 (${choice}) the refund ask is stamped on the roll, pending, naming the pool`,
              !!ask && (ask.poolName === "Second Wind") && Number.isFinite(ask.deadline),
              JSON.stringify(ask ? { status: ask.status, pool: ask.poolName, deadline: !!ask.deadline } : null));
            const win = await until(() => [...document.querySelectorAll(".application")]
              .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id)
                && !!el.querySelector('button[data-action="refund"]') && !!el.querySelector('button[data-action="keep"]')), 8000);
            ok(`§10 (${choice}) the ask POPS with both answers`, !!win, win ? "keep + refund" : "NO WINDOW");
            // The ask carries the check before and after the die, and the window states both.
            const numbersOk = !!ask && (ask.baseTotal === fold?.baseTotal) && (ask.total === fold?.foldedTotal)
              && Number.isFinite(ask.die) && (ask.total - ask.baseTotal >= ask.die);
            const said = win?.textContent ?? "";
            ok(`§10 (${choice}) the ask states the check before and after the die, and asks the GM`,
              numbersOk && said.includes(`The check was ${ask?.baseTotal}`) && said.includes(`Does ${ask?.total} pass`),
              JSON.stringify(ask ? { base: ask.baseTotal, total: ask.total, die: ask.die, dc: ask.dc } : null));
            const receiptsSince = Date.now();
            win?.querySelector(`button[data-action="${choice}"]`)?.click();
            const settled = await until(() => {
              const r = msg?.getFlag(MODULE_ID, "tacticalRefund");
              return (r?.status && (r.status !== "pending")) ? r : null;
            }, 10_000);
            await sleep(500);
            const usesAfter = fighter.items.get(sw.id).system.uses.value;
            if (choice === "refund") {
              ok("⚠ §10 RECEIPT: refund RESTORES the use of Second Wind on the sheet",
                (settled?.status === "refunded") && (usesAfter === usesBefore), `uses ${usesSpent} → ${usesAfter} status=${settled?.status}`);
              // ⚠ Waited for: the receipt is created after the pool write.
              const receipt = await until(() => game.messages.contents
                .findLast(m => (m.timestamp >= receiptsSince) && /use is refunded/.test(m.content ?? "")), 8000);
              ok("§10 …and a receipt card says so", !!receipt, receipt ? "posted" : "NO RECEIPT");
              if (receipt) made.push(receipt);
            } else {
              ok("⚠ §10 RECEIPT: keep leaves the use SPENT",
                (settled?.status === "kept") && (usesAfter === usesSpent), `uses ${usesSpent} → ${usesAfter} status=${settled?.status}`);
            }
            ok(`§10 (${choice}) the window closes on the answer`,
              await until(() => (!document.getElementById(win?.id ?? "") ? true : null), 5000) === true,
              "closed");
            for (const m of game.messages.contents.filter(m => m.timestamp >= since)) {
              if (m.getFlag(MODULE_ID, "respondsTo") === msg?.id) made.push(m);
            }
          };
          await run("refund");
          await run("keep");
        } finally {
          await game.settings.set(MODULE_ID, "holdTimer", priorTimer).catch(() => {});
          await fighter.update({ "system.attributes.inspiration": priorInspiration }).catch(() => {});
          await fighter.items.get(sw.id)?.update({ "system.uses.spent": priorSpent }).catch(() => {});
          for (const m of made) await m.delete().catch(() => {});
        }
      }
    }

    /* --- 11: GUARDED MIND on a save rolled from the sheet -------------------------------- */
    // No DC exists for a save rolled from the sheet, so the `succeed` fold is an offer the roller
    // judges; pressing it spends the feat's use and the save succeeds.
    if (has(11)) {
      const pack = game.packs.get("dnd-players-handbook.feats");
      const src = pack ? (await pack.getIndex()).find(e => e.name === "Mage Slayer") : null;
      const doc = src ? await pack.getDocument(src._id) : null;
      if (!doc) {
        skips.push("section 11: no Mage Slayer in dnd-players-handbook.feats");
      } else {
        const priorFolds = game.settings.get(MODULE_ID, "d20Folds");
        const priorInspiration = fighter.system.attributes.inspiration;
        const made = [];
        let lent = null;
        try {
          await game.settings.set(MODULE_ID, "d20Folds", game.settings.settings.get(`${MODULE_ID}.d20Folds`)?.default ?? priorFolds);
          await fighter.update({ "system.attributes.inspiration": false });   // no reroll row beside it
          [lent] = await fighter.createEmbeddedDocuments("Item", [doc.toObject()]);
          const priorDialogs = new Set([...document.querySelectorAll(".application")].map(el => el.id));
          const since = Date.now();
          await fighter.rollSavingThrow({ ability: "wis" }, { configure: false }, { create: true });
          const msg = await until(() => game.messages.contents
            .findLast(m => (m.timestamp >= since) && m.getFlag(MODULE_ID, "d20fold")), 8000);
          if (msg) made.push(msg);
          const flag = msg?.getFlag(MODULE_ID, "d20fold");
          const offer = (flag?.offers ?? []).find(o => o.kind === "succeed");
          ok("§11 a Wisdom save rolled from the sheet is offered Guarded Mind, by the benefit's name, the save's ability on the flag",
            !!offer && (offer.label === "Guarded Mind") && (flag?.ability === "wis") && !Number.isFinite(flag?.dc),
            JSON.stringify({ offers: flag?.offers, ability: flag?.ability }));
          const popup = await until(() => [...document.querySelectorAll(".application")]
            .find(el => (el.tagName === "DIALOG") && !priorDialogs.has(el.id) && !!el.querySelector('[data-bf-rescue-action="succeed"]')), 8000);
          popup?.querySelector('[data-bf-rescue-action="succeed"]')?.click();
          // The fixture's Bardic die is not re-offered: the save succeeded.
          const done = await until(() => {
            const cur = msg?.getFlag(MODULE_ID, "d20fold");
            return (cur?.status === "resolved") ? cur : null;
          }, 20_000);
          ok("§11 pressed: the spend is the verdict — no die, no reroll — and the fold settles with no re-offer",
            !!done && (done.spends?.length === 1) && (done.spends?.[0]?.kind === "succeed") && (done.spends?.[0]?.verdict === "saved")
              && !Number.isFinite(done.spends?.[0]?.die) && !done.spends?.[0]?.reroll,
            JSON.stringify(done?.spends ?? null));
          const spent = await until(() => (Number(fighter.items.get(lent.id)?.system?.uses?.value) === 0) ? true : null, 6000);
          ok("§11 the feat's one use is really spent (its own Guard Mind activity)", !!spent,
            `uses=${fighter.items.get(lent.id)?.system?.uses?.value}`);
          const card = await until(() => game.messages.contents.findLast(m => (m.timestamp >= since)
            && /the failed save succeeds instead/.test(m.content ?? "")), 8000);
          ok("§11 the card says it: Guarded Mind — the failed save succeeds instead", !!card, card ? "posted" : "NO CARD");
          for (const m of game.messages.contents.filter(m => m.timestamp >= since)) made.push(m);
          // A Dexterity save is not Guarded Mind's: with the use restored, only the rule can refuse it.
          await fighter.items.get(lent.id)?.update({ "system.uses.spent": 0 });
          const since2 = Date.now();
          await fighter.rollSavingThrow({ ability: "dex" }, { configure: false }, { create: true });
          await sleep(800);
          const dMsg = game.messages.contents.findLast(m => (m.timestamp >= since2) && (m.system?.ability === "dex"));
          const dOffers = (dMsg?.getFlag(MODULE_ID, "d20fold")?.offers ?? []).map(o => o.kind);
          ok("§11 a Dexterity save is never offered it", !!dMsg && !dOffers.includes("succeed"), `roll=${!!dMsg} offers=[${dOffers.join(", ")}]`);
          for (const m of game.messages.contents.filter(m => m.timestamp >= since2)) made.push(m);
          [...document.querySelectorAll(".application")]
            .find(el => (el.tagName === "DIALOG") && !!el.querySelector('button[data-action="pass"]'))
            ?.querySelector('button[data-action="pass"]')?.click();
          await sleep(400);
        } finally {
          if (lent) await fighter.deleteEmbeddedDocuments("Item", [lent.id]).catch(() => {});
          await fighter.update({ "system.attributes.inspiration": priorInspiration }).catch(() => {});
          await game.settings.set(MODULE_ID, "d20Folds", priorFolds).catch(() => {});
          for (const m of made) await m.delete().catch(() => {});
        }
      }
    }
  } catch (err) {
    fatal = `${err?.message}\n${err?.stack ?? ""}`;
  }
  return { fatal, results, log, skips };
}, sectionArg(plan, SECTIONS));

// ⚠ `finish` calls `report` itself — never call both.
await finish({ tag: TAG, out, plan, f });
