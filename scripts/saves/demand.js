/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the DEMAND — the casting client stamps the `saves` flag on the save
 * activity's own usage card (the bus), the dead-target gate, an emanation's reach at the cast.
 * The machine-tier pass, Stage 4c (2026-09-05, ruling 3): saves.js became this directory —
 * one flag, one machine, one part per spine step; index.js is the only public face and fixes
 * the registration order. Every body here is the one saves.js carried; nothing was rewritten.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { saveDemandData, saveTargetEntry } from "../decide/demand.js";
import { tokensInTemplates } from "../geometry.js";
import { isDeadForSaves } from "../decide/eligible.js";
import { EMANATIONS, tableIndex } from "../decide/registry.js";
import { reachAdmits } from "../decide/emanations.js";
import { emanationEntries } from "../settings.js";
// ⚠ SAFE STATICALLY, unlike auto-damage.js's own ui.js import (v1.6.1's ESM order trap): the
// entry reaches auto-damage.js long before this directory, so that module is fully evaluated
// before this line is read and no hook registration moves. Re-checked with check-hook-order; do
// not promote it to dynamic without re-running that.
import { offerSaveDamageRoll, rollDamageForSave } from "../auto-damage.js";

/* --- the stamp: the casting client writes the demand on the usage card --------------------- */

/** Stamp-time filter: an unresolvable uuid stays IN (the buzzer voids gone targets — never
 * eat a demand on a lookup miss); a dead one stays out. */
export function saveDemandable(t) {
  const actor = resolveUuid(t.uuid);
  if ( !(actor instanceof Actor) ) return true;
  return !isDeadForSaves(actor);
}

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  if ( !setting(S.saves) ) return;
  if ( activity?.type !== "save" ) return;
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return; // used with create: false — no card, no bus, nothing to run
  void stampSaveDemand(activity, message, results);
});

