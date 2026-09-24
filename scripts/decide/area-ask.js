// @ts-check
/**
 * Battle Flow — DECISION: the ask at the area. Once a placed area lands, a question is put to the
 * caster about the creatures standing in it, and this file holds everything about that question
 * that is arithmetic: the defaults each kind ticks, the words each kind wears, the outcome an
 * answer makes, and the readers of a spell's own text that size a choice.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THREE KINDS today, two customers: Careful Spell's ticks (who the spell spares) and Heightened
 * Spell's radio (who saves at Disadvantage) are metamagic's (RULINGS *Metamagic*); a spell that
 * chooses its targets (RULINGS *Spells that choose their targets*) is the saves machine's — the
 * hostiles ticked, up to the spell's own number, Heightened's radio beside each row when that
 * pick rides the same cast. The machine that opens the popup and takes the answer is
 * `scripts/area-ask.js`; the raisers write the flag it reads. Moved out of decide/metamagic.js on
 * 2026-09-24 (the user: "better to pay this debt now than later") — the flag KEY stays
 * `metamagicAsk`, because it is stored on cards and a rename is a migration.
 */

/**
 * The flag a pending ask rides, on the cast's own card or on a carrier that stands in for it:
 * `{ status, kind, feature, spell?, cap?, rule?, itemImg?, heightened?, candidates, casterUuid,
 * casterDisposition, casterName, window?, deadline?, answer? }`.
 * ⚠ The key is historical — the first customer was metamagic — and is kept: it is on every card
 * that carried an ask, and the smoke suites and the moment registry read it by name.
 */
export const AREA_ASK_FLAG = "metamagicAsk";

/**
 * A spell that chooses its targets: who its area affects, on the spell's card — `{ spell, chosen,
 * left, asked, cap }` (the demand's reach; written by the ask's answer, or by the stamp when there
 * was nothing to choose).
 */
export const AREA_CHOICE_FLAG = "areaChoice";

/* ---------------------------------------------------------------------------------------------
 * Careful's protected set and Heightened's mark
 * ------------------------------------------------------------------------------------------- */

/**
 * @typedef {{uuid: string, name: string, disposition?: number|null, tokenId?: string|null, party?: boolean}} Candidate
 * @typedef {{kind: string, feature: string, spell?: string|null, cap?: number|null, rule?: string|null,
 *            itemImg?: string|null, heightened?: {feature: string, rule?: string|null}|null,
 *            candidates: Candidate[], casterUuid: string|null, casterDisposition: number|null,
 *            casterName?: string|null, window?: number, deadline?: number}} Ask
 *
 * CAREFUL SPELL'S PROTECTED SET: up to `cap` (the Charisma modifier, minimum one) of the creatures
 * the save reaches, NON-HOSTILE by default (user ruling 2026-09-09, second look: "neutral and
 * allies") — the caster first, then the party, then the caster's own side, then the neutrals,
 * each group in the order the list came. A secret token is nobody's to protect. When the player
 * ADJUSTED the list (`chosen`, uuids), the chosen creatures that the save still reaches stand
 * instead, in the order they were ticked, capped the same way. Sight and willingness are never
 * judged.
 * @param {{contained: Candidate[], casterUuid: string|null, casterDisposition: number|null, cap: number, chosen?: string[]|null}} args
 * @returns {{uuid: string, name: string}[]}
 */
export function carefulProtects({ contained, casterUuid = null, casterDisposition = null, cap, chosen = null }) {
  const limit = Math.max(1, Number(cap) || 1);
  const list = Array.isArray(contained) ? contained : [];
  const entry = c => ({ uuid: c.uuid, name: c.name });
  if ( Array.isArray(chosen) ) {
    return chosen.map(uuid => list.find(c => c.uuid === uuid)).filter(Boolean).slice(0, limit).map(entry);
  }
  const hostile = hostileTo(casterDisposition);
  const rank = c => (c.uuid === casterUuid) ? 0 : c.party ? 1 : (c.disposition === casterDisposition) ? 2 : 3;
  const friends = list.filter(c => (c.uuid === casterUuid)
    || ((c.disposition !== undefined) && (c.disposition !== null) && (c.disposition !== -2) && (c.disposition !== hostile)));
  friends.sort((a, b) => rank(a) - rank(b));
  return friends.slice(0, limit).map(entry);
}

