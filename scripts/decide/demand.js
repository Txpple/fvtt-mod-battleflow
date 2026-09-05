// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): which pending DEMAND a roll answers.
 *
 * The machine-tier pass, Stage 2 (2026-09-05). Three machines demand a saving throw of a
 * creature — concentration (its ask card), saves (the demand card), the Topple fold (the mastery
 * card) — and each had its own recognizer for "does this roll answer me": the module's own
 * `respondsTo` stamp, a roll chained to the card (`originatingMessage`), or a BARE sheet roll
 * matched by actor and ability. The bare branch is the one that couples them: a bare roll can
 * answer only one demand, so each recognizer checked the others' flags BY STRING in a fixed
 * order the comments called ship order. **This module is that order, written once, over plain
 * data** — no `game`, no messages, no flags read; the spine hands it the facts and the cards.
 *
 * ⚠ RULING 1 (2026-09-05): the ship order is KEPT as an explicit `priority` on each spec —
 * concentration, then saves, then Topple — byte-identical to the three recognizers it replaces.
 * Oldest-pending-first across machines stays one field away if a table ever wants it.
 *
 * ⚠ THE BYTES ON THE WIRE DO NOT CHANGE. `respondsTo` keeps every one of its meanings (§4's
 * table); this module unifies the READER. An answer in flight across a deploy keeps folding.
 *
 * Also here, because the same finding named them: the saves flag's two constructors
 * (`saveDemandData`, `saveTargetEntry`) — emanations.js wrote a complete copy of that shape by
 * hand — and the verdict reader (`verdictsOn`) the hit menu and Sneak Attack read outcomes
 * through.
 */

/**
 * The shapes, once (the comments check wants a doc block on a declaration, so they sit on the
 * first one):
 *
 * @typedef {object} RollFacts
 * @property {string | null} respondsTo        the module's own answer stamp — the card id
 * @property {string | null} saveFor           the saves channel's target uuid, beside respondsTo
 * @property {string | null} originatingMessage the system's chain — the card the roll was pressed on
 * @property {string | null} actorUuid         who rolled
 * @property {string | null} ability           which ability
 * @property {string | null} rollType          the system's roll type (`save`, `concentration`, …)
 *
 * @typedef {object} DemandCard
 * @property {string} id
 * @property {Record<string, any>} flags       the registered flag keys this card carries
 *
 * @typedef {object} DemandSpec
 * @property {string} flagKey
 * @property {number} priority                 lower answers a bare roll first
 * @property {((flag: any, facts: RollFacts) => any) | null} answering
 *   the entry a `respondsTo` roll answers on THIS flag, or null — null on the spec means the
 *   machine never accepts a stamped roll as its answer (Topple's 2026-08-18 finding ④)
 * @property {boolean} chained                 may a roll chained to the card answer it
 * @property {(flag: any, facts: RollFacts) => any} pendingEntry
 *   the undone entry THIS ROLL would answer, judged on the flag alone, or null — the roll's
 *   type and ability are the spec's to gate on
 * @property {(flag: any, actorUuid: string) => any} pendingFor
 *   the undone entry naming this actor, with NO roll in hand — "is this creature mid-answer"
 *
 * @typedef {object} DemandMatch
 * @property {string} cardId
 * @property {any} entry
 */
const byPriority = (/** @type {DemandSpec[]} */ specs) => [...specs].sort((a, b) => a.priority - b.priority);

/**
 * Which demand this roll answers, and on which card(s).
 *
 * 1. A stamped roll (`respondsTo`) answers exactly the card it names, on whichever registered
 *    flag that card carries and accepts it — a stamp pointing at another machine's card is
 *    another machine's channel and answers nothing here.
 * 2. A chained roll (`originatingMessage`) answers the card it chains to, or nothing: a save
 *    chained to any other message belongs to that chain.
 * 3. A bare roll answers the highest-priority machine with a pending entry for this actor and
 *    ability, and EVERY such card of that machine, oldest first — the caller claims the first
 *    and walks on only when another fold beat it to the entry (the Topple loop).
 *
 * @param {RollFacts} facts
 * @param {DemandCard[]} cards  oldest first
 * @param {DemandSpec[]} specs
 * @returns {{ flagKey: string, matches: DemandMatch[] } | null}
 */
export function resolveDemand(facts, cards, specs) {
  const ordered = byPriority(specs);
  if ( facts.respondsTo ) {
    const card = cards.find(c => c.id === facts.respondsTo);
    if ( !card ) return null;
    for ( const spec of ordered ) {
      const flag = card.flags[spec.flagKey];
      if ( !flag || !spec.answering ) continue;
      const entry = spec.answering(flag, facts);
      if ( entry ) return { flagKey: spec.flagKey, matches: [{ cardId: card.id, entry }] };
    }
    return null;
  }
  if ( facts.originatingMessage ) {
    const card = cards.find(c => c.id === facts.originatingMessage);
    if ( !card ) return null;
    for ( const spec of ordered ) {
      const flag = card.flags[spec.flagKey];
      if ( !flag || !spec.chained ) continue;
      const entry = spec.pendingEntry(flag, facts);
      if ( entry ) return { flagKey: spec.flagKey, matches: [{ cardId: card.id, entry }] };
    }
    return null;
  }
  if ( !facts.actorUuid ) return null;
  for ( const spec of ordered ) {
    const matches = [];
    for ( const card of cards ) {
      const flag = card.flags[spec.flagKey];
      if ( !flag ) continue;
      const entry = spec.pendingEntry(flag, facts);
      if ( entry ) matches.push({ cardId: card.id, entry });
    }
    if ( matches.length ) return { flagKey: spec.flagKey, matches };
  }
  return null;
}