async function stampSaveDemand(activity, message, results) {
  try {
    if ( message.getFlag(MODULE_ID, "saves") ) return; // never re-stamp
    // ⚠ A template spell's target set is what the TEMPLATE contains, not what was clicked —
    // in both directions (user call 2026-08-16: the mephit was targeted but stood outside
    // Moonbeam's circle; the dummy stood inside Shatter's untargeted). postUseActivity fires
    // after _finalizeUsage, so a placed template is already in results.templates, awaited
    // and real. Manual targeting stays the bus for everything without a template.
    // ⚠⚠ results.templates entries are ARRAYS, not documents (5.3.3 ground truth, read from
    // source after two live misfires): #placeTemplate pushes drawPreview()'s resolution,
    // which is the raw createEmbeddedDocuments result — an array per placement. Unflattened,
    // the parent filter dropped every live placement and the stamp silently fell back to the
    // manual snapshot (the Shatter/Gren strand, 2026-08-17) — the adoption floor then had to
    // drag the demand back to the area, stranding the snapshot targets' popups.
    // Containment reads the drawn shape when one exists and falls back to document
    // geometry otherwise (templateShape) — never await canvas readiness here: an await
    // against template.object has been observed to never come back on the headless elect,
    // and the fallback makes it unnecessary.
    const contained = emanationReach(activity, tokensInTemplates((results?.templates ?? []).flat().filter(t => t?.parent)));
    const raw = contained ?? (message.getFlag("dnd5e", "targets") ?? []);
    // THE DEAD-TARGET GATE (v1.19.0 — the user call recorded in the corner list above). The
    // filter runs on the RESOLVED set only; raw emptiness keeps its meaning (a bare template
    // cast still stamps a WAITING demand below). Placed BEFORE the setFlag so an all-dead
    // cast starves everything downstream by construction: no demand, no auto-roll, and no
    // v1.18.0 caster damage offer — the offer block never runs.
    const targets = raw.filter(saveDemandable);
    if ( raw.length && !targets.length ) return; // every target is dead — fully native cast
    // A TEMPLATE-SHAPED activity's targetless cast stamps a WAITING demand (v1.12.0,
    // finding ③ — the natural Web flow is cast bare, then place: the old bail meant
    // adoption had no customer and the area produced no saves at all). The demand stamps
    // with zero targets and NO deadline; adoption fills it when the template lands and
    // arms the clock on the first arrivals (armAskTimer no-ops without a deadline, so
    // nothing buzzes an empty wait). A targetless cast with no template shape anywhere
    // in its data still stays native — no area is ever coming.
    const templateShaped = !!activity.target?.template?.type;
    if ( !targets.length && !templateShaped ) return; // targetless, no area coming — the humans have it
    // A self-aimed save activity's snapshot is incidental UI targeting (the cast slice's
    // lesson). A BLANK affects is allowed on purpose, unlike the cast slice: hand-authored
    // statblock abilities often carry no affects data, and eating their saves in silence
    // would be a false negative the table can't see. The risk the cast slice gated against
    // (double-applying a self-buff) does not exist here — there is no second applier.
    if ( !contained && ((activity.target?.affects?.type ?? null) === "self") ) return;
    const dc = activity.save?.dc?.value;
    if ( !(dc > 0) ) return; // no DC prepared — nothing to judge against (pre-2024 data)
    const abilities = [...(activity.save?.ability ?? [])];
    if ( !abilities.length ) return;

    // The effect names by outcome, resolved NOW while the item surely exists — the popup's
    // stakes line and the LR unwind both read these without needing the live document.
    const applicable = new Set((activity.applicableEffects ?? []).map(e => e.id));
    const entries = (activity.effects ?? []).filter(e => e.effect && applicable.has(e.effect.id));
    // An EMANATION spell's effect (Spirit Guardians' Half Speed) is the area's STANDING effect,
    // kept by the region while a creature stands inside — the verdict never applies it, and the
    // dialog never promises it (user walk, 2026-09-03: two Half Speeds, two lifecycles).
    const emanation = !!emanationRowFor(activity);
    const effectNames = emanation ? { fail: [], always: [] } : {
      fail: entries.filter(e => !e.onSave).map(e => e.effect.name),
      always: entries.filter(e => e.onSave).map(e => e.effect.name)
    };

    // ⚠ `onSave: "full"` marks damage the save does NOT modulate — situational rider
    // damage stored on the save activity (Web's burn clause: 2d4 fire for starting a turn
    // in burning webs, nested there in the system's own PHB data). It is not the save's
    // consequence, so the demand carries no damage dimension at all: no auto-roll, no
    // per-verdict application (finding ③, 2026-08-17 — Web auto-rolled its burn at the
    // stamp and applied 8 to a timer-failed target; RAW deals that only when the webs
    // burn). The card text's own damage enricher stays clickable and lands through the
    // native tray, GM-judged — exactly what situational damage needs.
    const onSave = activity.damage?.onSave ?? "half";
    const saveModulated = !!activity.damage?.parts?.length && (onSave !== "full");

    // Walk-5 (y): Interpose is POST-VERDICT and success-only — the 2024 text conditions the
    // Reaction on succeeding ("…if you succeed on the saving throw and are holding a
    // Shield"), so NO choice stamps with the demand; saveChoiceSpec opens it when a SAVED
    // verdict lands. Finding (f)'s pre-roll gamble is overturned by the walk-5 ruling.
    const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
    const awaiting = !targets.length; // template-shaped, area not placed yet (the gate above)
    // ⚠ THE EMPTY INSTANT (user ruling 2026-08-28): an instantaneous area that is PLACED and
    // contains nobody is already spent — the spell went off, nobody owes a save, and no more
    // area is ever coming. The demand stamps DONE so the elect's convergent floor sweeps the
    // template exactly as it sweeps a resolved one (no new deletion path, no permission edge:
    // this client may be a player). A clockless wait belongs only to an area that does not
    // exist yet (the bare Web cast — `contained` null, not empty). Duration areas are
    // untouched: placed-and-empty Web keeps its wait, its area persists by design.
    const durationUnits = activity.item?.system?.duration?.units ?? null;
    const emptyInstant = awaiting && !!contained && (durationUnits === "inst");
    // The flag through its one constructor (decide/demand.js, Stage 2 — emanations.js stamps the
    // same shape for its trigger card); the field order is the stamp's own.
    await message.setFlag(MODULE_ID, "saves", saveDemandData({
      status: emptyInstant ? "done" : "pending",
      stat: statContext(activity.actor?.uuid ?? null), // the data-plane stamp — the caster forced this
      abilities, dc,
      damageOnSave: onSave,
      hasDamage: saveModulated,
      effectNames,
      // WHAT THE SAVE IS AGAINST (2026-09-05, the save gate's effect facet): a spell's demand,
      // and the statuses its failed-save effects impose — Aura of Purity and Circle of Power read
      // these off the pending demand when the roller's dialog opens.
      demand: { spell: (activity.item?.type === "spell") || (activity.item?.system?.properties?.has?.("mgc") ?? false),
        statuses: [...new Set(entries.filter(e => !e.onSave).flatMap(e => [...(e.effect?.statuses ?? [])]))] },
      effectsHandled: emanation ? "emanation" : null,
      activityUuid: activity.uuid,
      // The dnd5e area type (cube, sphere, …) — adoption's shape gate for a TOOLBAR-drawn
      // template, which carries no origin flag to match by (the v1.12.0 walk's finding ①).
      templateType: activity.target?.template?.type ?? null,
      templated: !!contained,
      awaitingTemplate: awaiting && !emptyInstant,
      durationUnits,
      item: { name: activity.item?.name ?? "the effect", img: activity.item?.img ?? null },
      casterName: activity.actor?.name ?? null,
      // A waiting demand carries its window but NO deadline — the clock starts when the
      // area delivers its first targets (the adoption write), not while nobody can roll.
      window: (window && !emptyInstant) ? window : 0,
      deadline: (window && !emptyInstant && !awaiting) ? Date.now() + (window * 1000) : null,
      // Per-target state is an ARRAY with uuid fields — never a uuid-keyed map (the dotted
      // key expansion ground truth).
      targets: targets.map(t => saveTargetEntry(t.uuid, t.name))
    }));

    // ⑯'s companion: with the card's Damage button hidden, the machine rolls the spell's
    // damage itself the moment the demand stamps — the attack path's symmetry (1a rolls on
    // hit). Chained to the card so upcast scaling and damageOnSave ride the native plumbing;
    // per-target independence already handles a roll arriving before any verdict.
    // Save-modulated damage only — rider damage (onSave "full") never rolls here. An empty
    // instant rolls nothing: there is no one to apply to and the card is already done.
    if ( saveModulated && !emptyInstant ) {
      // The caster asked for their own dice back, exactly as the attacker did (FLOW item 3;
      // the v1.18.0 walk's only finding was that the popup never reached this path). It costs
      // nothing extra to offer here for one reason: THIS HOOK ALREADY RUNS ON THE CASTING
      // CLIENT — postUseActivity fires wherever `use()` was called — which is the same
      // locality that let the attack popup skip the elect, canAnswerFor and the wire. Nothing
      // about the popup crosses a client boundary, so nothing about it needs one.
      //
      // ⚠ NOT awaited, and that is the point: the stamp must not sit inside a fifteen-second
      // window. Everything after this line is done, the demand is already written, and the
      // targets' own save asks arm off the FLAG — not off this call returning. The two windows
      // run concurrently on purpose; a caster thinking about dice must never hold up the
      // table's saves.
      if ( setting(S.playerRollDamage) ) {
        void offerSaveDamageRoll(activity, message,
          { damageOnSave: onSave, targets, awaiting });
      }
      else await rollDamageForSave(activity, message);
    }
  } catch(err) {
    console.error(`${TITLE} | Could not stamp the save demand.`, err);
  }
}