/**
 * HEIGHTENED SPELL'S MARK: one target of the spell whose saves against it are at Disadvantage —
 * the player's pick when made (`chosen`), else the FIRST creature the save reaches that is not
 * the caster's ally (an enemy of the caster's side; a neutral when no enemy stands there).
 * @param {{contained: Candidate[], casterUuid: string|null, casterDisposition: number|null, chosen?: string|null}} args
 * @returns {{uuid: string, name: string}|null}
 */
export function heightenedMark({ contained, casterUuid = null, casterDisposition = null, chosen = null }) {
  const list = Array.isArray(contained) ? contained : [];
  const entry = c => ({ uuid: c.uuid, name: c.name });
  if ( chosen ) { const c = list.find(x => x.uuid === chosen); return c ? entry(c) : null; }
  const others = list.filter(c => (c.uuid !== casterUuid) && ((casterDisposition === null) || (c.disposition !== casterDisposition)));
  const enemy = others.find(c => (casterDisposition !== null) && (c.disposition === -casterDisposition));
  const pick = enemy ?? others[0] ?? null;
  return pick ? entry(pick) : null;
}

/* ---------------------------------------------------------------------------------------------
 * A spell that chooses its targets (user, 2026-09-24, Session 8's Slow — the Chosen Areas list)
 * ------------------------------------------------------------------------------------------- */

const NUMBER_WORDS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 });

/**
 * A spell's text as the table reads it: the markup gone, an enricher reduced to its label
 * (`&Reference[incapacitated]{Incapacitated}` → Incapacitated; an inline roll → its label or nothing).
 * @param {string} html
 */
export function spellProse(html) {
  return String(html ?? "")
    .replace(/<section class="secret"[\s\S]*?<\/section>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/\[\[[^\]]*\]\](?:\{([^}]*)\})?/g, (m, label) => label ?? "")
    .replace(/[@&]\w+\[([^\]\s]+)[^\]]*\](?:\{([^}]*)\})?/g, (m, key, label) => label ?? key)
    .replace(/\s+/g, " ").trim();
}

/**
 * How many creatures a spell that chooses may choose — its own number ("up to six creatures of
 * your choice"), or null when the text sets none (Sleep: "each creature of your choice"). N1: the
 * number is the content's, read where it is written, never copied into a table.
 * @param {string} html the spell's description
 */
export function choiceCapFrom(html) {
  const word = spellProse(html).match(/\bup to (\w+) (?:creatures?|targets?) of (?:your|its|their) choice/i)?.[1] ?? "";
  if ( !word ) return null;
  const n = Number(/^\d+$/.test(word) ? word : (/** @type {Record<string, number>} */ (NUMBER_WORDS))[word.toLowerCase()]);
  return (Number.isFinite(n) && (n > 0)) ? n : null;
}

/**
 * The sentence that grants the choice — the popup's quote, in the spell's own words (law 8).
 * @param {string} html the spell's description
 * @returns {string|null}
 */
export function choiceRuleFrom(html) {
  const text = spellProse(html);
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const found = sentences.find(s => /\b(?:of (?:your|its|their) choice|you choose)\b/i.test(s));
  return found ? found.trim() : null;
}

/** The disposition hostile to a caster's side — null for a caster with none (neutral, secret). */
const hostileTo = d => (d === 1) ? -1 : (d === -1) ? 1 : null;

/**
 * WHO A SPELL THAT CHOOSES AFFECTS BY DEFAULT (user, 2026-09-24): the creatures hostile to the
 * caster, in the order the area found them, up to the spell's own number — never the caster,
 * the caster's own side, a neutral or a secret token. The clock keeps this; so does a cast with
 * no choice to make.
 * @param {{candidates: Candidate[], casterUuid?: string|null, casterDisposition?: number|null, cap?: number|null}} args
 * @returns {{uuid: string, name: string}[]}
 */