/**
 * Every pending demand naming this actor, oldest first — "is this creature mid-answer", asked
 * without a roll in hand (the d20 folds stand aside on a demanded save; the save gate reads the
 * demand's facet). Judged by each spec's own `pendingFor`, which knows no roll.
 *
 * @param {string} actorUuid
 * @param {DemandCard[]} cards  oldest first
 * @param {DemandSpec[]} specs
 * @param {{ flagKey?: string | null }} [opts]  one machine's demands only
 * @returns {Array<{ flagKey: string, cardId: string, entry: any }>}
 */
export function pendingDemands(actorUuid, cards, specs, { flagKey = null } = {}) {
  const out = [];
  for ( const card of cards ) {
    for ( const spec of byPriority(specs) ) {
      if ( flagKey && (spec.flagKey !== flagKey) ) continue;
      const flag = card.flags[spec.flagKey];
      if ( !flag ) continue;
      const entry = spec.pendingFor(flag, actorUuid);
      if ( entry ) out.push({ flagKey: spec.flagKey, cardId: card.id, entry });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * THE SAVES FLAG — its two constructors and its verdict reader.
 *
 * The shape is saves.js's (`stampSaveDemand`, ARCHITECTURE §4's table). emanations.js wrote a
 * complete copy by hand for its trigger card; the field order here is the order both wrote,
 * so a stamped card reads the same before and after this module existed.
 * ------------------------------------------------------------------------------------------- */

/** One target's entry — per-target state is an ARRAY with uuid fields, never a uuid-keyed map. */
export function saveTargetEntry(uuid, name) {
  return { uuid, name, done: false, outcome: null, total: null, rollMessageId: null };
}

/**
 * The demand flag. `stat` is the data-plane stamp (`statContext`), spread where it always was;
 * `window` and `deadline` are the caller's — this layer has no clock. Optional facets appear
 * only when given, so a card that never carried one still does not.
 *
 * @param {object} d
 * @param {string} [d.status]
 * @param {object} d.stat
 * @param {string[]} d.abilities
 * @param {number} d.dc
 * @param {string} d.damageOnSave
 * @param {boolean} d.hasDamage
 * @param {{ fail: string[], always: string[] }} d.effectNames
 * @param {{ spell: boolean, statuses: string[] } | null} [d.demand]
 * @param {string | null} [d.effectsHandled]
 * @param {boolean} [d.pinnedTargets]
 * @param {string} d.activityUuid
 * @param {string | null} [d.templateType]
 * @param {boolean} [d.templated]
 * @param {boolean} [d.awaitingTemplate]
 * @param {string | null} [d.durationUnits]
 * @param {{ name: string, img: string | null }} d.item
 * @param {string | null} [d.casterName]
 * @param {number | null} [d.scaling]
 * @param {number} [d.window]
 * @param {number | null} [d.deadline]
 * @param {object[]} d.targets
 */
export function saveDemandData({ status = "pending", stat, abilities, dc, damageOnSave, hasDamage, effectNames,
  demand = null, effectsHandled = null, pinnedTargets = false, activityUuid, templateType = null, templated = false,
  awaitingTemplate = false, durationUnits = null, item, casterName = null, scaling = null, window = 0, deadline = null,
  targets }) {
  return {
    status, ...stat,
    abilities, dc, damageOnSave, hasDamage, effectNames,
    ...(demand ? { demand } : {}),
    ...(effectsHandled ? { effectsHandled } : {}),
    ...(pinnedTargets ? { pinnedTargets: true } : {}),
    activityUuid, templateType, templated,
    ...(awaitingTemplate ? { awaitingTemplate: true } : {}),
    durationUnits, item, casterName,
    ...((scaling !== null) ? { scaling } : {}),
    ...(window ? { window } : {}),
    ...((deadline !== null) ? { deadline } : {}),
    targets
  };
}

/**
 * The verdicts a demand card carries — every target that has answered, with what it rolled and
 * how it went. A follow-up keyed on failure (the hit menu's effect, Cunning Strike's) reads
 * these and never the array's shape.
 *
 * @param {any} flag  the saves flag, or nothing
 * @returns {Array<{ uuid: string, name: string, outcome: string | null, total: number | null }>}
 */
export function verdictsOn(flag) {
  return (flag?.targets ?? []).filter(t => t.done)
    .map(t => ({ uuid: t.uuid, name: t.name, outcome: t.outcome ?? null, total: t.total ?? null }));
}
