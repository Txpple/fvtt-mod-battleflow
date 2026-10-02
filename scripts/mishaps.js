/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE MISHAPS (MISHAPS — Ravenloft's dark gifts: Warping Flesh, Intrusive
 * Echoes, Voices from Beyond, Ominous Will, Symbiotic Agenda, Incessant Watchers). "Immediately after you make a D20 Test
 * and roll a 1 on the d20", the bearer makes the feature's own save. Read on the roller's client as the roll lands — an
 * attack roll, a saving throw or an ability check whose kept d20 shows a 1 — the row's save activity is used
 * at the bearer once the roll's own card has posted, and the saves machine takes it from there (the DC and the failure's
 * effect are the pack's). No choice (R1): the text gives none. A mishap's save is a D20 Test too — a 1 on it asks again.
 * The seam is the EVALUATED roll (dnd5e.rollAttack / rollSavingThrow / rollAbilityCheck / rollSkill / rollToolCheck /
 * rollDeathSave); the configuration hook fires before the dice land.
 * Rulings: RULINGS *Ravenloft: The Horrors Within*.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { activityNamed, featureNamed, lower, d20FactsOf } from "./lookup.js";
import { withTargets } from "./shared.js";
import { tokenOfActor } from "./geometry.js";
import { MISHAPS, mishapEntries, listedNames } from "./decide/registry.js";
import { listen } from "./dispatch.js";

const MISHAP_FLAG = "mishap";   // on the save's usage card — which roll raised it

/** The listed rows this roller holds, each with its feature and save activity. */
function mishapsOf(actor) {
  const listed = listedNames(mishapEntries());
  const out = [];
  for ( const [key, row] of Object.entries(MISHAPS) ) {
    if ( !listed.has(lower(key)) ) continue;
    const feature = featureNamed(actor, key);
    const activity = feature ? activityNamed(feature, row.activity) : null;
    if ( !feature ) continue;
    if ( !activity ) { console.warn(`${TITLE} | ${key}: no "${row.activity}" activity on ${actor.name}'s copy — roll the save by hand.`); continue; }
    out.push({ key, row, feature, activity });
  }
  return out;
}

// The EVALUATED d20 rolls (dnd5e's post-roll hooks, `rolls` in hand): the attack's subject is its activity, a save's or a
// check's the Actor. An Initiative roll arrives as an ability check.
const D20_HOOKS = [
  ["dnd5e.rollAttack", "attack roll"], ["dnd5e.rollSavingThrow", "saving throw"], ["dnd5e.rollAbilityCheck", "ability check"],
  ["dnd5e.rollSkill", "ability check"], ["dnd5e.rollToolCheck", "ability check"], ["dnd5e.rollDeathSave", "Death Saving Throw"]
];
for ( const [hook, kind] of D20_HOOKS ) {
  listen(hook, "mishaps", (rolls, data) => {
    try {
      const roll = rolls?.[0];
      if ( !roll || !listedNames(mishapEntries()).size ) return;
      const subject = data?.subject ?? null;
      const actor = (subject instanceof Actor) ? subject : (subject?.actor ?? subject?.item?.actor ?? null);
      if ( !(actor instanceof Actor) || !actor.isOwner ) return;
      const facts = d20FactsOf(roll);
      if ( Number(facts.kept) !== 1 ) return;
      const rows = mishapsOf(actor);
      if ( !rows.length ) return;
      // After the roll's own card: the save's card then follows the test it answers.
      setTimeout(() => { void raise(actor, rows, { kind, total: Number(roll.total) }); }, 150);
    } catch(err) {
      console.error(`${TITLE} | The mishap could not be read — roll the dark gift's save by hand.`, err);
    }
  });
}

/** The feature's save, used at the bearer (the saves machine demands it); one card per row. */
async function raise(actor, rows, { kind, total }) {
  const token = tokenOfActor(actor);
  for ( const { key, row, activity } of rows ) {
    try {
      const data = { data: { flags: { [MODULE_ID]: { [MISHAP_FLAG]: { row: key, actorUuid: actor.uuid, actorName: actor.name, face: 1, test: kind, total, at: Date.now() } } } } };
      const use = () => activity.use({ subsequentActions: false }, { configure: false }, data);
      await (token ? withTargets([token], use) : use());
    } catch(err) {
      console.error(`${TITLE} | ${key}'s save could not be demanded — use "${row.activity}" from the sheet.`, err);
    }
  }
}