/**
 * AN EMANATION'S REACH AT THE CAST (user, 2026-09-03: "when I cast it as a cleric, it affects all
 * neutral/allies, should just be enemies"). A placed area asks everyone standing in it — right
 * for a Fireball, wrong for a spell whose text says "you can designate creatures to be
 * unaffected": the default designation is the row's reach (DESIGN §5 *Emanations* — harmful
 * reaches enemies, by disposition), and the caster's own token never owes its own spell a save.
 * Only a LISTED emanation row filters; every other area keeps the old answer. Null in, null out.
 */
const EMANATION_INDEX = tableIndex(EMANATIONS);
export function emanationRowFor(activity) {
  if ( !activity?.item || !setting(S.emanations) ) return null;
  const key = EMANATION_INDEX.keyNamed(activity.item.name);
  const row = key ? EMANATIONS[key] : null;
  if ( !row?.reach || !emanationEntries().some(e => e.kind === key.toLowerCase()) ) return null;
  return row;
}
export function emanationReach(activity, contained) {
  const row = emanationRowFor(activity);
  if ( !row || !Array.isArray(contained) ) return contained;
  const caster = activity.actor ?? null;
  const casterTok = caster?.token ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
  const casterDisposition = casterTok?.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  return contained.filter(c => (c.tokenId !== casterTok?.id) && (c.uuid !== caster?.uuid)
    && reachAdmits(row.reach, casterDisposition, c.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL));
}
