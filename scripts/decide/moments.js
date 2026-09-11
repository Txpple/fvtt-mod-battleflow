// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): WHAT A RESOLVE IS, once, as data.
 *
 * THE GATE (the user, 2026-09-11: "if an ability/card is folded in a battle flow, it should be
 * exposed to fx studio as well … something architecturally solid so as this grows, it's not
 * missed / no drift, like a gate that any time an embedded card is played, it goes through that
 * hook"). State law 3 already says the flag is the state and the card and the popup are views of
 * it — so an ability folded into a Battle Flow moment resolves at exactly one kind of instant: a
 * RECORD lands on a message. That instant is the gate. Not the popup, not the receipt card, not
 * each machine's own code: watch the records, and every resolve is caught, including the ones
 * written by machines that do not exist yet.
 *
 * THREE PARTS, THIS FILE THE FIRST:
 *   1. `MOMENT_RECORDS` (here) — one row per flag key that means "something resolved": the word(s)
 *      it publishes under, what resolving means, and `resolved(record, ctx)` — every resolved
 *      moment in the record, each with a stable MARKER (a target uuid, an index, "message") and
 *      plain facts. `STATE_KEYS` (here) — every other key the module writes, each with the reason
 *      it is state and not a resolve. Together they CLASSIFY every key; the checker holds them to it.
 *   2. events.js (the spine) — ONE publisher that watches message creates and updates, computes the
 *      markers of every registered record, and publishes the markers it has not seen. The edge
 *      from unresolved to resolved IS the idempotence; no machine keeps a latch for it.
 *   3. tools/check-moments.mjs — every flag key the module writes is in ONE of the two lists, or
 *      the build fails. A new machine cannot land a resolve quietly; forgetting to classify is the
 *      only failure left, and it is loud.
 *
 * ⚠ THIS FILE CLASSIFIES, IT DOES NOT CURATE. A key is a resolve or it is state — a fact about
 * the code — never "interesting" or not. Whether a moment gets a picture is FX Studio's manager's
 * call (the user, 2026-09-11: "if it is shown or not, that is up to the manager of fx studio");
 * this side publishes every resolve and knows nobody is listening.
 *
 * ⚠ PURE. Plain objects in, plain objects out: no `game`, no documents, no imports. The spine
 * hands a row the record and a small `ctx` of facts it read off the message (its id, the item and
 * activity a usage card names, the speaker's actor), so a row may default to them; a row's facts
 * are uuids, ids and strings, which is what lets tests/decide-moments.test.js pin every row
 * against fixture records with no Foundry at all.
 *
 * MARKERS. A marker names ONE resolve inside a record so that a record which grows (a saves flag
 * gaining verdicts one target at a time, a receipt gaining entries) publishes each once: a target
 * uuid for per-target arrays, an index or a key for lists, "message" for a record that arrives
 * resolved whole. A revert is its own marker — the undo is a resolve too.
 *
 * WORDS (the contract's vocabulary, version 2). A word names a MECHANISM FAMILY, the way DESIGN §6
 * groups them; the payload's `kind` names the exact record. A consumer keys on either.
 */

/**
 * The vocabulary — closed; a new word is a contract change (events.js MOMENT_CONTRACT bumps).
 *   maneuver       a Combat Superiority die resolved (the hit menu, Parry, Precision, Riposte,
 *                  Commander's Strike, the Bonus Action maneuvers and their rides)
 *   sneak          Sneak Attack's dice rode a hit, with the Cunning Strike picks
 *   fold           a die or reroll folded into a d20 test (Bardic, Heroic, Tactical, Seeking;
 *                  Precision also, being a die on an attack), and Tactical Mind's refund
 *   rider          a clock rider's damage rode a hit (Dreadful Strike, Divine Strike, …)
 *   hold-answered  a held roll's reaction was answered — cast OR passed (`details.answer`)
 *   mastery        a weapon mastery's ask resolved (Vex, Sap, Slow, Topple, Push, Graze, Cleave)
 *   shield         a damage shield struck back, or was raised (Fire Shield, Death Armor, Agathys)
 *   spend          a chip, a pool or a resource was consumed (a Vex chip, a Sorcery Point, a use)
 *   damage         a damage receipt landed on a target — or was reverted
 *   effect         an effect receipt landed on a target — or was reverted
 *   save           a demanded save's verdict landed (the saves machine, Topple, concentration)
 *   break          concentration was broken
 *   use            a feature's use taken through a Battle Flow window (Shield Master's bash)
 *   cast           a cast the module drove (a bare damage spell's dice)
 *   volley         a volley's darts or rays were assigned and fired
 *   choice         a choice answered in a Battle Flow window that is none of the above
 *                  (an emanation's damage type, a cast's alternative effect, a save's option)
 *   metamagic      a Metamagic option resolved on the spell's card (the pick, Empowered's reroll)
 */
export const MOMENT_WORDS = Object.freeze([
  "maneuver", "sneak", "fold", "rider", "hold-answered", "mastery", "shield", "spend", "damage",
  "effect", "save", "break", "use", "cast", "volley", "choice", "metamagic"
]);

/* --- small readers, shared by the rows ------------------------------------------------------- */

/**
 * The shapes, once (the comments check wants a doc block on a declaration, so they sit on the
 * first one — decide/demand.js's precedent).
 *
 * @typedef {{ uuid: string|null, name?: string|null, hit?: boolean }} TargetRow
 * @typedef {object} MomentFacts
 * @property {string|null} [actor]        who resolved it — an actor uuid
 * @property {string|null} [item]         the feature or spell — an item uuid (or null and `itemName`)
 * @property {string|null} [itemName]     the feature's name when only the name is known; the spine
 *                                        resolves it on the actor's sheet
 * @property {string|null} [activity]     its activity uuid, when known
 * @property {string|null} [ability]      the feature's name as the card says it
 * @property {string|null} [attackId]     the attack message it rode, when there is one
 * @property {TargetRow[]|null} [targets] the creatures the moment is about
 * @property {"attack"|null} [targetsFrom] `"attack"`: the spine reads the attack's hit targets
 * @property {object|object[]|null} [spend] the pool spend in the uniform row shape
 * @property {object} [details]           event-specific plain facts
 * @typedef {object} ResolvedMoment
 * @property {string} marker              stable within the record — publish once per marker
 * @property {string[]} events            the word(s) this resolve publishes under
 * @property {MomentFacts} facts
 * @property {string|null} [publisher]    a user id that should publish instead of the writer
 * @typedef {object} MomentCtx
 * @property {string|null} messageId
 * @property {string|null} itemUuid       the item a usage card names (flags.dnd5e.item.uuid)
 * @property {string|null} activityUuid   the activity it names
 * @property {string|null} actorUuid      the message's speaker actor
 * @typedef {object} MomentRecordRow
 * @property {string[]} events            the default word(s); a resolve may override
 * @property {string} means               one sentence — what resolving means for this key
 * @property {(record: any, ctx: MomentCtx) => ResolvedMoment[]} resolved
 *
 * An embedded item's uuid from its owner and id, or null.
 */
const itemUuid = (actorUuid, itemId) => (actorUuid && itemId) ? `${actorUuid}.Item.${itemId}` : null;
/** An activity's uuid from its item's uuid and id, or null. */
const activityUuid = (item, activityId) => (item && activityId) ? `${item}.Activity.${activityId}` : null;
/** A target row from a record entry carrying `uuid` and `name`. */
const row = (t, hit) => ({ uuid: t?.uuid ?? null, name: t?.name ?? null, ...((typeof hit === "boolean") ? { hit } : {}) });
/** The stat stamp's source — who the record says resolved it. */
const source = record => record?.sourceUuid ?? null;
/** A volley's assignment as target rows — the shape is the machine's (a list of `{ uuid, name }` per dart, or a map). */
const volleyTargets = a => Array.isArray(a) ? [...new Map(a.filter(t => t?.uuid).map(t => [t.uuid, row(t)])).values()]
  : Object.keys(a ?? {}).map(uuid => ({ uuid, name: null }));
/** One resolved moment, whole-record shape. */
const whole = (events, facts, publisher = null) => [{ marker: "message", events, facts, ...(publisher ? { publisher } : {}) }];

/* --- the rows ---------------------------------------------------------------------------------- */

/** @type {Readonly<Record<string, MomentRecordRow>>} */
export const MOMENT_RECORDS = Object.freeze({

  /* maneuver ----------------------------------------------------------------------------------- */

  hitManeuver: {
    events: ["maneuver"],
    means: "a Combat Superiority die from the hit menu rode the damage roll (hit-menu.js); the record arrives resolved on the damage message",
    resolved: (r, ctx) => whole(["maneuver"], {
      actor: source(r) ?? ctx.actorUuid, item: r.itemUuid ?? null, ability: r.feature ?? null, attackId: r.attackId ?? null,
      targetsFrom: "attack", spend: r.poolSpend ?? null,
      details: { key: r.key ?? null, group: r.group ?? null, formula: r.formula ?? null, type: r.type ?? null,
        mode: r.mode ?? "ride", critical: !!r.attackRoll?.isCritical }
    })
  },

  commandRide: {
    events: ["maneuver"],
    means: "Commander's Strike's die rode the ally's attack damage (command.js); the record arrives resolved on the damage message",
    resolved: (r, ctx) => whole(["maneuver"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, ability: "Commander's Strike", attackId: null, targetsFrom: "attack",
      details: { formula: r.formula ?? null, type: r.type ?? null, directedBy: r.directedBy ?? null, weapon: r.weapon ?? null, cardId: r.cardId ?? null }
    })
  },

  superiorityRide: {
    events: ["maneuver"],
    means: "a Bonus Action maneuver's die (Lunging Attack, Feinting Attack) rode a later hit (superiority-uses.js); one resolve per die",
    resolved: (r, ctx) => (r?.rode ?? []).map((d, i) => ({
      marker: `${d.key ?? i}`, events: ["maneuver"],
      facts: { actor: source(r) ?? ctx.actorUuid, itemName: d.key ?? null, ability: d.key ?? null, attackId: r.attackId ?? null,
        targetsFrom: "attack", details: { key: d.key ?? null, formula: d.formula ?? null, type: d.type ?? null, why: d.why ?? null } }
    }))
  },

  superiorityUse: {
    events: ["maneuver"],
    means: "a Bonus Action maneuver's use landed its consequence — a rolled bonus, a chip, a marker (superiority-uses.js); on the use's own card",
    resolved: (r, ctx) => whole(["maneuver"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, ability: r.key ?? null,
      targets: r.target ? [{ uuid: null, name: r.target }] : [],
      details: { key: r.key ?? null, die: r.die ?? null, total: r.total ?? null, line: r.line ?? null }
    })
  },

  baitSwitch: {
    events: ["maneuver", "choice"],
    means: "Bait and Switch's AC bonus found its wearer — the fighter or the other creature (superiority-uses.js); resolved when `chosen` is set",
    resolved: (r, ctx) => r?.chosen ? whole(["maneuver", "choice"], {
      actor: source(r) ?? ctx.actorUuid, item: r.itemUuid ?? ctx.itemUuid, ability: "Bait and Switch",
      targets: [{ uuid: r.chosen, name: (r.options ?? []).find(o => o.uuid === r.chosen)?.name ?? null }],
      details: { key: r.key ?? null, total: r.total ?? null, effectName: r.effectName ?? null, chosen: r.chosen, timedOut: !!r.timedOut }
    }) : []
  },

  sweepCard: {
    events: ["maneuver"],
    means: "Sweeping Attack's second creature was picked and the die rolled at it (hit-menu.js); resolved when `resolved` is set",
    resolved: (r, ctx) => r?.resolved ? whole(["maneuver"], {
      actor: source(r) ?? ctx.actorUuid, ability: r.feature ?? "Sweeping Attack", attackId: r.attackId ?? null,
      targets: (r.chosen && (r.chosen !== "none")) ? [{ uuid: r.chosen, name: r.resolved?.name ?? null, hit: r.resolved?.verdict === "hit" }] : [],
      details: { chosen: r.chosen ?? null, rolled: r.resolved?.rolled ?? null, verdict: r.resolved?.verdict ?? null, none: !!r.resolved?.none,
        formula: r.formula ?? null, type: r.type ?? null, timedOut: !!r.timedOut }
    }) : []
  },

  precision: {
    events: ["maneuver", "fold"],
    means: "Precision Attack's offer on a missed attack was answered — the die spent or passed (precision.js); resolved when `status` is resolved",
    resolved: (r, ctx) => (r?.status === "resolved") ? whole(["maneuver", "fold"], {
      actor: r.attackerUuid ?? source(r) ?? ctx.actorUuid, item: itemUuid(r.attackerUuid, r.itemId),
      activity: activityUuid(itemUuid(r.attackerUuid, r.itemId), r.activityId), ability: r.itemName ?? "Precision Attack",
      attackId: ctx.messageId,
      targets: (r.targets ?? []).map(t => row(t, (t.verdict === "hit") ? true : (t.verdict === "miss") ? false : undefined)),
      details: { outcome: r.outcome ?? null, die: r.die ?? null, dieFormula: r.dieFormula ?? null, attackTotal: r.attackTotal ?? null, timedOut: !!r.timedOut }
    }) : []
  },

  riposte: {
    events: ["maneuver"],
    means: "Riposte's offer on an enemy's miss was answered by each reactor — strike back or decline (riposte.js); one resolve per reactor with an answer",
    resolved: (r, ctx) => (r?.reactors ?? []).filter(x => x.answer).map(x => ({
      marker: `${x.uuid}`, events: ["maneuver"],
      facts: { actor: x.uuid ?? null, item: itemUuid(x.uuid, x.itemId), activity: activityUuid(itemUuid(x.uuid, x.itemId), x.activityId),
        ability: x.itemName ?? "Riposte", attackId: ctx.messageId,
        targets: r.attackerUuid ? [{ uuid: r.attackerUuid, name: r.attackerName ?? null }] : [],
        details: { answer: x.answer, weapon: x.weaponName ?? null, dieFormula: x.dieFormula ?? null, timedOut: !!x.timedOut } }
    }))
  },

  /* sneak -------------------------------------------------------------------------------------- */

  sneakDamage: {
    events: ["sneak"],
    means: "Sneak Attack's dice rode the damage roll with the Cunning Strike picks (sneak.js); the record arrives resolved on the damage message",
    resolved: (r, ctx) => whole(["sneak"], {
      actor: source(r) ?? ctx.actorUuid, itemName: "Sneak Attack", ability: "Sneak Attack", attackId: r.attackId ?? null, targetsFrom: "attack",
      details: { dice: r.dice ?? null, formula: r.formula ?? null, cost: r.cost ?? 0, dc: r.dc ?? null, picks: (r.cunning ?? []).map(c => c.key) }
    })
  },

  /* fold --------------------------------------------------------------------------------------- */

  d20fold: {
    events: ["fold"],
    means: "a d20 fold — Bardic, Heroic, Tactical, Seeking — was spent into a test, or the offer was passed (d20-folds.js); one resolve per settled spend, one for a pass",
    resolved: (r, ctx) => {
      const out = [];
      const actor = r?.actorUuid ?? source(r) ?? ctx.actorUuid;
      (r?.spends ?? []).forEach((s, i) => {
        if ( s.pendingVerdict ) return;   // the dice are still in the air — the verdict write settles it
        out.push({ marker: `spend:${i}`, events: ["fold"],
          facts: { actor, itemName: s.name ?? null, ability: s.name ?? s.label ?? null,
            details: { kind: s.kind ?? null, testKind: r.testKind ?? null, skill: r.skill ?? null, die: s.die ?? null, reroll: s.reroll ?? null,
              baseTotal: r.baseTotal ?? null, foldedTotal: r.foldedTotal ?? null, dc: r.dc ?? null } } });
      });
      if ( (r?.status === "resolved") && (r?.outcome === "passed") ) {
        out.push({ marker: "passed", events: ["fold"],
          facts: { actor, details: { outcome: "passed", testKind: r.testKind ?? null, baseTotal: r.baseTotal ?? null, timedOut: !!r.timedOut } } });
      }
      return out;
    }
  },

  tacticalRefund: {
    events: ["fold"],
    means: "Tactical Mind's refund was asked and answered — kept or refunded (d20-folds.js); resolved when `status` leaves pending",
    resolved: (r, ctx) => ((r?.status === "kept") || (r?.status === "refunded")) ? whole(["fold"], {
      actor: r.actorUuid ?? ctx.actorUuid, itemName: r.name ?? null, ability: r.name ?? null,
      details: { outcome: r.status, poolName: r.poolName ?? null, poolUuid: r.poolUuid ?? null }
    }) : []
  },

  /* rider -------------------------------------------------------------------------------------- */

  clockRiders: {
    events: ["rider"],
    means: "a clock rider's damage rode a hit — Dreadful Strike, Divine Strike, Primal Strike, Divine Fury, Assassinate (clock-riders.js); one resolve per rider",
    resolved: (r, ctx) => (r?.riders ?? []).map((d, i) => ({
      marker: `${d.key ?? i}`, events: ["rider"],
      facts: { actor: source(r) ?? ctx.actorUuid, itemName: d.label ?? null, ability: d.label ?? null, attackId: r.attackId ?? null, targetsFrom: "attack",
        details: { key: d.key ?? null, formula: d.formula ?? null, type: d.type ?? null, why: d.why ?? null, usesLeft: d.usesLeft ?? null } }
    }))
  },

  /* hold-answered ------------------------------------------------------------------------------ */

  hold: {
    events: ["hold-answered"],
    means: "a held roll's reaction was answered by its target — cast or pass (hold/answer.js, hold/clock.js); one resolve per target with an answer. Parry's die publishes under maneuver too",
    resolved: (r, ctx) => (r?.targets ?? []).filter(t => t.answer).map(t => {
      const item = itemUuid(t.uuid, t.itemId);
      return {
        marker: `${t.uuid}`,
        events: t.poolSpend ? ["hold-answered", "maneuver"] : ["hold-answered"],
        // The answerer's client, when the write was the elect's (a relayed answer) — the picture
        // fired there before this gate existed, and still does.
        publisher: t.answeredBy ?? null,
        facts: { actor: t.uuid ?? null, item, activity: activityUuid(item, t.activityId), ability: t.reaction ?? null, attackId: ctx.messageId,
          targets: source(r) ? [{ uuid: source(r), name: null }] : [], spend: t.poolSpend ?? null,
          details: { answer: t.answer, kind: t.kind ?? null, reduceBy: (Number(t.reduceBy) > 0) ? Number(t.reduceBy) : null,
            spell: r.spell ?? null, trigger: r.trigger ?? "attack", timedOut: !!t.timedOut,
            ...(t.poolSpend ? { formula: t.reduce?.formula ?? null, mode: "reduce" } : {}) } }
      };
    })
  },

  /* mastery ------------------------------------------------------------------------------------ */

  mastery: {
    events: ["mastery"],
    means: "a weapon mastery's ask was answered and executed — used or passed (mastery.js); resolved when `status` is done. On an ActiveEffect the same key is the chip's fingerprint, which no message carries",
    resolved: (r, ctx) => (r?.status === "done") ? whole(["mastery"], {
      actor: r.attackerUuid ?? source(r) ?? ctx.actorUuid, itemName: r.weapon?.name ?? null, ability: r.key ?? null, attackId: ctx.messageId,
      targets: (r.targets ?? []).map(t => row(t)),
      details: { key: r.key ?? null, outcome: r.outcome ?? null, answer: r.answer ?? null, weapon: r.weapon?.name ?? null, timedOut: !!r.timedOut }
    }) : []
  },

  /* shield ------------------------------------------------------------------------------------- */

  damageShield: {
    events: ["shield"],
    means: "a damage shield struck back at a melee attacker — its dice rolled on the defender's own message (damage-shields.js); arrives resolved",
    resolved: (r, ctx) => whole(["shield"], {
      actor: source(r) ?? ctx.actorUuid, itemName: r.key ?? null, ability: r.key ?? null, attackId: r.attackId ?? null,
      targets: r.attackerUuid ? [{ uuid: r.attackerUuid, name: r.attackerName ?? null, hit: true }] : [],
      details: { key: r.key ?? null, rolled: !!r.rolled, formula: r.formula ?? null, total: r.total ?? null, type: r.type ?? null,
        why: r.why ?? null, distanceFeet: r.distanceFeet ?? null, effectName: r.effectName ?? null, damageId: r.damageId ?? null }
    })
  },

  shieldMark: {
    events: ["shield"],
    means: "a damage shield was raised at the cast — the ward's effect on its bearer (damage-shields.js); on the cast's card",
    resolved: (r, ctx) => whole(["shield"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, ability: r.key ?? null,
      details: { key: r.key ?? null, raised: true, effectId: r.effectId ?? null, spellLevel: r.spellLevel ?? null }
    })
  },

  /* spend -------------------------------------------------------------------------------------- */

  poolSpend: {
    events: ["spend"],
    means: "a pool was spent by hand — Sorcery Points, a rider's uses, a Seeking Spell (the uniform record shared.js poolSpendsOn reads); one resolve per record",
    resolved: (r, ctx) => (Array.isArray(r) ? r : (r ? [r] : [])).map((s, i) => ({
      marker: `${s.pool ?? "pool"}|${s.at ?? i}`, events: ["spend"],
      facts: { actor: s.actorUuid ?? ctx.actorUuid, item: ctx.itemUuid, ability: s.ability ?? null, spend: s,
        details: { pool: s.pool ?? null, spent: Number(s.spent ?? 0), left: Number(s.left ?? 0), max: Number(s.max ?? 0) } }
    }))
  },

  chipSpend: {
    events: ["spend"],
    means: "an attack roll used a chip up — Vex, Sap, a listed effect's marker (chip-spend.js); one resolve per chip",
    resolved: (r, ctx) => (r?.spent ?? []).map(s => ({
      marker: `${s.id}`, events: ["spend"],
      facts: { actor: source(r) ?? ctx.actorUuid, ability: s.name ?? null, attackId: ctx.messageId,
        targets: s.bearerUuid ? [{ uuid: s.bearerUuid, name: s.bearerName ?? null }] : [],
        details: { key: s.key ?? null, effectId: s.id ?? null, mode: s.mode ?? null, net: s.net ?? null } }
    }))
  },

  useChip: {
    events: ["spend"],
    means: "a use-chip was written at a feature's use — Steady Aim and its class (use-chips.js); on the use's own card",
    resolved: (r, ctx) => whole(["spend"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, ability: r.name ?? null,
      details: { effectId: r.effectId ?? null, bend: r.bend ?? null, note: r.note ?? null }
    })
  },

  spend: {
    events: ["spend"],
    means: "a use's own resource movement was stamped for the flash — item uses, activity uses, spell slots (resources.js); on the usage card",
    resolved: (r, ctx) => whole(["spend"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid,
      details: { rows: r.rows ?? [], slots: r.slots ?? [] }
    })
  },

  /* damage ------------------------------------------------------------------------------------- */

  receipt: {
    events: ["damage"],
    means: "damage landed on a target with a receipt (auto-apply.js), or a receipt was reverted (receipts.js); one resolve per target, one more per revert",
    resolved: (r, ctx) => {
      const out = [];
      for ( const t of r?.targets ?? [] ) {
        const facts = { actor: t.sourceUuid ?? source(r) ?? ctx.actorUuid, targets: [{ uuid: t.uuid, name: t.name ?? null, hit: true }],
          details: { taken: t.taken ?? null, delta: t.delta ?? null, parts: t.parts ?? [], traits: t.traits ?? [], note: t.note ?? null,
            multiplier: t.multiplier ?? 1 } };
        out.push({ marker: `${t.uuid}`, events: ["damage"], facts });
        if ( t.reverted ) out.push({ marker: `${t.uuid}|reverted`, events: ["damage"], facts: { ...facts, details: { ...facts.details, reverted: true } } });
      }
      return out;
    }
  },

  /* effect ------------------------------------------------------------------------------------- */

  effectReceipt: {
    events: ["effect"],
    means: "an effect landed on a target with a receipt (effect-riders.js, mastery chips, the hold's reaction effect, the cast slice), or was reverted; one resolve per effect, one more per revert",
    resolved: (r, ctx) => {
      const out = [];
      for ( const t of r?.targets ?? [] ) {
        for ( const e of t.effects ?? [] ) {
          const facts = { actor: e.sourceUuid ?? source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, ability: e.name ?? null,
            targets: [{ uuid: t.uuid, name: t.name ?? null }], details: { effectId: e.id ?? null, name: e.name ?? null } };
          out.push({ marker: `${t.uuid}|${e.id}`, events: ["effect"], facts });
          if ( e.reverted ) out.push({ marker: `${t.uuid}|${e.id}|reverted`, events: ["effect"], facts: { ...facts, details: { ...facts.details, reverted: true } } });
        }
      }
      return out;
    }
  },

  /* save --------------------------------------------------------------------------------------- */

  saves: {
    events: ["save"],
    means: "a demanded save's verdict landed for a target (saves/verdict.js) — rolled, timed out or auto-failed; one resolve per target done, and one per save-side choice answered (publishes choice)",
    resolved: (r, ctx) => {
      const out = [];
      for ( const t of r?.targets ?? [] ) {
        if ( t.done ) out.push({ marker: `${t.uuid}`, events: ["save"],
          facts: { actor: t.uuid ?? null, item: ctx.itemUuid ?? null, activity: r.activityUuid ?? ctx.activityUuid, ability: r.item?.name ?? null,
            targets: [], details: { outcome: t.outcome ?? null, total: t.total ?? null, dc: r.dc ?? null, abilities: r.abilities ?? [],
              autoFailed: !!t.autoFailed, autoFailedBy: t.autoFailedBy ?? null, timedOut: !!t.timedOut, casterUuid: source(r), casterName: r.casterName ?? null,
              damageOnSave: r.damageOnSave ?? null, rollMessageId: t.rollMessageId ?? null } } });
        // The save-side choice is the ATTACKER's (Shield Master's push on a failed save): the chooser
        // is the spec's subject, the saver its target.
        if ( t.choice?.answer ) out.push({ marker: `${t.uuid}|choice`, events: ["choice"],
          facts: { actor: t.choice.subjectUuid ?? null, itemName: t.choice.itemName ?? null, ability: t.choice.itemName ?? null,
            targets: [{ uuid: t.uuid, name: t.name ?? null }],
            details: { answer: t.choice.answer, kind: t.choice.kind ?? null, timedOut: !!t.choice.timedOut } } });
      }
      return out;
    }
  },

  topple: {
    events: ["save"],
    means: "a Topple save's verdict landed for a target — saved, prone, or failed before the dice (topple.js); one resolve per target done",
    resolved: (r, ctx) => (r?.targets ?? []).filter(t => t.done).map(t => ({
      marker: `${t.uuid}`, events: ["save"],
      facts: { actor: t.uuid ?? null, ability: "Topple", attackId: ctx.messageId, targets: [],
        details: { outcome: t.outcome ?? null, total: t.total ?? null, dc: r.dc ?? null, ability: r.ability ?? null, applied: !!t.applied,
          timedOut: !!t.timedOut, attackerUuid: r.attackerUuid ?? source(r) } }
    }))
  },

  concentration: {
    events: ["save", "break"],
    means: "a concentration save's verdict landed (concentration.js) — and the concentration broke when it failed (publishes break beside save); resolved when `outcome` is set",
    resolved: (r, ctx) => (r?.status === "done") && r?.outcome ? [{
      marker: "verdict",
      events: r.outcome.voided ? ["save"] : (r.outcome.success ? ["save"] : ["save", "break"]),
      facts: { actor: r.actorUuid ?? source(r) ?? ctx.actorUuid, ability: "Concentration", targets: [],
        details: { success: !!r.outcome.success, total: r.outcome.total ?? null, dc: r.dc ?? null, names: r.names ?? [], damage: r.damage ?? null,
          timedOut: !!r.outcome.timedOut, voided: !!r.outcome.voided, rollMessageId: r.outcome.rollMessageId ?? null } }
    }] : []
  },

  /* use ---------------------------------------------------------------------------------------- */

  bashOffer: {
    events: ["use"],
    means: "Shield Master's bash offer on a melee hit was answered — bashed or passed (bash-offer.js); resolved when `status` is resolved",
    resolved: (r, ctx) => (r?.status === "resolved") ? whole(["use"], {
      actor: r.attackerUuid ?? source(r) ?? ctx.actorUuid, item: itemUuid(r.attackerUuid, r.itemId),
      activity: activityUuid(itemUuid(r.attackerUuid, r.itemId), r.activityId), ability: r.itemName ?? "Shield Master", attackId: ctx.messageId,
      targets: r.targetUuid ? [{ uuid: r.targetUuid, name: (r.targets ?? []).find(t => t.uuid === r.targetUuid)?.name ?? null }] : (r.targets ?? []).map(t => row(t)),
      details: { answer: r.answer ?? null, timedOut: !!r.timedOut }
    }) : []
  },

  /* cast --------------------------------------------------------------------------------------- */

  damageCast: {
    events: ["cast"],
    means: "a bare damage spell's dice were rolled by the module at its targets — Heat Metal's class (damage-casts.js); on the cast's card",
    resolved: (r, ctx) => whole(["cast"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, ability: r.key ?? null,
      details: { activity: r.activity ?? null, scaling: r.scaling ?? 0, save: r.save ?? null, key: r.key ?? null }
    })
  },

  /* volley ------------------------------------------------------------------------------------- */

  volley: {
    events: ["volley"],
    means: "a volley's darts or rays were assigned and fired (volleys.js); resolved when `status` is resolved",
    resolved: (r, ctx) => (r?.status === "resolved") ? whole(["volley"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid,
      targets: volleyTargets(r.assignment),
      details: { kind: r.kind ?? null, n: r.n ?? null, assignment: r.assignment ?? null }
    }) : []
  },

  /* choice ------------------------------------------------------------------------------------- */

  emanationCard: {
    events: ["choice"],
    means: "an emanation's damage type was chosen by its caster (emanations.js); resolved when `chosen` is set",
    resolved: (r, ctx) => r?.chosen ? whole(["choice"], {
      actor: source(r) ?? ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, ability: r.item?.name ?? r.name ?? null,
      details: { type: r.damageType ?? null, why: r.damageWhy ?? null }
    }) : []
  },

  castApply: {
    events: ["choice"],
    means: "a cast's alternative effect was chosen — Fire Shield's warm or chill (cast.js); resolved when `choice.chosen` is set. The application itself is the effect receipt's resolve",
    resolved: (r, ctx) => r?.choice?.chosen ? whole(["choice"], {
      actor: ctx.actorUuid, item: ctx.itemUuid, activity: r.activityUuid ?? ctx.activityUuid,
      targets: (r.targets ?? []).map(t => row(t)),
      details: { chosen: r.choice.chosen, options: r.choice.options ?? [] }
    }) : []
  },

  /* metamagic ---------------------------------------------------------------------------------- */

  metamagic: {
    events: ["metamagic"],
    means: "a Metamagic option was applied to the cast and its points spent (metamagic.js); resolved when `spent` is set on the spell's card",
    resolved: (r, ctx) => r?.spent ? whole(["metamagic"], {
      actor: ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, itemName: r.feature ?? null, ability: r.feature ?? null,
      details: { key: r.key ?? null, feature: r.feature ?? null, cost: r.cost ?? null, ...(r.type ? { type: r.type } : {}) }
    }) : []
  },

  empowered: {
    events: ["metamagic"],
    means: "Empowered Spell's reroll was taken — the picked dice rerolled, the point spent (metamagic.js); resolved when `status` is used",
    resolved: (r, ctx) => (r?.status === "used") ? whole(["metamagic"], {
      actor: ctx.actorUuid, item: ctx.itemUuid, activity: ctx.activityUuid, itemName: "Empowered Spell", ability: "Empowered Spell",
      details: { picks: r.picks ?? [], newTotal: r.newTotal ?? null, delta: r.delta ?? null }
    }) : []
  }
});

/**
 * EVERY OTHER KEY THE MODULE WRITES, and why it is state rather than a resolve. The checker
 * (tools/check-moments.mjs) fails on a key in neither list — and on a key in both, and on a row
 * here whose key nothing writes any more. ⚠ A reason is a sentence somebody will read; "misc"
 * is how this list becomes a dumping ground, and the checker refuses reasons under 20 characters.
 */
export const STATE_KEYS = Object.freeze({
  // the hold's lifecycle and provenance
  attackFor: "provenance — the attack a damage roll answers (auto-damage.js)",
  attackHoldPending: "the offer is waiting on a hold; the hold's answer is the resolve",
  autoCrit: "provenance — the crit was auto-applied to the damage config",
  damageOffer: "the offer window's own state (open, answered); the die it offers resolves as hitManeuver, clockRiders, sneakDamage",
  spellHoldPending: "the spell's damage is waiting on a hold; the hold's answer is the resolve",
  holdSkipped: "a hopeless hold skipped in silence — a stat, never presented",
  reactionEffect: "an ActiveEffect's fingerprint — the reaction's own effect on the reactor; its landing is the effect receipt's resolve",
  applied: "an ActiveEffect's fingerprint — written by the module's applier; its landing is the effect receipt's resolve",
  // envelopes — a player's answer travelling as their own message for the elect to fold (the relay)
  respondsTo: "an envelope — the card this message answers; the fold onto that card is the resolve",
  uuid: "an envelope field beside respondsTo — which target answered",
  answer: "an envelope field beside respondsTo — what was answered",
  ac: "an envelope field beside respondsTo — the AC the reaction produced",
  effectLanded: "an envelope field beside respondsTo — whether the reaction's effect had arrived",
  reduceBy: "an envelope field beside respondsTo — Parry's roll, carried to the fold",
  sweepAnswer: "an envelope — the sweep's pick; the fold onto sweepCard is the resolve",
  saveChoiceAnswer: "an envelope — a save-side choice; the fold onto the saves flag is the resolve",
  riposteAnswer: "an envelope — a reactor's answer; the fold onto the riposte flag is the resolve",
  emanationTypeAnswer: "an envelope — the caster's type pick; the fold onto emanationCard is the resolve",
  momentAck: "an envelope — a notice acknowledged; presentation, not a moment",
  // arms, picks and provenance before the resolve
  hitPick: "the hit menu's pick before the die rolls; hitManeuver on the damage message is the resolve",
  hitManeuverCard: "the follow-up save card the hit menu drove; its effects land as effect receipts and its verdicts as saves",
  cunning: "the Cunning Strike picks armed on the attack; sneakDamage on the damage message is the resolve",
  sneak: "the Sneak Attack arm on the attack (and rolled:true after); sneakDamage is the resolve",
  clockPick: "the offer's rider picks before the die rolls; clockRiders on the damage message is the resolve",
  lungePick: "Lunging Attack's tick on the offer; superiorityRide is the resolve",
  foldSpend: "provenance — a fold's use() is the rescue's spend, so the arming hook stands aside",
  tacticalArmed: "Tactical Assessment or Ambush armed from the sheet (its own card); the fold into the check is the d20fold resolve",
  bashFor: "provenance — the driven bash's usage card names the offer it answers",
  bashUsed: "an actor flag — the once-per-turn stamp; bashOffer is the resolve",
  riposteUse: "provenance — the maneuver's use names the riposte it answers",
  riposteFor: "provenance — the driven attack names the riposte it answers",
  riposteBy: "provenance — the driven attack names the reactor",
  command: "Commander's Strike directed at an ally — the notice and the chip; the die riding the ally's attack (commandRide) is the resolve, and the use posted its own card",
  reminder: "a gate's reminder record — presentation before the roll",
  volleyFor: "provenance — a volley's roll names its card",
  volleyTarget: "provenance — a volley's roll names its target",
  volleyDarts: "provenance — a volley's roll names its dart count",
  volleyRay: "provenance — a volley's roll names its ray",
  savesDeferredRoll: "the caster's deferred damage roll while the saves are pending; the verdicts are the resolve",
  saveAutoFail: "the Fails press on the roll message; the verdict on the saves flag is the resolve",
  verdictLine: "the verdict's own card line — a view",
  damageSaveCard: "the save card a damage cast drove; its verdicts land on the saves flag",
  damageShields: "the shield judgement's claim on the damage message (paid, judged) — a latch; damageShield on the ward's roll is the resolve",
  shield: "an ActiveEffect's fingerprint — the standing ward; shieldMark is its raising and damageShield its strike",
  shieldEnded: "a notice — Armor of Agathys ended with its pool; presentation",
  emanationType: "the type set on an emanation's damage roll; the choice on emanationCard is the resolve",
  emanationHeal: "a button on the emanation's card — the heal's use posts its own card",
  emanationRemind: "a reminder on the emanation's card — presentation",
  metamagicAsk: "a Metamagic question pending on the card; the metamagic record's `spent` is the resolve",
  metamagicDeferred: "the held card's data while Careful asks; the real card's records are the resolves",
  metamagicType: "the type Transmuted Spell set on the damage roll; the metamagic record on the card is the resolve",
  healPending: "a heal claimed at creation for the elect to apply; the receipt is the resolve",
  masteryNotice: "a mastery reminder — presentation",
  cleaveArm: "Cleave armed for the extra attack; that attack is a real roll with its own card",
  cleaveStripped: "provenance — the armed Cleave's second attack shed its riders",
  timedOut: "the buzzer's mark on a roll it made; the verdict it lands is the resolve",
  hewNotice: "Hew's reminder card — presentation",
  hewNoticed: "the reminder's once-per-swing latch — presentation",
  rollCtx: "the data plane's roll context stamp — stats, never a moment",
  combatRoster: "the data plane's turn→actor map — stats, never a moment",
  // effect fingerprint fields (the chips), never on a message
  useKey: "an ActiveEffect field — which use-chip this is",
  die: "an ActiveEffect field — the die a chip carries",
  sourceUuid: "an ActiveEffect field (and every record's stat stamp) — who wrote it",
  sourceName: "an ActiveEffect field — who wrote it, by name",
  cardId: "an ActiveEffect field — the card that wrote it",
  riderKey: "an ActiveEffect field — which rider's turn chit this is",
  armed: "an ActiveEffect field — a scoped fold armed from the sheet (the die, its skills); the fold into the check is the d20fold resolve",
  // region and template fingerprints (emanations.js), never on a message
  emanation: "a Region's or template's fingerprint — the aura's kind, key, source token and who stood inside at the cast",
  emanationTrigger: "the demand card an emanation's region raised on a creature — beside the saves record, which is the resolve",
  saveFor: "an envelope field beside respondsTo — the saves channel's target uuid"
});

/* --- the pure operations the spine and the tests share ---------------------------------------- */

/**
 * Every resolved moment in one record, or [] when the key is not registered or the record is
 * empty. A row that throws is a row with a bug, and the caller decides how loud to be.
 * @param {string} key
 * @param {any} record
 * @param {MomentCtx} ctx
 * @returns {ResolvedMoment[]}
 */
export function resolvedMoments(key, record, ctx) {
  const rowDef = MOMENT_RECORDS[key];
  if ( !rowDef || (record === null) || (record === undefined) ) return [];
  return rowDef.resolved(record, ctx) ?? [];
}

/**
 * The latch id of one resolve — what the spine remembers so a marker publishes once per client.
 * @param {string|null} messageId
 * @param {string} key
 * @param {string} marker
 */
export const momentId = (messageId, key, marker) => `${messageId ?? "?"}|${key}|${marker}`;

/**
 * The resolves not yet in the latch, in record order. Pure: the caller adds them to the latch
 * after publishing (or after deciding not to — a client that is not the publisher still remembers).
 * @param {string|null} messageId
 * @param {string} key
 * @param {ResolvedMoment[]} moments
 * @param {Set<string>} latch
 */
export function newMoments(messageId, key, moments, latch) {
  return moments.filter(m => !latch.has(momentId(messageId, key, m.marker)));
}

/** Is this word in the vocabulary? */
export const isMomentWord = word => MOMENT_WORDS.includes(word);

/** The record keys, for the contract's `kinds`. */
export const MOMENT_KINDS = Object.freeze(Object.keys(MOMENT_RECORDS));