export function chosenByDefault({ candidates, casterUuid = null, casterDisposition = null, cap = null }) {
  const hostile = hostileTo(casterDisposition);
  const list = (Array.isArray(candidates) ? candidates : []).filter(c => c.uuid !== casterUuid);
  const picked = (hostile === null) ? [] : list.filter(c => c.disposition === hostile);
  const limit = (Number(cap) > 0) ? Number(cap) : Infinity;
  return picked.slice(0, limit).map(c => ({ uuid: c.uuid, name: c.name }));
}

/**
 * IS THERE A CHOICE TO MAKE? (user ruling 2026-09-24: ask "only when there's a real choice") —
 * the area holds someone who is not hostile to the caster, or more hostiles than the spell lets
 * the caster choose. Otherwise the default IS the answer and nobody is asked.
 * @param {{candidates: {uuid: string, disposition?: number|null}[], casterUuid?: string|null, casterDisposition?: number|null, cap?: number|null}} args
 */
export function choiceNeedsAsk({ candidates, casterUuid = null, casterDisposition = null, cap = null }) {
  const list = (Array.isArray(candidates) ? candidates : []).filter(c => c.uuid !== casterUuid);
  if ( !list.length ) return false;
  const hostile = hostileTo(casterDisposition);
  const hostiles = (hostile === null) ? [] : list.filter(c => c.disposition === hostile);
  if ( hostiles.length !== list.length ) return true;
  return (Number(cap) > 0) && (hostiles.length > Number(cap));
}

/**
 * The line the spell's card carries once the choice stands — source, then result (law 6).
 * @param {{spell?: string|null, chosen?: {name: string}[], left?: {name: string}[]}} record
 */
export function areaChoiceLine(record) {
  const spell = record?.spell ?? "The spell";
  const chosen = (record?.chosen ?? []).map(c => c.name).filter(Boolean);
  const left = (record?.left ?? []).map(c => c.name).filter(Boolean);
  const head = chosen.length ? `${spell} — chosen: ${chosen.join(", ")}` : `${spell} — nobody chosen`;
  return left.length ? `${head} · not chosen: ${left.join(", ")}` : head;
}

/* ---------------------------------------------------------------------------------------------
 * The ask itself: its defaults, its words, its outcome
 * ------------------------------------------------------------------------------------------- */

/**
 * The ask's defaults, from its own facts: Careful's non-hostiles up to the cap, a chosen area's
 * hostiles up to the spell's number, Heightened's nearest hostile — the same arithmetic the cast
 * would have used silently.
 * @param {Ask} ask
 * @returns {{uuid: string, name: string}[]}
 */
export function askDefaults(ask) {
  const facts = { contained: ask?.candidates ?? [], casterUuid: ask?.casterUuid ?? null, casterDisposition: ask?.casterDisposition ?? null };
  if ( ask?.kind === "careful" ) return carefulProtects({ ...facts, cap: ask.cap ?? 1 });
  if ( ask?.kind === "choose" ) return chosenByDefault({ candidates: facts.contained, casterUuid: facts.casterUuid, casterDisposition: facts.casterDisposition, cap: ask.cap ?? null });
  const mark = heightenedMark(facts);
  return mark ? [mark] : [];
}

/**
 * The merged ask's Disadvantage mark (a spell that chooses, cast with Heightened Spell — one
 * popup, 2026-09-24): the player's radio when it names a creature they also chose, else
 * Heightened's own default over the chosen.
 * @param {Ask} ask
 * @param {string[]} chosenUuids
 * @param {string|null} [picked]
 */
export function askMark(ask, chosenUuids, picked = null) {
  const chosen = new Set(chosenUuids ?? []);
  const among = (ask?.candidates ?? []).filter(c => chosen.has(c.uuid));
  return heightenedMark({ contained: among, casterUuid: ask?.casterUuid ?? null, casterDisposition: ask?.casterDisposition ?? null,
    chosen: (picked && chosen.has(picked)) ? picked : null });
}

/** Does this kind tick several creatures (checkboxes) or name one (a radio)? */
export function askTicks(ask) {
  return (ask?.kind === "careful") || (ask?.kind === "choose");
}

/**
 * The words an ask wears — the card's line, the popup's eyebrow, title and subtitle — one set per
 * kind, so the machine that draws it knows no kind by name.
 * @param {Ask} ask
 */
