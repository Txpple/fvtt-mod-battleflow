// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): which pending DEMAND a roll answers, by its
 * `respondsTo` stamp, its chain, or bare by actor and ability. A bare roll answers one machine, by
 * `priority`: concentration, then saves, then Topple. Also the saves flag's constructors and reader.
 */

/**
 * @typedef {object} RollFacts
 * @property {string | null} respondsTo        the module's answer stamp — the card id
 * @property {string | null} saveFor           the saves channel's target uuid
 * @property {string | null} originatingMessage the card the roll was pressed on
 * @property {string | null} actorUuid
 * @property {string | null} ability
 * @property {string | null} rollType          decide/card.js `rollKindOf`
 * @property {string | null} [saveKind]         `ability` | `concentration` | `death` on a save
 *
 * @typedef {object} DemandCard
 * @property {string} id
 * @property {Record<string, any>} flags
 *
 * @typedef {object} DemandSpec
 * @property {string} flagKey
 * @property {number} priority                 lower answers a bare roll first
 * @property {((flag: any, facts: RollFacts) => any) | null} answering  null: never accepts a stamped roll
 * @property {boolean} chained                 may a roll chained to the card answer it
 * @property {(flag: any, facts: RollFacts) => any} pendingEntry  the undone entry THIS ROLL would answer
 * @property {(flag: any, actorUuid: string) => any} pendingFor    the undone entry naming this actor, no roll in hand
 *
 * @typedef {object} DemandMatch
 * @property {string} cardId
 * @property {any} entry
 */
const byPriority = (/** @type {DemandSpec[]} */ specs) => [...specs].sort((a, b) => a.priority - b.priority);

/**
 * A stamped or chained roll answers exactly its card, or nothing. A bare roll answers the top-priority
 * machine with a pending entry: every such card, oldest first; the caller claims the first it can.
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
 * Every pending demand naming this actor, oldest first, with no roll in hand.
 * @param {string} actorUuid
 * @param {DemandCard[]} cards
 * @param {DemandSpec[]} specs
 * @param {{ flagKey?: string | null }} [opts]
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

/* --- THE SAVES FLAG (ARCHITECTURE §4) ------------------------------------------------------------ */

/** Per-target state is an ARRAY with uuid fields, never a uuid-keyed map. */
export function saveTargetEntry(uuid, name) {
  return { uuid, name, done: false, outcome: null, total: null, rollMessageId: null };
}

/**
 * The demand flag; optional facets appear only when given. `stat` is `statContext`.
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
 * Does this demand put its target to sleep (Trance)? A word match, never a list of spells.
 * @param {{itemName?: string|null, effectNames?: (string|null|undefined)[]}} facts
 */
export function putsToSleep({ itemName = null, effectNames = [] } = {}) {
  const sleeps = n => /\b(a)?sleep(s|ing)?\b/i.test(String(n ?? ""));
  return sleeps(itemName) || (effectNames ?? []).some(sleeps);
}

/**
 * Every target that has answered. Follow-ups read these, never the array.
 * @param {any} flag
 * @returns {Array<{ uuid: string, name: string, outcome: string | null, total: number | null }>}
 */
export function verdictsOn(flag) {
  return (flag?.targets ?? []).filter(t => t.done)
    .map(t => ({ uuid: t.uuid, name: t.name, outcome: t.outcome ?? null, total: t.total ?? null }));
}