export function askWords(ask) {
  const spell = ask?.spell ?? ask?.feature ?? "the spell";
  const n = (ask?.candidates ?? []).length;
  if ( ask?.kind === "careful" ) return {
    question: "who does the spell spare?", icon: "fa-solid fa-wand-sparkles", iconTip: "Metamagic",
    eyebrow: `Metamagic — ${ask.feature}`, title: `Who does the spell spare? Up to ${ask.cap}.`,
    subtitle: `${n} in the area — a tick pings the token`, carrierTitle: "Who does the spell spare?", carrierSubtitle: `${spell} — the card follows the answer`
  };
  if ( ask?.kind === "choose" ) return {
    question: "who does it affect?", icon: "fa-solid fa-bullseye", iconTip: "Creatures of your choice",
    eyebrow: `${spell} — creatures of your choice`, title: ask.cap ? `Who does ${spell} affect? Up to ${ask.cap}.` : `Who does ${spell} affect?`,
    subtitle: ask.heightened ? `${n} in the area · ${ask.heightened.feature}: one of them saves at Disadvantage` : `${n} in the area — a tick pings the token`,
    carrierTitle: `Who does ${spell} affect?`, carrierSubtitle: ask.heightened ? `${ask.heightened.feature} rides it — the card follows the answer` : `${spell} — the card follows the answer`
  };
  return {
    question: "who saves at Disadvantage?", icon: "fa-solid fa-wand-sparkles", iconTip: "Metamagic",
    eyebrow: `Metamagic — ${ask?.feature}`, title: "Who saves at Disadvantage?",
    subtitle: `${n} in the area — a tick pings the token`, carrierTitle: "Who saves at Disadvantage?", carrierSubtitle: `${spell} — the card follows the answer`
  };
}

/**
 * THE OUTCOME OF AN ANSWER — the caster's ticks, or the defaults when the clock ran out — as the
 * records it makes: Careful's protected list, a chosen area's choice (with Heightened's mark among
 * the chosen when that pick rode along), Heightened's mark; and `stays`, which creatures of the
 * area keep their save.
 * @param {Ask} ask
 * @param {string[]|null} picked the ticked uuids, or null for the defaults
 * @param {{mark?: string|null, timedOut?: boolean}} [opts]
 */
export function askOutcome(ask, picked, { mark: markPick = null, timedOut = false } = {}) {
  const chosen = Array.isArray(picked) ? picked : askDefaults(ask).map(c => c.uuid);
  const named = uuid => (ask.candidates ?? []).find(c => c.uuid === uuid) ?? null;
  const entry = c => ({ uuid: c.uuid, name: c.name });
  /** @type {{uuid: string, name: string}[]} */
  let protectedList = [];
  /** @type {{uuid: string, name: string}|null} */
  let mark = null;
  /** @type {object|null} */
  let areaChoice = null;
  if ( ask.kind === "careful" ) {
    protectedList = chosen.map(named).filter(Boolean).slice(0, Math.max(1, Number(ask.cap) || 1)).map(entry);
  } else if ( ask.kind === "choose" ) {
    const limit = (Number(ask.cap) > 0) ? Number(ask.cap) : Infinity;
    const list = chosen.map(named).filter(Boolean).slice(0, limit).map(entry);
    const ids = new Set(list.map(c => c.uuid));
    areaChoice = { spell: ask.spell ?? ask.feature, chosen: list, left: (ask.candidates ?? []).filter(c => !ids.has(c.uuid)).map(entry),
      asked: true, cap: ask.cap ?? null, ...(timedOut ? { timedOut: true } : {}) };
    if ( ask.heightened ) mark = askMark(ask, [...ids], markPick);
  } else {
    const c = named(chosen[0] ?? null);
    mark = c ? entry(c) : null;
  }
  const protectedUuids = new Set(protectedList.map(p => p.uuid));
  const chosenUuids = new Set(((areaChoice && areaChoice.chosen) || []).map(c => c.uuid));
  const stays = uuid => (ask.kind === "choose") ? chosenUuids.has(uuid) : !protectedUuids.has(uuid);
  return { chosen, protectedList, mark, areaChoice, stays, timedOut: !!timedOut };
}
