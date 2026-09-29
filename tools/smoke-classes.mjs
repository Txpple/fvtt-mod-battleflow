// Classes smoke suite (Session 0, audits/plans/session-0-classes.md): the PHB classes' rows on the live box.
// §A3 — THE BYSTANDER'S BEND on a hit (RULINGS *The full release — the order*, Q2 option A): Cutting Words and
// Restore Balance asked for someone else's hit only when the bend can change the verdict (the margin gate);
// the quiet road on the card (Cutting Words' die off the damage); the reach; "Not this combat".
// Fixtures: BF Test Attacker swings at BF Test Halfling; BF Test Bard is lent Cutting Words, BF Test Sorcerer
// Restore Balance (the pack's own items). Everything written is restored.
// §A1 (13–27) — the band-A rows on tables that exist (RULINGS *The PHB classes — A1*): the A3 lends leave first;
// each section lends its class features (there is no Barbarian/Warlock/Monk/Paladin/Druid fixture) and takes them back.
// §A4 (32–34) — the healing seam and the caster's rows (RULINGS *The PHB classes — A4*): Potent Cantrip lent to the
// Attacker, Disciple of Life to the Cleric, Psychic Spells (and a Warlock's Chill Touch) to the Sorcerer.
// §A5 (36) — Arcane Ward lent to the Sorcerer. §A6 (37–38) — the Initiative grants (Persistent Rage to the PC Attacker,
// Uncanny Metabolism to the Halfling) and Vitality of the Tree (the PC Attacker; the gift to a creature within 10 ft).
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'hold/trigger.js',        // the bystanders stamped beside the guards on a held hit
  'hold/lookup.js',         // bystandersOf: the side, the reach, the Reaction, the pool, the mute, the margin gate
  'hold/answer.js',         // the bystander's answer (the die, the neutralise), the mute and pass
  'hold/views.js',          // the bystander's popup, the card's quiet row, the bent card
  'hold/continue.js',       // the verdict retaken with the bent roll; the damage half announced
  'hold/dice.js',           // the bent roll's chips
  'bystanders.js',          // the bystander on a demanded save (the withhold) and on a check (the arithmetic)
  'chip-spend.js',          // the mute swept with the combat
  // §A1 (13–27)
  'clock-riders.js',        // Combat Inspiration's offense, Frenzy, Colossus Slayer + the option ask, Repelling Blast
  'hew.js',                 // War Priest, Horde Breaker
  'heal-on-hit.js',         // Dark One's Blessing on a kill
  'cast.js',                // Starry Form's constellation, Rage of the Wilds' pick, the Rage landing
  'polish.js',              // the choice stamped at the use card's birth
  'heal-rerolls.js',        // the Chalice's second heal
  'token-lights.js',        // Sacred Weapon's light, out with the enchantment
  'turn-grants.js',         // the Rage's turn-end reminder
  'emanations.js',          // the Wolf's ring
  'reminders.js',           // the gate's member bend (Rage of the Wolf)
  'advantage-buys.js',      // Tides of Chaos
  'd20-folds.js',           // Commanding Presence
  // §A2 (28–31)
  'hit-menu.js',            // the Monk's Focus, Open Hand Technique, Elemental Attunement and Psionic Power groups
  'damage-holds.js',        // Protective Field's guard
  'saves/consequences.js',  // Stunning Strike's success half (SAVE_PRESSES `success`)
  'saves/demand.js',        // the save card's effect names by outcome
  // §A4 (32–34)
  'saves/verdict.js',       // Potent Cantrip stamped on the entry at the fold
  'metamagic.js',           // Psychic Spells' free row, its birth flag, the damage retyped
  'precision.js',           // the miss wait's synchronous half (Potent Cantrip's miss)
  // §A5 (36)
  'ward-pools.js',          // Arcane Ward: the take at preApplyDamage, the pop, the cast's create and refill
  'receipts.js',            // the revert gives the ward its take back
  // §A6 (37–38)
  'initiative-grants.js',   // Persistent Rage and Uncanny Metabolism at Initiative
  'rest-grants.js'          // the song's hand-out outside a rest: Life-Giving Force's pick
];

const SECTIONS = {
  1: 'Cutting Words, asked: a hit a d8 can turn (margin 2) opens the Bard\'s popup; Answer rolls the d8 (5), the hit becomes a MISS, the card says "Cutting Words (BF Test Bard) −5", a Bardic Inspiration spent',
  2: 'the margin gate: a hit by 9 asks nobody — no hold, no popup, the damage lands',
  3: 'the quiet road: the Halfling\'s Lucky holds the hit, Cutting Words rides QUIET on the card; its Answer takes the d8 (3) off the damage — the hit stands, 3 less lands',
  4: 'Restore Balance: an Advantage hit (18 and 9) whose first die misses opens the Sorcerer\'s popup; Answer stands the 9 — a MISS; Cutting Words (margin 8) stays quiet',
  5: 'the reach: the Bard 65 ft from the attacker is not asked',
  6: '"Not this combat": in a running combat the popup\'s third button mutes Cutting Words on the Bard (an effect), the hit lands; the next hit asks nobody; the combat\'s end sweeps the mute',
  7: 'Guided Strike for an ally: BF Test PC Attacker misses by 7 within 30 ft of the Cleric — the Cleric\'s popup "+10 · a Reaction"; Answer turns the miss into a HIT and the damage rolls and lands',
  8: 'Guided Strike on the Cleric\'s own miss: its own popup, "No Reaction"; the +10 turns it, the guard entry marked self',
  9: 'Restore Balance on a Disadvantage miss (18 then 3): the Sorcerer\'s popup beside the Cleric\'s; Answer stands the 18 — a HIT, the Cleric\'s popup closes',
  10: 'Restore Balance on a DEMANDED save: the Attacker\'s Sacred Flame, the Halfling\'s Dexterity save rolled with Disadvantage failing on its lower die — the verdict waits; the Sorcerer\'s popup; Answer stands the first die: SAVED, the roll\'s card says so',
  11: 'Cutting Words on a hostile\'s CHECK: the Attacker\'s Athletics; the Bard\'s popup says no DC is known; Answer takes the d8 (5) off — the card states the arithmetic and "ask your DM"',
  12: 'a check everyone passes: an Advantage Athletics asks the Bard and the Sorcerer; both pass, the offer resolves as a pass, the card says nothing',
  13: 'Glorious Defense: the Attacker hits the Halfling 10 ft from the Cleric (lent Glorious Defense) by 0 — the Cleric\'s popup "−<Cha mod, min 1>"; Answer turns it to a MISS, a use spent; the Strike popup "Strike BF Test Attacker with <weapon>?" drives one weapon attack at the Attacker',
  14: 'Combat Inspiration — Defense: in a combat, the Halfling holding the Bard\'s Inspired die (the Bard lent Combat Inspiration) is hit by 2 — ITS OWN popup "−<the Bard\'s die> · a Reaction · the Inspired die", nobody else asked; Answer rolls the die: a MISS, the Inspired effect deleted, the Halfling\'s Reaction spent',
  15: 'Combat Inspiration — Offense: an Inspired ally (BF Test PC Attacker, the Bard\'s die) hits — the offer\'s UNTICKED row "Combat Inspiration — <die>"; ticked, the die rides and the Inspired effect is spent; a driven roll (no pick) and an unticked offer ride nothing',
  16: 'Deflect Attacks (lent to the Halfling, a Monk 3): a slashing/piercing/bludgeoning hit opens its popup; the answer rolls 1d10 + Dex + Monk level in the open, the damage lands at 0 and the damage card offers "Redirect" — used at the Attacker; a fire hit asks nothing; with Deflect Energy it asks',
  17: 'Frenzy: raging AND Reckless, the first hit of the turn — the offer\'s TICKED row "Frenzy — Nd6 <type>" (N the Rage Damage), it rides and writes the chit; the second hit that turn shows none; Rage without Reckless, none',
  18: 'Hunter\'s Prey: the first hit asks "which option did you take?"; Colossus Slayer is kept on the feature, its 1d8 rides a damaged target and not an undamaged one; the card\'s Change forgets it; asked again, Horde Breaker with the Cleric 5 ft from the target posts Hew\'s reminder "Horde Breaker — …"',
  19: 'War Priest: a weapon attack posts Hew\'s reminder "War Priest — BF Test Cleric can attack again … N of M uses left" (and pops, OK only); no uses left, no reminder',
  20: 'Repelling Blast: each Eldritch Blast beam that hits — the offer\'s ticked no-dice row and a card line "Repelling Blast — push it up to 10 feet … (move the token)"; a Huge target, none; enchanted onto another cantrip, Eldritch Blast says nothing and that cantrip does',
  21: 'Dark One\'s Blessing (lent to the Cleric with a Warlock class, 3): the Cleric drops the Victim → "Dark One\'s Blessing — BF Test Cleric gains N Temporary Hit Points" (N = max(1, warlock level + Cha)), receipted, N temp HP; the PC Attacker\'s kill 5 ft from the Cleric pays too; a kill 55 ft away pays nothing',
  22: 'Starry Form: "Consume Wild Shape" asks "Which constellation glimmers on you?" (Archer/Chalice/Dragon); Dragon lands Dragon Form, Archer and Chalice do not; Chalice keeps a form chip; then Cure Wounds at the PC Attacker offers "Chalice — heal one more within 30 ft" with a button per creature; the Halfling\'s button uses the Chalice heal on it (HP up)',
  23: 'Sacred Weapon: the use lights the Cleric\'s token 20 ft Bright / 40 ft Dim ("while the weapon\'s enchantment stands"); the weapon\'s enchantment deleted puts the light out (the token back to its prior light)',
  24: 'the Rage reminder: in a combat BF Test PC Attacker (lent Rage) enters Rage on its turn — that turn is never reminded; a later turn with no attack roll and no save forced ends with "Rage — it ends now unless you extended it", nothing removed; a turn with an attack roll at an enemy ends with no card',
  25: 'Rage of the Wilds: with Rage and Rage of the Wilds lent, the Rage\'s card asks "Rage of the Wilds — Bear, Eagle or Wolf?" and the Rage lands at once; Wolf uses the feature\'s own Wolf activity ("Rage of the Wolf" on the barbarian); the enemy within 5 ft wears the quiet ring\'s member copy; the Cleric attacking it sees Advantage from "Rage of the Wolf" in the gate, the barbarian\'s own attack does not',
  26: 'Tides of Chaos: an attack, a save and a check dialog carry the buy box "Tides of Chaos — 1 use · 1 left"; ticked and pressed, the save rolls at Advantage, the use spent and recorded; with none left the box is greyed "no uses left", no tick',
  27: 'Commanding Presence: BF Test Fighter\'s Persuasion, Intimidation and Performance checks offer the superiority die (the scoped tactical fold); Athletics does not; accepted on Persuasion, a die spent and the total patched',
  28: 'Stunning Strike and Hand of Harm (the Monk\'s Focus group): a Longsword hit offers neither; an Unarmed Strike both; Stunning Strike alone costs ONE point (its save\'s use), Stunned on a failure, Slowed on a success; both ride one hit; in a combat the second hit greys Stunning Strike',
  29: 'Open Hand Technique: out of combat every Unarmed Strike offers Addle / Push / Topple; in a combat only after Flurry of Blows (its turn chit); one pick; Topple\'s failed save lands Prone; a Longsword hit none',
  30: 'Psionic Power: Psionic Strike\'s force die on the menu (a die spent); Protective Field asks the Psi Warrior when an ally within 30 ft is hit ("Reduce"), the die + Int off; none left, never asked',
  31: 'Elemental Attunement: its own Elemental Strike only; "Push or pull — free"; the Strength save and the card\'s line',
  32: 'Potent Cantrip (lent to the Attacker): the Halfling SAVES against its Sacred Flame — "saved — half damage (Potent Cantrip)", half the roll lands; taken back, a saved Sacred Flame lands nothing',
  33: 'Disciple of Life (the Cleric): Cure Wounds at level 2 heals "+4[Disciple of Life]" more — the card says "Disciple of Life — +4 healing", the healing lands with it; at level 1 +3; cast innately, nothing',
  34: 'Psychic Spells (lent to the Sorcerer): Fire Bolt\'s window greys it "not a Warlock spell"; a Warlock\'s Chill Touch shows "Psychic Spells · free" beside the Metamagic rows, its tick greys none of them; cast ticked, the card says "the damage is psychic" and the damage roll is psychic; cast unticked, necrotic',
  35: 'Potent Cantrip on a MISS (BF Test PC Attacker\'s Fire Bolt at the Victim, AC 30): the damage rolls and half lands — "missed — Potent Cantrip, half damage"; without the feature nothing rolls; with Heroic Inspiration the rescue window opens first and nothing rolls until Pass — then half lands; the Heroic reroll turning it lands the FULL roll, never a share',
  36: 'Arcane Ward (lent to the Sorcerer, 12 HP): the first Abjuration cast from a slot (Mage Armor) creates it — "Arcane Ward — created, 12 hit points (of 12)"; 5 damage applied straight to the actor (the card buttons\' road) lands on the ward, HP untouched; a hit through the module with the ward at 2: "Arcane Ward took 2 — N landed", the revert gives both back; a level-2 cast refills +4; at 0 it takes nothing',
  37: 'the Initiative grants: Persistent Rage (lent to the PC Attacker, Rage 1 of 3) regains every Rage use at Initiative, automatically — "Persistent Rage — Rage uses regained (3 of 3)"; Uncanny Metabolism (lent to the Halfling) asks, Yes lands Focus 3 of 3 and 1d8 + 5 (9) Hit Points, its use spent; rerolled with both spent, nothing; No keeps the use; with Persistent Rage a quiet raging turn is never reminded',
  38: 'Vitality of the Tree (lent to the PC Attacker): the Rage used grants Vitality Surge (7 temp HP); a raging turn start asks "Who gets 7 Temporary Hit Points?" (Life-Giving Force, 2d6) — creatures on its side within 10 ft; OK gives the one ticked; not raging, nothing asked'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'classes', watchdogMs: 1_500_000 });
announcePlan('classes', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();
  const errors = [];
  const realError = console.error;
  console.error = (...a) => { errors.push(a.map(x => (x?.stack ?? String(x))).join(' ').slice(0, 400)); realError(...a); };

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const { INTERRUPT_ROLLS } = await import('/modules/fvtt-mod-battleflow/scripts/decide/registry.js');
  if (!INTERRUPT_ROLLS['Cutting Words']) return { fatal: 'Cutting Words is not in the loaded code — OLD code (deploy --local, reload the box)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'holdApplyEffect', 'riders', 'effectRiders',
    'masteryRiders', 'masteryAsk', 'castApply', 'concMode', 'saveRolls'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const halfling = game.actors.getName('BF Test Halfling');
  const bard = game.actors.getName('BF Test Bard');
  const sorcerer = game.actors.getName('BF Test Sorcerer');
  const cleric = game.actors.getName('BF Test Cleric');
  const pcAttacker = game.actors.getName('BF Test PC Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !attacker || !halfling || !bard || !sorcerer || !cleric || !pcAttacker || !victim) return { fatal: 'missing fixture: the range, BF Test Attacker, Halfling, Bard, Sorcerer, Cleric, PC Attacker or Victim — run tools/fixture-suite.mjs' };
  const divinity = () => cleric.items.find(i => (i.name === 'Channel Divinity') && (Number(i.system?.uses?.max) > 0));
  const divinitySpentBefore = Number(divinity()?.system?.uses?.spent ?? 0);
  const lucky = () => halfling.items.find(i => (i.name === 'Lucky') && (Number(i.system?.uses?.max) > 0));
  const inspiration = () => bard.items.find(i => (i.name === 'Bardic Inspiration') && (Number(i.system?.uses?.max) > 0));

  const created = { tokens: [], items: [], combats: [] };
  const lentBy = new Map();
  const priorActor = {};
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const refillLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': 0 }); };
  const spendLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': Number(l.system.uses.max) }); };
  const inspirationSpentBefore = Number(inspiration()?.system?.uses?.spent ?? 0);
  const refillInspiration = async () => { const b = inspiration(); if (b) await b.update({ 'system.uses.spent': 0 }); };
  // ⚠ Never the UI singletons: a text match on "every rendered app" once closed the CHAT LOG (§16), and every card after read empty.
  const popups = () => [...foundry.applications.instances.values()].filter(app => app.rendered && !Object.entries(ui).some(([k, v]) => (k !== 'activeWindow') && (v === app)));
  const bystanderPopup = () => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]')) ?? null;
  const rescuePopup = () => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-rescue"]')) ?? null;
  const closeDialogs = async () => {
    for (const app of popups()) {
      if (app.element?.querySelector?.('[data-bf-ticks]')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const dropMutes = async () => {
    const ids = bard.effects.filter(e => e.getFlag(MOD, 'bystanderMute')).map(e => e.id);
    if (ids.length) await bard.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    console.error = realError;
    if (errors.length) log.push(`console errors: ${JSON.stringify(errors.slice(0, 6))}`);
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      for (const id of created.combats) { const c = game.combats.get(id); if (c) await c.delete(); }
      await dropMutes();
      await refillLuck();
      const b = inspiration(); if (b) await b.update({ 'system.uses.spent': inspirationSpentBefore });
      const cd = divinity(); if (cd) await cd.update({ 'system.uses.spent': divinitySpentBefore });
      for (const [actor, ids] of lentBy) {
        const live = ids.filter(id => actor.items.get(id));
        if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      }
      for (const actor of [bard, sorcerer, cleric, halfling, pcAttacker]) {
        const chips = actor.effects.filter(e => e.getFlag(MOD, 'mastery') === 'reaction').map(e => e.id);
        if (chips.length) await actor.deleteEmbeddedDocuments('ActiveEffect', chips).catch(() => {});
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('autoDamage', 'all');
    await set('autoApply', true);
    await set('playerRollDamage', false);
    await set('damageTimer', 0);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', true);
    await set('holdTimer', 0);
    await set('holdReveal', true);
    await set('holdSkipFutile', false);
    await set('holdApplyEffect', true);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('castApply', false);
    await set('concMode', 'off');
    for (const c of game.combats.filter(c => c.scene?.id === scene.id)) await c.delete();

    // ---- fixtures: the pack's own features, lent by name
    const findPHB = async (name, type) => {
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (e.type === type));
        if (hit) return pack.getDocument(hit._id);
      }
      return null;
    };
    const lend = async (actor, name) => {
      const source = await findPHB(name, 'feat');
      if (!source) throw new Error(`the PHB ships no feat "${name}" this box can find`);
      const [item] = await actor.createEmbeddedDocuments('Item', [source.toObject()]);
      lentBy.set(actor, [...(lentBy.get(actor) ?? []), item.id]);
      return item;
    };
    await lend(bard, 'Cutting Words');
    await lend(cleric, 'Guided Strike');
    // BF Test Cleric carries no Channel Divinity: the pack's, with two uses (the pool Guided Strike spends).
    if (!divinity()) {
      const cd = await lend(cleric, 'Channel Divinity');
      await cd.update({ 'system.uses.max': '2', 'system.uses.spent': 0 });
    }
    const balance = await lend(sorcerer, 'Restore Balance');
    await balance.update({ 'system.uses.spent': 0 });
    await refillInspiration();

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => t.actorLink && [attacker.id, halfling.id, bard.id, sorcerer.id, cleric.id, pcAttacker.id, victim.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y, disposition) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true, disposition }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { token: attackerToken, doc: attackerDoc } = await placeToken(attacker, 1400, 2100, -1);
    const { token: halflingToken, doc: halflingDoc } = await placeToken(halfling, 1500, 2100, 1);
    let { doc: bardDoc } = await placeToken(bard, 1700, 2100, 1);
    const { doc: sorcererDoc } = await placeToken(sorcerer, 1800, 2100, 1);
    // The miss side, one row north: the PC attacker, its target, the Cleric 10 ft from the attacker.
    const { token: pcToken } = await placeToken(pcAttacker, 1400, 1900, 1);
    const { token: victimToken } = await placeToken(victim, 1500, 1900, -1);
    const { token: clericToken } = await placeToken(cleric, 1600, 1900, 1);

    // ---- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cardEl = id => document.querySelector(`.message[data-message-id="${id}"]`);
    const cardText = id => textOf(cardEl(id));
    const weapon = attacker.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
    if (!weapon) return { fatal: 'BF Test Attacker has no weapon attack' };
    const act = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
    faces([[10, 20]]);
    const probe = await act().rollAttack({}, { configure: false }, { create: false });
    const atkMod = Number(probe?.[0]?.total) - Number(probe?.[0]?.d20?.total);
    if (!Number.isFinite(atkMod)) return { fatal: `could not measure the attacker's modifier (${probe?.[0]?.total})` };
    const AC = atkMod + 10;
    priorActor[halfling.id] = {
      'system.attributes.ac.override': halfling.system._source.attributes.ac.override ?? null,
      'system.attributes.hp.value': halfling.system._source.attributes.hp.value,
      'system.attributes.hp.max': halfling.system._source.attributes.hp.max
    };
    await halfling.update({ 'system.attributes.ac.override': AC, 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    const healFull = () => halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
    const damageFor = id => game.messages.contents.find(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === id));
    const swing = async ({ d20 = [12], dmg = 3, advantage = false } = {}) => {
      await healFull();
      attackerToken.control({ releaseOthers: true });
      halflingToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([...d20.map(n => [n, 20]), [dmg, 6], [dmg, 6]]);
      const usage = await act().use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act().rollAttack(advantage ? { advantage: true } : {}, { configure: false },
        usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      await waitFor(() => msg?.getFlag(MOD, 'hold') || damageFor(msg?.id), 4000);
      return msg;
    };
    const holdOf = msg => game.messages.get(msg?.id)?.getFlag(MOD, 'hold') ?? null;
    const resolvedTarget = async msg => {
      const h = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      return h?.targets?.find(x => x.uuid === halfling.uuid) ?? null;
    };
    const hp = () => Number(halfling.system.attributes.hp.value);
    const spentBI = () => Number(inspiration()?.system?.uses?.spent ?? 0);

    // ---- 1. Cutting Words, asked, turns the hit
    if (want(1)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      const msg = await swing({ d20: [12] });
      const pop = await waitFor(bystanderPopup, 6000);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      ok('1a. the hit is held for the Bard: a bystander popup "Cutting Words … −d8 · a Reaction"; the Sorcerer is not listed (a plain roll)',
        !!pop && /Cutting Words/.test(textOf(pop?.element)) && /−d8/.test(textOf(pop?.element))
          && guards.some(g => (g.uuid === bard.uuid) && g.bystander && !g.quiet) && !guards.some(g => g.uuid === sorcerer.uuid),
        `pop=${!!pop} guards=${JSON.stringify(guards.map(g => [g.name, g.row, g.quiet ?? false]))}`);
      ok('1b. the popup states the margin: "a d8 can turn it"', /can turn it/.test(textOf(pop?.element)), textOf(pop?.element).slice(0, 200));
      faces([[5, 8]]);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await resolvedTarget(msg);
      ok('1c. the d8 (5) off the attack: a MISS, answered by the Bard (rescue Cutting Words)',
        (t?.answer === 'roll') && (t?.verdict === 'miss') && (t?.rescue === 'Cutting Words') && (t?.guardedBy?.uuid === bard.uuid)
          && (t?.bent?.how === 'die') && (t?.bent?.add === -5),
        JSON.stringify({ answer: t?.answer, verdict: t?.verdict, rescue: t?.rescue, by: t?.guardedBy?.name, bent: t?.bent }));
      await sleep(800);
      ok('1d. the attack card: "Cutting Words (BF Test Bard) −5 … MISS"', /Cutting Words \(BF Test Bard\) −5.*MISS/.test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
      ok('1e. one Bardic Inspiration spent; no damage landed; the popup closed', (spentBI() === 1) && (hp() === 400) && !bystanderPopup(),
        `spent=${spentBI()} hp=${hp()} pop=${!!bystanderPopup()}`);
    }

    // ---- 2. the margin gate: a hit by 9 asks nobody
    if (want(2)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      const msg = await swing({ d20: [19] });
      await sleep(1200);
      ok('2a. no hold and no popup: a d8 cannot turn a hit by 9', !holdOf(msg) && !bystanderPopup(), `hold=${JSON.stringify(holdOf(msg))} pop=${!!bystanderPopup()}`);
      await waitFor(() => hp() < 400, 6000);
      ok('2b. the damage landed', hp() < 400, `hp=${hp()}`);
    }

    // ---- 3. the quiet road
    if (want(3)) {
      await closeDialogs(); await refillLuck(); await refillInspiration();
      const msg = await swing({ d20: [19], dmg: 5 });
      const own = await waitFor(rescuePopup, 6000);
      const quiet = (holdOf(msg)?.targets?.[0]?.guards ?? []).find(g => g.uuid === bard.uuid);
      const row = await waitFor(() => cardEl(msg?.id)?.querySelector?.('[data-bf-bystander^="Cutting Words|"]'), 6000);
      ok('3a. the Halfling\'s Lucky holds the hit; Cutting Words rides QUIET (no popup), its row on the card with Answer (out of combat, no "Not this combat")',
        !!own && quiet?.quiet === true && quiet?.passed === true && !bystanderPopup() && !!row
          && /off the damage/.test(textOf(row)) && /Answer/.test(textOf(row)) && !/Not this combat/.test(textOf(row)),
        `own=${!!own} quiet=${JSON.stringify(quiet)} row=${textOf(row)}`);
      faces([[3, 8]]);
      [...(row?.querySelectorAll?.('button') ?? [])].find(b => b.textContent === 'Answer')?.click();
      const t = await resolvedTarget(msg);
      const dmg = await waitFor(() => damageFor(msg?.id), 6000);
      const full = (dmg?.rolls ?? []).reduce((n, r) => n + Number(r.total ?? 0), 0);
      await waitFor(() => hp() < 400, 6000);
      await sleep(600);
      ok('3b. the die (3) off the DAMAGE: the hit stands, the Bard answered, reduceBy 3', (t?.answer === 'roll') && (t?.verdict === 'hit') && (t?.reduceBy === 3) && !t?.bent && (t?.guardedBy?.uuid === bard.uuid),
        JSON.stringify({ answer: t?.answer, verdict: t?.verdict, reduceBy: t?.reduceBy, by: t?.guardedBy?.name }));
      ok('3c. 3 less landed; the Lucky popup closed', ((400 - hp()) === Math.max(0, full - 3)) && !rescuePopup(), `full=${full} taken=${400 - hp()} own=${!!rescuePopup()}`);
    }

    // ---- 4. Restore Balance on an Advantage hit
    if (want(4)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      await balance.update({ 'system.uses.spent': 0 });
      const msg = await swing({ d20: [9, 18], advantage: true });
      const pop = await waitFor(bystanderPopup, 6000);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      ok('4a. the Sorcerer\'s popup: "Restore Balance … the first d20 (9) stands"; Cutting Words (margin 8) quiet',
        !!pop && /Restore Balance/.test(textOf(pop?.element)) && /first d20 \(9\)/.test(textOf(pop?.element))
          && guards.some(g => (g.uuid === bard.uuid) && g.quiet) && guards.some(g => (g.uuid === sorcerer.uuid) && !g.quiet),
        `pop=${textOf(pop?.element).slice(0, 160)} guards=${JSON.stringify(guards.map(g => [g.name, g.row, g.quiet ?? false]))}`);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await resolvedTarget(msg);
      ok('4b. the first d20 stands: a MISS, rescue Restore Balance, a use spent',
        (t?.verdict === 'miss') && (t?.rescue === 'Restore Balance') && (t?.bent?.how === 'neutralised') && (t?.bent?.stood === 9)
          && (Number(sorcerer.items.get(balance.id)?.system?.uses?.spent) === 1),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent, spent: sorcerer.items.get(balance.id)?.system?.uses?.spent }));
    }

    // ---- 5. the reach
    if (want(5)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      // ⚠ The range's tokens sit below its 2000 px edge, where Foundry refuses a move: the Bard is re-placed 65 ft west.
      await scene.deleteEmbeddedDocuments('Token', [bardDoc.id]);
      ({ doc: bardDoc } = await placeToken(bard, 100, 2100, 1));
      await sleep(600);
      const msg = await swing({ d20: [12] });
      await sleep(1200);
      ok('5a. the Bard 65 ft from the attacker: nobody asked, no hold', !holdOf(msg) && !bystanderPopup(), `hold=${JSON.stringify(holdOf(msg)?.targets?.[0]?.guards ?? null)}`);
      await scene.deleteEmbeddedDocuments('Token', [bardDoc.id]);
      ({ doc: bardDoc } = await placeToken(bard, 1700, 2100, 1));
      await sleep(600);
    }

    // ---- 6. "Not this combat"
    if (want(6)) {
      await closeDialogs(); await spendLuck(); await refillInspiration(); await dropMutes();
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      await combat.createEmbeddedDocuments('Combatant', [attackerDoc, halflingDoc, bardDoc, sorcererDoc].map((d, i) =>
        ({ tokenId: d.id, sceneId: scene.id, actorId: d.actorId, initiative: 20 - i })));
      await combat.startCombat();
      await sleep(400);
      const msg = await swing({ d20: [12] });
      const pop = await waitFor(bystanderPopup, 6000);
      const mute = pop?.element?.querySelector('button[data-action="mute"]');
      ok('6a. the popup carries "Not this combat"', !!mute && /Not this combat/.test(textOf(mute)), textOf(pop?.element).slice(-120));
      mute?.click();
      const eff = await waitFor(() => bard.effects.find(e => e.getFlag(MOD, 'bystanderMute')?.key === 'Cutting Words'), 6000);
      const t = await resolvedTarget(msg);
      ok('6b. the mute on the Bard ("Cutting Words — muted this combat", this combat); the hit lands (passed)',
        /Cutting Words — muted this combat/.test(eff?.name ?? '') && (eff?.getFlag(MOD, 'bystanderMute')?.combat === combat.id) && (t?.verdict === 'hit'),
        `effect=${eff?.name ?? null} verdict=${t?.verdict}`);
      const msg2 = await swing({ d20: [12] });
      await sleep(1200);
      ok('6c. the next hit asks nobody', !holdOf(msg2) && !bystanderPopup(), `hold=${JSON.stringify(holdOf(msg2)?.targets?.[0]?.guards ?? null)}`);
      await combat.delete();
      const gone = await waitFor(() => !bard.effects.some(e => e.getFlag(MOD, 'bystanderMute')), 8000);
      ok('6d. the combat\'s end sweeps the mute', gone, `left=${bard.effects.filter(e => e.getFlag(MOD, 'bystanderMute')).map(e => e.name)}`);
    }

    // ---- the miss side: a friendly attacker, a hostile target
    const weaponOf = actor => actor.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
    const pcWeapon = weaponOf(pcAttacker);
    let clericWeapon = weaponOf(cleric);
    if (!clericWeapon) {
      const mace = await findPHB('Mace', 'weapon');
      if (mace) { const data = mace.toObject(); data.system.equipped = true; [clericWeapon] = await cleric.createEmbeddedDocuments('Item', [data]); lentBy.set(cleric, [...(lentBy.get(cleric) ?? []), clericWeapon.id]); }
    }
    const attackOf = (actor, w) => actor.items.get(w.id).system.activities.find(a => a.type === 'attack');
    const modOf = async (actor, w) => {
      faces([[10, 20]]);
      const p = await attackOf(actor, w).rollAttack({}, { configure: false }, { create: false });
      return Number(p?.[0]?.total) - Number(p?.[0]?.d20?.total);
    };
    const missSide = (want(7) || want(8) || want(9)) && pcWeapon && clericWeapon;
    if ((want(7) || want(8) || want(9)) && !missSide) log.push(`miss side skipped: pcWeapon=${!!pcWeapon} clericWeapon=${!!clericWeapon}`);
    let VAC = null;
    if (missSide) {
      priorActor[victim.id] = {
        'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null,
        'system.attributes.hp.value': victim.system._source.attributes.hp.value,
        'system.attributes.hp.max': victim.system._source.attributes.hp.max
      };
      await victim.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    }
    const vhp = () => Number(victim.system.attributes.hp.value);
    const swingAt = async (actor, token, w, { d20 = [3], dmg = 3, disadvantage = false } = {}) => {
      await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
      token.control({ releaseOthers: true });
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([...d20.map(n => [n, 20]), [dmg, 6], [dmg, 6], [dmg, 6]]);
      const a = attackOf(actor, w);
      const usage = await a.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await a.rollAttack(disadvantage ? { disadvantage: true } : {}, { configure: false },
        usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      await waitFor(() => msg?.getFlag(MOD, 'hold'), 4000);
      return msg;
    };
    const missTarget = async msg => {
      const h = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      return h?.targets?.find(x => x.uuid === victim.uuid) ?? null;
    };
    const popupTitled = re => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]') && re.test(textOf(app.element))) ?? null;
    const refillDivinity = async () => { const cd = divinity(); if (cd) await cd.update({ 'system.uses.spent': 0 }); };
    const rollPopup = re => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander-roll"]') && re.test(textOf(app.element))) ?? null;
    const rollFlag = m => game.messages.get(m?.id)?.getFlag(MOD, 'bystanderRoll') ?? null;

    // ---- 7. Guided Strike for an ally
    if (want(7) && missSide) {
      await closeDialogs(); await refillDivinity();
      const pcMod = await modOf(pcAttacker, pcWeapon);
      VAC = pcMod + 10;
      await victim.update({ 'system.attributes.ac.override': VAC });
      const msg = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [3] });
      const pop = await waitFor(() => popupTitled(/Guided Strike/), 6000);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      ok('7a. a miss by 7 is held for the Cleric: "Guided Strike … +10 · a Reaction", the hold marked miss',
        !!pop && /\+10/.test(textOf(pop?.element)) && /a Reaction/.test(textOf(pop?.element)) && (holdOf(msg)?.miss === true)
          && guards.some(g => (g.uuid === cleric.uuid) && !g.self),
        `pop=${textOf(pop?.element).slice(0, 180)} hold.miss=${holdOf(msg)?.miss} guards=${JSON.stringify(guards.map(g => [g.name, g.row, !!g.self]))}`);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await missTarget(msg);
      const landed = await waitFor(() => vhp() < 400, 8000);
      ok('7b. the +10 turns it: a HIT (rescue Guided Strike, the Cleric), the damage rolled and landed, a Channel Divinity spent',
        (t?.verdict === 'hit') && (t?.rescue === 'Guided Strike') && (t?.guardedBy?.uuid === cleric.uuid) && (t?.bent?.add === 10) && landed
          && (Number(divinity()?.system?.uses?.spent ?? 0) === 1),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent?.add, hp: vhp(), cd: divinity()?.system?.uses?.spent }));
      await sleep(600);
      ok('7c. the attack card: "Guided Strike (BF Test Cleric) +10 … HIT"', /Guided Strike \(BF Test Cleric\) \+10.*HIT/.test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
    }

    // ---- 8. Guided Strike on the Cleric's own miss
    if (want(8) && missSide) {
      await closeDialogs(); await refillDivinity();
      const clMod = await modOf(cleric, clericWeapon);
      await victim.update({ 'system.attributes.ac.override': clMod + 10 });
      const msg = await swingAt(cleric, clericToken, clericWeapon, { d20: [3] });
      const pop = await waitFor(() => popupTitled(/Guided Strike/), 6000);
      const g = (holdOf(msg)?.targets?.[0]?.guards ?? []).find(x => x.uuid === cleric.uuid);
      ok('8a. its own popup: "your attack", "No Reaction", the entry marked self',
        !!pop && /your attack/.test(textOf(pop?.element)) && /No Reaction/.test(textOf(pop?.element)) && !/a Reaction ·/.test(textOf(pop?.element)) && g?.self === true,
        `pop=${textOf(pop?.element).slice(0, 180)} guard=${JSON.stringify(g)}`);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await missTarget(msg);
      ok('8b. the +10 turns it: a HIT', (t?.verdict === 'hit') && (t?.rescue === 'Guided Strike'), JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue }));
    }

    // ---- 9. Restore Balance on a Disadvantage miss
    if (want(9) && missSide) {
      await closeDialogs(); await refillDivinity();
      await balance.update({ 'system.uses.spent': 0 });
      const pcMod = await modOf(pcAttacker, pcWeapon);
      await victim.update({ 'system.attributes.ac.override': pcMod + 10 });
      const msg = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [18, 3], disadvantage: true });
      const rb = await waitFor(() => popupTitled(/Restore Balance/), 6000);
      const gs = popupTitled(/Guided Strike/);
      ok('9a. the Sorcerer\'s popup ("the first d20 (18) stands") beside the Cleric\'s', !!rb && /first d20 \(18\)/.test(textOf(rb?.element)) && !!gs,
        `rb=${textOf(rb?.element).slice(0, 200)} gs=${!!gs}`);
      rb?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await missTarget(msg);
      await sleep(600);
      ok('9b. the 18 stands: a HIT, rescue Restore Balance; the Cleric\'s popup closed', (t?.verdict === 'hit') && (t?.rescue === 'Restore Balance')
        && (t?.bent?.stood === 18) && !popupTitled(/Guided Strike/),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent, gs: !!popupTitled(/Guided Strike/) }));
    }

    // ---- 10. Restore Balance on a demanded save
    if (want(10)) {
      await closeDialogs(); await balance.update({ 'system.uses.spent': 0 });
      let flameId = attacker.items.find(i => (i.name === 'Sacred Flame') && (i.type === 'spell'))?.id;
      if (!flameId) {
        const src = await findPHB('Sacred Flame', 'spell');
        const data = src?.toObject();
        if (data) { data.system.prepared = 1; data.system.method = 'atwill'; const [it] = await attacker.createEmbeddedDocuments('Item', [data]); flameId = it.id; lentBy.set(attacker, [...(lentBy.get(attacker) ?? []), it.id]); }
      }
      const flameAct = attacker.items.get(flameId)?.system?.activities?.find(a => a.type === 'save');
      if (!flameAct) log.push('§10 skipped: no Sacred Flame save activity');
      else {
        await healFull();
        attackerToken.control({ releaseOthers: true });
        halflingToken.setTarget(true, { releaseOthers: true });
        await sleep(100);
        const use = await flameAct.use({ consume: { spellSlot: false } }, { configure: false }, {});
        const card = use?.message ?? null;
        await waitFor(() => card?.getFlag(MOD, 'saves'), 6000);
        const dc = Number(card?.getFlag(MOD, 'saves')?.dc);
        faces([[10, 20]]);
        const probeSave = await halfling.rollSavingThrow({ ability: 'dex' }, { configure: false }, { create: false });
        const smod = Number(probeSave?.[0]?.total) - 10;
        const hi = Math.min(20, Math.max(1, dc - smod + 2)), lo = Math.max(1, dc - smod - 6);
        await sleep(600);
        faces([[hi, 20], [lo, 20]]);
        const rolls = await halfling.rollSavingThrow({ ability: 'dex', disadvantage: true }, { configure: false }, {});
        const rollMsg = rolls?.[0]?.parent ?? null;
        const pop = await waitFor(() => rollPopup(/Restore Balance/), 8000);
        const entry0 = card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === halfling.uuid);
        ok('10a. the failed save is WITHHELD while the Sorcerer is asked: "Restore Balance — BF Test Halfling\'s saving throw", the first d20 named',
          !!pop && new RegExp(`first d20 \\(${hi}\\)`).test(textOf(pop?.element)) && (rollFlag(rollMsg)?.status === 'pending') && !entry0?.done,
          `dc=${dc} mod=${smod} faces=${hi},${lo} pop=${textOf(pop?.element).slice(0, 200)} flag=${rollFlag(rollMsg)?.status} done=${entry0?.done}`);
        pop?.element?.querySelector('button[data-action="answer"]')?.click();
        const entry = await waitFor(() => { const e = card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === halfling.uuid); return e?.done ? e : null; }, 10000);
        await sleep(600);
        ok('10b. the first die stands: SAVED at the bent total; the roll\'s card names Restore Balance',
          (entry?.outcome === 'saved') && (entry?.total === hi + smod) && /Restore Balance \(BF Test Sorcerer\)/.test(cardText(rollMsg?.id)),
          `entry=${JSON.stringify({ outcome: entry?.outcome, total: entry?.total })} card=${cardText(rollMsg?.id).slice(0, 200)}`);
      }
    }

    // ---- 11. Cutting Words on a hostile's check
    if (want(11)) {
      await closeDialogs(); await refillInspiration();
      faces([[14, 20]]);
      const rolls = await attacker.rollSkill({ skill: 'ath' }, { configure: false }, {});
      const msg = rolls?.[0]?.parent ?? null;
      const pop = await waitFor(() => rollPopup(/Cutting Words/), 8000);
      ok('11a. the Bard\'s popup: "Cutting Words — BF Test Attacker\'s check", no DC known', !!pop && /No DC is known/.test(textOf(pop?.element)),
        textOf(pop?.element).slice(0, 220));
      faces([[5, 8]]);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const flag = await waitFor(() => (rollFlag(msg)?.status === 'resolved') ? rollFlag(msg) : null, 8000);
      await sleep(600);
      ok('11b. the d8 (5) off: the card states the arithmetic and "ask your DM"', (flag?.answer === 'roll') && (flag?.bent?.add === -5)
        && /Cutting Words \(BF Test Bard\) −5/.test(cardText(msg?.id)) && /ask your DM/.test(cardText(msg?.id)),
        `flag=${JSON.stringify({ answer: flag?.answer, bent: flag?.bent?.add })} card=${cardText(msg?.id).slice(-200)}`);
    }

    // ---- 12. everyone passes
    if (want(12)) {
      await closeDialogs(); await refillInspiration(); await balance.update({ 'system.uses.spent': 0 });
      faces([[6, 20], [14, 20]]);   // the FIRST die the lower: cancelling the Advantage changes the roll
      const rolls = await attacker.rollSkill({ skill: 'ath', advantage: true }, { configure: false }, {});
      const msg = rolls?.[0]?.parent ?? null;
      const a = await waitFor(() => rollPopup(/Cutting Words/), 8000);
      const b = await waitFor(() => rollPopup(/Restore Balance/), 4000);
      ok('12a. both asked on an Advantage check', !!a && !!b, `cw=${!!a} rb=${!!b} guards=${JSON.stringify((rollFlag(msg)?.guards ?? []).map(g => g.row))}`);
      a?.element?.querySelector('button[data-action="pass"]')?.click();
      await sleep(400);
      b?.element?.querySelector('button[data-action="pass"]')?.click();
      const flag = await waitFor(() => (rollFlag(msg)?.status === 'resolved') ? rollFlag(msg) : null, 8000);
      await sleep(500);
      ok('12b. resolved as a pass; nothing on the card', (flag?.answer === 'pass') && !/Reaction — /.test(cardText(msg?.id)),
        `answer=${flag?.answer} card=${cardText(msg?.id).slice(-160)}`);
    }


    // ================================================ §A1 — the PHB classes' band-A rows (RULINGS *The PHB classes — A1*)
    // Each section lends what it needs and takes it back (`unlend`); the A3 lends leave first, so no bystander fires.
    const unlend = async (actor, item) => {
      const id = item?.id ?? item;
      if (!id) return;
      if (actor.items.get(id)) await actor.deleteEmbeddedDocuments('Item', [id]).catch(() => {});
      lentBy.set(actor, (lentBy.get(actor) ?? []).filter(x => x !== id));
    };
    if (!sections || sections.some(s => Number(s) >= 13)) {
      await closeDialogs();
      for (const [actor, name] of [[bard, 'Cutting Words'], [cleric, 'Guided Strike'], [sorcerer, 'Restore Balance']]) {
        for (const it of actor.items.filter(i => (i.name === name) && (lentBy.get(actor) ?? []).includes(i.id))) await unlend(actor, it);
      }
    }
    // ---- A1 hold helpers (§13, §14, §16)
    const dropReactionChips = async actor => {
      const ids = actor.effects.filter(e => e.getFlag(MOD, 'mastery') === 'reaction').map(e => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
    };
    const reactionChipOn = actor => actor.effects.find(e => e.getFlag(MOD, 'mastery') === 'reaction') ?? null;
    const titleOf = app => String(app?.title ?? app?.options?.window?.title ?? '');
    // Glorious Defense's strike popup carries no tick rows: found by its title / its question.
    const strikePopup = () => popups().find(app => /strike back/.test(titleOf(app)) || /Strike .+ with .+\?/.test(textOf(app.element))) ?? null;
    // Deflect Attacks: the Halfling's rescue popup (Lucky rides beside, greyed) or, without a roll row, the maneuver popup.
    const deflectPopup = () => rescuePopup()
      ?? popups().find(app => app.element?.querySelector?.('button[data-action="cast"]') && /Deflect Attacks/.test(textOf(app.element))) ?? null;
    const answerDeflect = async pop => {
      const box = [...(pop?.element?.querySelectorAll?.('input[name="bf-rescue"]') ?? [])].find(b => b.value === 'Deflect Attacks');
      if (box) {
        if (!box.checked) box.click();
        await sleep(50);
        pop?.element?.querySelector('button[data-action="answer"]')?.click();
      } else pop?.element?.querySelector('button[data-action="cast"]')?.click();
    };
    // ---- A1 helpers: the damage offer, the clock riders, Hew's reminders (§15, §17–§20)
    const { riderPartFormula } = await import('/modules/fvtt-mod-battleflow/scripts/decide/clock.js');
    const reEsc = s => String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const OFFER = 'Damage — your roll';
    const offerApp = before => popups().find(app => !before.has(app) && (app.element?.innerHTML ?? '').includes(OFFER)) ?? null;
    const closeOffers = async () => {   // ⚠ closing an offer ROLLS it (its X is not a veto) — only at a section's end
      for (const app of popups()) if ((app.element?.innerHTML ?? '').includes(OFFER)) { try { await app.close(); } catch { /* gone */ } }
    };
    /** Once per section: the Victim hittable (AC 1) with 400 max HP; its originals recorded for the teardown. */
    const a1Victim = async () => {
      priorActor[victim.id] = {
        'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null,
        'system.attributes.hp.value': victim.system._source.attributes.hp.value,
        'system.attributes.hp.max': victim.system._source.attributes.hp.max,
        'system.traits.size': victim.system._source.traits?.size ?? 'med',
        ...(priorActor[victim.id] ?? {})   // an earlier record (the miss side's) holds the ORIGINALS: it wins
      };
      await victim.update({ 'system.attributes.ac.override': 1, 'system.attributes.hp.max': 400 });
    };
    /** `actor` hits the Victim (d20 19, AC 1) with `activity`, the Victim set to `hpTo` first. A spell skips the
     * usage card (a volley's use() would open the aim — the rider rides the attack roll alone). Returns the attack
     * message and the NEW damage offer, or null when none opens within `offerWait`. */
    const a1Hit = async (_actor, token, activity, { hpTo = 400, offerWait = 4000 } = {}) => {
      await victim.update({ 'system.attributes.hp.value': hpTo, 'system.attributes.hp.temp': 0 });
      token.control({ releaseOthers: true });
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const before = new Set(popups());
      faces([[19, 20], [19, 20], [3, 6]]);   // a second d20 if the gate adds Advantage (Reckless); assert flags, not faces
      const usage = (activity.item?.type === 'spell') ? null : await activity.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await activity.rollAttack({}, { configure: false }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      const offer = await waitFor(() => offerApp(before), offerWait);
      return { msg, offer };
    };
    const a1Damage = msg => waitFor(() => { const d = damageFor(msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
    const a1Roll = async (msg, offer) => {
      offer?.element?.querySelector('button[data-action="roll"]')?.click();
      return a1Damage(msg);
    };
    const ridersOf = d => d?.getFlag(MOD, 'clockRiders')?.riders ?? [];
    const riderRow = (offer, key) => textOf(offer?.element?.querySelector(`[data-bf-rider-row="${key}"]`));
    const riderBox = (offer, key) => offer?.element?.querySelector(`input[name="bf-rider"][value="${key}"]`) ?? null;
    /** A rider row's formula as clock-riders.js reads it: the activity's first part, resolved on the attacker. */
    const a1Formula = (item, activityName, actor) => {
      const act = item?.system?.activities?.find?.(a => a.name === activityName) ?? null;
      const p = act?.damage?.parts?.[0];
      const raw = p ? riderPartFormula({ number: p.number, denomination: p.denomination, custom: p.custom, bonus: p.bonus }) : null;
      let formula = null;
      try { const r = raw ? Roll.replaceFormulaData(raw, actor.getRollData()) : null; formula = (r && Roll.validate(r)) ? r : null; } catch { formula = null; }
      return { act, raw, formula };
    };
    const hewNotices = (since, label) => game.messages.contents.filter(m => (m.timestamp >= since) && (m.getFlag(MOD, 'hewNotice')?.label === label));
    const hewPopup = label => popups().find(app => (app.element?.innerHTML ?? '').includes(`${label} — `) && app.element?.querySelector?.('button[data-action="ok"]')) ?? null;
    const ackHew = async label => { for (let i = 0; i < 3; i++) { const p = hewPopup(label); if (!p) return; p.element.querySelector('button[data-action="ok"]')?.click(); await sleep(300); } };
    const riderChits = actor => actor.effects.filter(e => e.getFlag(MOD, 'mastery') === 'rider').map(e => e.id);
    const dropEffects = async (actor, ids) => { const live = ids.filter(id => actor.effects.get(id)); if (live.length) await actor.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {}); };
    // ---- A1 heal-group helpers (§21–23)
    // Keep an actor's SOURCE values for teardown; an earlier section's record wins (it holds the true originals).
    const hgKeep = (actor, data) => { priorActor[actor.id] = { ...data, ...(priorActor[actor.id] ?? {}) }; };
    // Lend a PHB item of any type, its compendium source stamped (dnd5e resolves a consumption target by it); null if absent.
    const hgLend = async (actor, name, type, patch = null) => {
      const source = await findPHB(name, type);
      if (!source) { log.push(`the PHB ships no ${type} "${name}" this box can find`); return null; }
      const data = source.toObject();
      foundry.utils.setProperty(data, '_stats.compendiumSource', source.uuid);
      const [item] = await actor.createEmbeddedDocuments('Item', [data]);
      lentBy.set(actor, [...(lentBy.get(actor) ?? []), item.id]);
      if (patch) await item.update(patch);
      return actor.items.get(item.id);
    };
    // Close the moment popups by window title (they carry no [data-bf-ticks] marker, so closeDialogs misses them).
    const hgClose = async re => {
      for (const app of popups()) if (re.test(app.title ?? app.options?.window?.title ?? '')) { try { await app.close(); } catch { /* gone */ } }
    };
    // A sure hit (natural 20) by anyone at any token, the damage auto-rolled and applied; the attack message back.
    const hgStrike = async (actor, token, w, targetToken) => {
      token.control({ releaseOthers: true });
      targetToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([[20, 20], [20, 20], [4, 6]]);
      const a = attackOf(actor, w);
      const usage = await a.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await a.rollAttack({}, { configure: false },
        usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      return rolls?.[0]?.parent ?? null;
    };
    const hgPickButton = label => [...document.querySelectorAll('.application.dialog button[data-action^="pick-"]')].find(b => textOf(b) === label) ?? null;
    // ---- A1 §24–§27 helpers (the Rage, the gate, the dialogs)
    const clearTargets = () => game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
    const actNamed = (item, name = null) => [...(item?.system?.activities ?? [])].find(a => !name || (a.name === name)) ?? null;
    // A feature's activity used as its bearer, aimed at the bearer's own token (a self activity ignores it; a
    // targeted one gets the bearer). No consumption: the lends sit on sheets with no Barbarian levels.
    const useFeature = async (token, item, name = null) => {
      token.control({ releaseOthers: true });
      token.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const r = await actNamed(item, name)?.use({ consume: { resources: false, action: false, spellSlot: false }, subsequentActions: false }, { configure: false }, {});
      clearTargets();
      return r?.message ?? null;
    };
    const fxNamed = (actor, names) => actor.effects.filter(e => names.includes(e.name));
    const dropFx = async (actor, names) => {
      const ids = fxNamed(actor, names).map(e => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
    };
    const rollDialog = () => [...foundry.applications.instances.values()]
      .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element) ?? null;
    // The roll dialogs, the pick popups and the d20 fold's rescue windows — none carry [data-bf-ticks].
    const closeA1 = async () => {
      for (const app of [...foundry.applications.instances.values()]) {
        const ours = /RollConfigurationDialog/.test(app.constructor?.name ?? '')
          || app.element?.querySelector?.('[data-bf-rescue-row], button[data-action^="pick-"]');
        if (ours) { try { await app.close(); } catch { /* gone */ } }
      }
      await closeDialogs();
    };
    // The attack gate as `actorToken` attacks `targetToken` with `activity` (smoke-emanations' gateAt): the text
    // and the net, the dialog closed unrolled.
    const gateFor = async (actorToken, activity, targetToken) => {
      actorToken.control({ releaseOthers: true });
      clearTargets();
      targetToken.setTarget(true, { releaseOthers: true });
      await sleep(120);
      const p = activity?.rollAttack({}, {}, {});
      const app = await waitFor(rollDialog, 6000);
      await sleep(400);
      const text = textOf(app?.element?.querySelector('[data-bf-reminder]'));
      const net = app?.options?.bfReminder?.net ?? null;
      try { await app?.close(); } catch { /* gone */ }
      await Promise.resolve(p).catch(() => {});
      return { text, net, open: !!app };
    };
    // The Victim's HP/AC recorded once (the miss side records it when §7–9 ran).
    const victimPrior = () => {
      if (priorActor[victim.id]) return;
      priorActor[victim.id] = {
        'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null,
        'system.attributes.hp.value': victim.system._source.attributes.hp.value,
        'system.attributes.hp.max': victim.system._source.attributes.hp.max
      };
    };
    const RAGE_FX = ['Rage', 'Rage of the Wolf'];
    // ---- 13. Glorious Defense: the paladin's Cha off an attack on a creature within 10 ft; the strike after
    if (want(13)) {
      await closeDialogs(); await spendLuck();
      const gd = await lend(cleric, 'Glorious Defense');
      const gdAct = gd.system.activities?.find?.(a => a.name === 'Glorious Defense') ?? null;
      // UNSURE: the pack's uses max (a Cha-mod formula, long rest?). Forced to a live pool when it reads 0.
      if (!(Number(gd.system.uses?.max) > 0)) { log.push(`§13: Glorious Defense ships uses.max="${gd.system.uses?.max}" — forced to 2`); await gd.update({ 'system.uses.max': '2' }); }
      await gd.update({ 'system.uses.spent': 0 });
      const spentBefore = Number(cleric.items.get(gd.id)?.system?.uses?.spent ?? 0);
      const N = Math.max(1, Number(cleric.getRollData()?.abilities?.cha?.mod ?? 0));
      // The hit by exactly 0: the attack total = the Halfling's AC, so −N (N ≥ 1) always turns it (the margin gate asks).
      const d = Math.max(2, Math.min(19, Number(halfling.system.attributes.ac.value) - atkMod));
      const msg = await swing({ d20: [d] });
      const pop = await waitFor(() => popupTitled(/Glorious Defense/), 6000);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      const g = guards.find(x => (x.uuid === cleric.uuid) && (x.row === 'Glorious Defense'));
      ok(`13a. the hit on the Halfling (within 10 ft of the Cleric) is held for the Cleric: a bystander popup "Glorious Defense … −${N} · a Reaction", "within 10 ft of BF Test Halfling"`,
        !!pop && new RegExp(`−${N}\\b`).test(textOf(pop?.element)) && /a Reaction/.test(textOf(pop?.element))
          && /within 10 ft of BF Test Halfling/.test(textOf(pop?.element)) && !!g && !g.quiet && (String(g.die) === String(N)),
        `N=${N} d20=${d} activity=${!!gdAct} pop="${textOf(pop?.element).slice(0, 220)}" guards=${JSON.stringify(guards.map(x => [x.name, x.row, x.die, x.quiet ?? false]))}`);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await resolvedTarget(msg);
      const spentAfter = Number(cleric.items.get(gd.id)?.system?.uses?.spent ?? 0);
      ok(`13b. −${N} off the attack: a MISS, answered by the Cleric (rescue Glorious Defense), one use spent, no damage`,
        (t?.answer === 'roll') && (t?.verdict === 'miss') && (t?.rescue === 'Glorious Defense') && (t?.guardedBy?.uuid === cleric.uuid)
          && (t?.bent?.add === -N) && (spentAfter === spentBefore + 1) && (hp() === 400),
        JSON.stringify({ answer: t?.answer, verdict: t?.verdict, rescue: t?.rescue, by: t?.guardedBy?.name, bent: t?.bent, spent: [spentBefore, spentAfter],
          consumption: gdAct?.consumption?.targets?.map?.(c => [c.type, c.target]) ?? null, hp: hp() }));
      await sleep(600);
      ok(`13c. the attack card: "Glorious Defense (BF Test Cleric) −${N} … MISS"`,
        new RegExp(`Glorious Defense \\(BF Test Cleric\\) −${N}.*MISS`).test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
      // The turned hit: the Strike popup (answer.js offerStrike) — one weapon attack at the attacker.
      const strike = await waitFor(strikePopup, 6000);
      const attackerName = attackerToken.document?.name ?? attacker.name;
      ok(`13d. the Strike popup: "Glorious Defense — strike back", "Strike ${attackerName} with <weapon>?", Strike and Pass`,
        !!strike && new RegExp(`Strike ${attackerName} with .+\\?`).test(textOf(strike?.element))
          && !!strike?.element?.querySelector('button[data-action="strike"]') && !!strike?.element?.querySelector('button[data-action="pass"]'),
        `title="${titleOf(strike)}" text="${textOf(strike?.element).slice(0, 200)}"`);
      // A natural 1: the driven attack misses — nothing lands on the Attacker, no chain to follow.
      const since = Date.now();
      faces([[1, 20]]);
      strike?.element?.querySelector('button[data-action="strike"]')?.click();
      const driven = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= since) && (m.getFlag(MOD, 'riposteFor') === msg?.id)
        && m.rolls?.length && (m.getAssociatedActor?.()?.uuid === cleric.uuid)), 10000);
      const tgt = driven?.system?.targets ?? [];
      ok('13e. Strike drives ONE weapon attack by the Cleric, marked riposteFor the turned attack',
        !!driven && (game.messages.contents.filter(m => (m.timestamp >= since) && (m.getFlag(MOD, 'riposteFor') === msg?.id) && m.rolls?.length).length === 1),
        `driven=${!!driven} item=${driven?.getAssociatedActivity?.()?.item?.name ?? null} d20=${driven?.rolls?.[0]?.total}`);
      ok('13f. the driven attack is AT the Attacker (its targets name it)', tgt.some?.(x => (x.actor ?? x.uuid) === attacker.uuid),
        `targets=${JSON.stringify((tgt ?? []).map?.(x => [x.name, x.actor ?? x.uuid]) ?? tgt)}`);
      await sleep(800);
      try { await strikePopup()?.close(); } catch { /* gone */ }
      await closeDialogs();
      await unlend(cleric, gd);
    }

    // ---- 14. Combat Inspiration — Defense: the hit creature's own Inspired die, its Reaction
    if (want(14)) {
      await closeDialogs(); await spendLuck(); await dropReactionChips(halfling);
      const ci = await lend(bard, 'Combat Inspiration');
      // The die the code reads (lookup.js inspiredDieOf): the BARD's scale.bard.inspiration formula.
      const scale = foundry.utils.getProperty(bard.getRollData(), 'scale.bard.inspiration');
      const die = String(scale?.formula ?? scale?.die ?? '').trim();
      const denom = Number(/d(\d+)/.exec(die)?.[1] ?? 0);
      // The shape the Bard's Inspire activity lands (fixture-d20-folds.mjs): the origin is the way back to the Bard.
      const [inspired] = await halfling.createEmbeddedDocuments('ActiveEffect', [{
        name: 'Inspired', img: 'icons/magic/light/hand-sparks-smoke-green.webp',
        origin: (inspiration() ?? ci).uuid, duration: { seconds: 3600 }, transfer: false, disabled: false, changes: []
      }]);
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      await combat.createEmbeddedDocuments('Combatant', [attackerDoc, halflingDoc, bardDoc].map((d, i) =>
        ({ tokenId: d.id, sceneId: scene.id, actorId: d.actorId, initiative: 20 - i })));
      await combat.startCombat();
      await sleep(400);
      try {
        const msg = await swing({ d20: [12] });   // a hit by 2: any Bardic die can turn it
        const pop = await waitFor(() => popupTitled(/Combat Inspiration/), 6000);
        const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
        const g = guards.find(x => x.uuid === halfling.uuid);
        ok(`14a. the Halfling's OWN popup: "Combat Inspiration … −${die} · a Reaction · the Inspired die", "BF Test Bard's Inspired die"`,
          !!pop && denom > 0 && textOf(pop?.element).includes(`−${die}`) && /a Reaction/.test(textOf(pop?.element))
            && /the Inspired die/.test(textOf(pop?.element)) && /BF Test Bard's Inspired die/.test(textOf(pop?.element))
            && g?.hitSelf === true && (g?.inspired?.effectId === inspired.id),
          `die=${die} pop="${textOf(pop?.element).slice(0, 240)}" guard=${JSON.stringify(g ?? null)}`);
        ok('14b. nobody else is asked (only: "self"): the hold\'s guards are the Halfling alone',
          guards.length > 0 && guards.every(x => x.uuid === halfling.uuid) && popups().filter(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]')).length === 1,
          `guards=${JSON.stringify(guards.map(x => [x.name, x.row]))}`);
        faces([[5, denom || 6]]);
        pop?.element?.querySelector('button[data-action="answer"]')?.click();
        const t = await resolvedTarget(msg);
        await sleep(600);
        ok('14c. the die (5) off the attack: a MISS, the Halfling answered for itself (rescue Combat Inspiration)',
          (t?.answer === 'roll') && (t?.verdict === 'miss') && (t?.rescue === 'Combat Inspiration') && (t?.guardedBy?.uuid === halfling.uuid)
            && (t?.bent?.add === -5) && (hp() === 400),
          JSON.stringify({ answer: t?.answer, verdict: t?.verdict, rescue: t?.rescue, by: t?.guardedBy?.name, bent: t?.bent, hp: hp() }));
        ok('14d. the Inspired effect is spent (deleted) and the Halfling\'s Reaction is spent (the chip)',
          !halfling.effects.get(inspired.id) && !!reactionChipOn(halfling),
          `inspired=${!!halfling.effects.get(inspired.id)} chip=${reactionChipOn(halfling)?.name ?? null}`);
        ok('14e. the attack card: "Combat Inspiration (BF Test Halfling) −5 … MISS"',
          /Combat Inspiration \(BF Test Halfling\) −5.*MISS/.test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
      } finally {
        await closeDialogs();
        if (game.combats.get(combat.id)) await combat.delete();
        await dropReactionChips(halfling);
        if (halfling.effects.get(inspired.id)) await halfling.deleteEmbeddedDocuments('ActiveEffect', [inspired.id]).catch(() => {});
        await unlend(bard, ci);
      }
    }

    // ---- 15. Combat Inspiration — Offense: the Inspired ally's die, UNTICKED on the offer
    if (want(15)) {
      await closeDialogs(); await a1Victim();
      const bardic = inspiration();
      if (!pcWeapon || !bardic) log.push(`§15 skipped: pcWeapon=${!!pcWeapon} bardic=${!!bardic}`);
      else {
        const ci = await lend(bard, 'Combat Inspiration');
        const scale = foundry.utils.getProperty(bard.getRollData(), 'scale.bard.inspiration');
        const die = String(scale?.formula ?? scale?.die ?? '').trim();          // clock-riders.js inspiredFrom's read
        const norm = s => String(s ?? '').replace(/\s+/g, '').replace(/^1d/, 'd');
        // The d20-folds suite's seed: the effect's origin is the Bard's Bardic Inspiration (grantingActor → the Bard).
        const seed = async () => (await pcAttacker.createEmbeddedDocuments('ActiveEffect', [{ name: 'Inspired',
          img: 'icons/magic/light/hand-sparks-smoke-green.webp', origin: bardic.uuid, duration: { seconds: 3600 },
          transfer: false, disabled: false, changes: [] }]))[0];
        try {
          const act = attackOf(pcAttacker, pcWeapon);
          const eff = await seed();
          const { msg, offer } = await a1Hit(pcAttacker, pcToken, act);
          const box = riderBox(offer, 'combat-inspiration');
          ok(`15a. an Inspired ally hits: the offer's UNTICKED row "Combat Inspiration — ${die}"`,
            !!die && !!box && !box.checked && new RegExp(`Combat Inspiration — ${reEsc(die)}`).test(riderRow(offer, 'combat-inspiration')),
            `die=${die} offer=${!!offer} box=${!!box} checked=${box?.checked} row="${riderRow(offer, 'combat-inspiration')}"`);
          box?.click();
          await sleep(50);
          const dmg = await a1Roll(msg, offer);
          const r = ridersOf(dmg).find(x => x.key === 'combat-inspiration');
          const gone = await waitFor(() => !pcAttacker.effects.get(eff.id), 6000);
          ok('15b. ticked, the die rides as its own part (the attack\'s own damage type), the pick recorded, the Inspired effect spent',
            !!r && (norm(r.formula) === norm(die)) && !!r.type && (dmg?.rolls ?? []).some(x => norm(x.formula) === norm(die))
              && (msg?.getFlag(MOD, 'clockPick') ?? []).includes('combat-inspiration') && gone,
            `rider=${JSON.stringify(r)} formulas=[${(dmg?.rolls ?? []).map(x => `${x.formula}:${x.options?.type}`).join(' | ')}] pick=${JSON.stringify(msg?.getFlag(MOD, 'clockPick'))} effectGone=${gone}`);
          await sleep(600);
          ok('15c. the damage card: "Combat Inspiration — … rode this roll · BF Test Bard\'s Inspired die spent"',
            /Combat Inspiration — .*rode this roll/.test(cardText(dmg?.id)) && /BF Test Bard's Inspired die spent/.test(cardText(dmg?.id)),
            cardText(dmg?.id).slice(0, 260));

          // A DRIVEN roll: the damage rolled with no offer committed (no clockPick) — rollDamageForAttack's own call.
          const eff2 = await seed();
          const { msg: m2, offer: o2 } = await a1Hit(pcAttacker, pcToken, act);
          const dr = await act.rollDamage({ ability: m2?.system?.ability, attackMode: m2?.system?.mode, isCritical: false },
            { configure: false }, { data: { flags: { [MOD]: { attackFor: m2?.id } } } });
          // UNSURE: a damage roll's `.parent` as rollAttack's is — the fallback finds the first damage for the attack
          const driven = dr?.[0]?.parent ?? game.messages.contents.find(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === m2?.id)) ?? null;
          await sleep(600);
          ok('15d. a driven roll (no pick on the attack) never rides it: no Combat Inspiration part or record, the Inspired effect stands',
            !!driven && !m2?.getFlag(MOD, 'clockPick') && !ridersOf(driven).some(x => x.key === 'combat-inspiration')
              && !(driven.rolls ?? []).some(x => norm(x.formula) === norm(die)) && !!pcAttacker.effects.get(eff2.id),
            `driven=${!!driven} pick=${JSON.stringify(m2?.getFlag(MOD, 'clockPick'))} riders=${JSON.stringify(ridersOf(driven).map(x => x.key))} formulas=[${(driven?.rolls ?? []).map(x => x.formula).join(' | ')}] inspired=${!!pcAttacker.effects.get(eff2.id)}`);
          // …and the offer still open for that attack, rolled as it stands (unticked): the pick is empty, nothing rides.
          const n0 = game.messages.contents.filter(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === m2?.id)).length;
          o2?.element?.querySelector('button[data-action="roll"]')?.click();
          const d2 = await waitFor(() => game.messages.contents.filter(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === m2?.id))[n0] ?? null, 12000);
          await sleep(400);
          ok('15e. left unticked on the offer: the pick records nothing, nothing rides, the Inspired effect stands',
            !!o2 && Array.isArray(m2?.getFlag(MOD, 'clockPick')) && (m2.getFlag(MOD, 'clockPick').length === 0)
              && !ridersOf(d2).some(x => x.key === 'combat-inspiration') && !!pcAttacker.effects.get(eff2.id),
            `offer=${!!o2} pick=${JSON.stringify(m2?.getFlag(MOD, 'clockPick'))} d2=${!!d2} riders=${JSON.stringify(ridersOf(d2).map(x => x.key))} inspired=${!!pcAttacker.effects.get(eff2.id)}`);
        } finally {
          await closeOffers();
          await dropEffects(pcAttacker, pcAttacker.effects.filter(e => e.name === 'Inspired').map(e => e.id));
          await unlend(bard, ci);
        }
      }
    }

    // ---- 16. Deflect Attacks: rolled at the answer (Parry's path), the type judge, the Redirect at 0
    if (want(16)) {
      await closeDialogs(); await spendLuck(); await dropReactionChips(halfling);
      const BPS = ['bludgeoning', 'piercing', 'slashing'];
      const deflect = await lend(halfling, 'Deflect Attacks');
      const reduceAct = [...(deflect.system.activities ?? [])].find(a => a.name?.toLowerCase() === 'reduce')
        ?? [...(deflect.system.activities ?? [])].find(a => (a.type === 'heal') && !a._source?.name) ?? null;
      const redirectAct = [...(deflect.system.activities ?? [])].find(a => a.name === 'Redirect') ?? null;
      const h = reduceAct?.healing;
      const packFormula = h ? (h.custom?.enabled ? h.custom.formula : `${h.number}d${h.denomination}${h.bonus ? ` + ${h.bonus}` : ''}`) : '';
      // "Monk level": the Halfling is a Rogue 3 — a bare Monk class (3 levels) so @classes.monk.levels resolves.
      // UNSURE: a bare class item made by createEmbeddedDocuments (no advancement) is enough for the roll data.
      let monk = null;
      if (/monk/i.test(packFormula) && !halfling.getRollData()?.classes?.monk) {
        [monk] = await halfling.createEmbeddedDocuments('Item', [{ name: 'Monk', type: 'class',
          system: { identifier: 'monk', levels: 3, hd: { denomination: 'd8' } } }]);
        lentBy.set(halfling, [...(lentBy.get(halfling) ?? []), monk.id]);
      }
      // The Redirect's cost: Focus Points. UNSURE: the Redirect's consumption targets the Monk's Focus item.
      let focus = null;
      try { focus = await hgLend(halfling, "Monk's Focus", 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 }); }
      catch (err) { log.push(`§16: no Monk's Focus lent (${err?.message})`); }
      const w = attacker.items.get(weapon.id);
      const priorTypes = [...(w.system._source.damage?.base?.types ?? [])];
      try {
        // (a) a slashing / piercing / bludgeoning hit — the goblin's own weapon
        const dealt = [...new Set([...(act().damage?.parts ?? []).flatMap(p => [...(p.types ?? [])]),
          ...((act().damage?.includeBase !== false) ? [...(w.system.damage?.base?.types ?? [])] : [])])];
        const msg = await swing({ d20: [12], dmg: 1 });
        const pop = await waitFor(deflectPopup, 6000);
        const t0 = holdOf(msg)?.targets?.find(x => x.uuid === halfling.uuid);
        ok('16a. a B/P/S hit is held for Deflect Attacks as a DAMAGE reduction with the pack\'s formula; the Halfling\'s popup lists it ("reduces the damage")',
          dealt.some(x => BPS.includes(x)) && !!pop && (t0?.reaction === 'Deflect Attacks') && (t0?.kind === 'damage') && !!t0?.reduce?.formula
            && /Deflect Attacks/.test(textOf(pop?.element)),
          `dealt=${dealt} formula="${t0?.reduce?.formula}" pack="${packFormula}" pop="${textOf(pop?.element).slice(0, 200)}"`);
        const since = Date.now();
        faces([[10, 10], [1, 6]]);   // the d10 at 10; the damage die after it at 1 — the damage lands at 0
        await answerDeflect(pop);
        const resolved = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
        const rt = resolved?.targets?.find(x => x.uuid === halfling.uuid);
        const dieMsg = game.messages.contents.filter(m => (m.timestamp >= since) && /Deflect Attacks — the die/.test(m.flavor ?? '')).at(-1);
        const rd = halfling.getRollData();
        const monkLevel = Number(rd?.classes?.monk?.levels ?? 0);
        const dexMod = Number(rd?.abilities?.dex?.mod ?? 0);
        // UNSURE: the pack formula is 1d10 + @abilities.dex.mod + @classes.monk.levels (read off the row's `by`).
        const expected = 10 + dexMod + monkLevel;
        ok(`16b. the answer rolls the reduction IN THE OPEN: 1d10 (10) + Dex (${dexMod}) + Monk level (${monkLevel}) = ${expected}, riding the hold`,
          (rt?.answer === 'cast') && (Number(rt?.reduceBy) === expected) && !!dieMsg && (dieMsg.rolls?.[0]?.total === rt?.reduceBy),
          `reduceBy=${rt?.reduceBy} die=${dieMsg?.rolls?.[0]?.formula}=${dieMsg?.rolls?.[0]?.total} formula="${rt?.reduce?.formula}"`);
        const dmg = await waitFor(() => { const m = damageFor(msg?.id); return m?.getFlag(MOD, 'receipt') ? m : null; }, 12000);
        const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(x => x.uuid === halfling.uuid);
        const full = (dmg?.rolls ?? []).reduce((n, r) => n + Number(r.total ?? 0), 0);
        ok('16c. the damage lands at 0 through the receipt ("Deflect Attacks — reduced by"); the Halfling untouched',
          !!receipt && (Number(receipt.taken) === 0) && /Deflect Attacks — reduced by/.test(receipt.note ?? '') && (hp() === 400),
          `full=${full} taken=${receipt?.taken} note="${receipt?.note}" hp=${hp()}`);
        // The Redirect at 0 (views.js `atZero`): on the DAMAGE card, the defender's client.
        const redirectBtn = await waitFor(() => [...(cardEl(dmg?.id)?.querySelectorAll?.('button') ?? [])].find(b => b.textContent.trim() === 'Redirect'), 6000);
        ok('16d. the damage card offers "Redirect — at the attacker?" with a Redirect button',
          !!redirectBtn && /Redirect — at the attacker\?/.test(cardText(dmg?.id)) && /Deflect Attacks — the damage is 0/.test(cardText(dmg?.id)),
          `button=${!!redirectBtn} redirectActivity=${!!redirectAct} card="${cardText(dmg?.id).slice(-240)}"`);
        const focusBefore = Number(focus ? (halfling.items.get(focus.id)?.system?.uses?.spent ?? 0) : 0);
        const since2 = Date.now();
        redirectBtn?.click();
        const card = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= since2)
          && (m.getAssociatedActivity?.()?.id === redirectAct?.id)), 10000);
        const atZero = game.messages.get(dmg?.id)?.getFlag(MOD, 'atZero')?.[halfling.id] ?? null;
        const cardTargets = card?.system?.targets ?? [];
        const demanded = card?.getFlag(MOD, 'saves')?.targets ?? [];
        // UNSURE: `withTargets` around `use()` lands the attacker on the save card (dnd5e targets, or the module's save demand).
        ok('16e. Redirect used once, AT the Attacker: the damage card records it, the Redirect save card names the Attacker',
          (atZero?.activity === 'Redirect') && !!card
            && ((cardTargets.some?.(x => (x.actor ?? x.uuid) === attacker.uuid)) || demanded.some?.(x => x.uuid === attacker.uuid)),
          `atZero=${JSON.stringify(atZero)} card=${!!card} targets=${JSON.stringify(cardTargets)} demand=${JSON.stringify(demanded.map?.(x => x.name) ?? null)} consumption=${JSON.stringify(redirectAct?.consumption?.targets?.map?.(c => [c.type, c.target]) ?? null)}`);
        // UNSURE: the Redirect's cost is 1 Focus Point off Monk's Focus (the pack's own consumption).
        ok('16f. the Redirect\'s own cost is paid (a Focus Point); the button is gone (once per card)',
          (!focus || (Number(halfling.items.get(focus.id)?.system?.uses?.spent ?? 0) === focusBefore + 1))
            && ![...(cardEl(dmg?.id)?.querySelectorAll?.('button') ?? [])].some(b => b.textContent.trim() === 'Redirect'),
          `focus ${focusBefore}→${focus ? halfling.items.get(focus.id)?.system?.uses?.spent : 'none'}`);
        await sleep(800);
        await closeDialogs();
        for (const app of popups()) if (/Redirect/.test(textOf(app.element))) { try { await app.close(); } catch { /* gone */ } }

        // (b) a FIRE hit asks nothing — the type judge (the weapon's base types flipped for the section)
        const partTypes = (act().damage?.parts ?? []).flatMap(p => [...(p.types ?? [])]);
        if (partTypes.some(x => BPS.includes(x))) log.push(`§16g/h skipped: the attacker's activity carries its own B/P/S parts (${partTypes})`);
        else {
          await w.update({ 'system.damage.base.types': ['fire'] });
          await spendLuck();
          const msg2 = await swing({ d20: [12] });
          await sleep(1200);
          await waitFor(() => hp() < 400, 6000);
          ok('16g. a fire hit asks nothing: no hold, no popup, the damage lands', !holdOf(msg2) && !deflectPopup() && (hp() < 400),
            `hold=${JSON.stringify(holdOf(msg2)?.targets?.map?.(x => x.reaction) ?? null)} hp=${hp()} dealt=${JSON.stringify(attacker.items.get(weapon.id)?.system?.damage?.base?.types ?? null)}`);
          // (c) Deflect Energy lifts the judge
          const energy = await lend(halfling, 'Deflect Energy');
          try {
            const msg3 = await swing({ d20: [12] });
            const pop3 = await waitFor(deflectPopup, 6000);
            ok('16h. with Deflect Energy the fire hit is held for Deflect Attacks', !!pop3 && (holdOf(msg3)?.targets?.[0]?.reaction === 'Deflect Attacks'),
              `pop=${!!pop3} reaction=${holdOf(msg3)?.targets?.[0]?.reaction}`);
            pop3?.element?.querySelector('button[data-action="pass"]')?.click();
            await waitFor(() => (holdOf(msg3)?.status === 'resolved'), 10000);
          } finally { await closeDialogs(); await unlend(halfling, energy); }
        }
      } finally {
        await attacker.items.get(weapon.id)?.update({ 'system.damage.base.types': priorTypes }).catch(() => {});
        await closeDialogs();
        for (const app of popups()) if (/Redirect|Deflect Attacks/.test(textOf(app.element))) { try { await app.close(); } catch { /* gone */ } }
        await dropReactionChips(halfling);
        if (focus) await unlend(halfling, focus);
        if (monk) await unlend(halfling, monk);
        await unlend(halfling, deflect);
        await healFull();
      }
    }

    // ---- 17. Frenzy: raging AND Reckless, once per turn
    if (want(17)) {
      await closeDialogs(); await a1Victim();
      if (!pcWeapon) log.push('§17 skipped: BF Test PC Attacker has no weapon');
      else {
        const frenzy = await lend(pcAttacker, 'Frenzy');
        const made = [];
        let combat17 = null;
        try {
          let { act: fAct, raw, formula } = a1Formula(frenzy, 'Damage', pcAttacker);
          if (fAct && raw && (foundry.utils.getProperty(pcAttacker.getRollData(), 'scale.barbarian.rage-damage') == null)) {
            // The pack's part is (@scale.barbarian.rage-damage)d6; BF Test PC Attacker is no Barbarian, so the lent
            // COPY's @-terms are pinned to 2 (a level-3 barbarian's) — the machine's read is unchanged.
            const parts = fAct.toObject().damage.parts;
            parts[0].custom = { enabled: true, formula: raw.replace(/@[\w.-]+/g, '2') };
            await frenzy.update({ [`system.activities.${fAct.id}.damage.parts`]: parts });
            ({ formula } = a1Formula(pcAttacker.items.get(frenzy.id), 'Damage', pcAttacker));
            log.push(`§17: Frenzy's part "${raw}" reads nothing on BF Test PC Attacker — the lent copy reads "${formula}"`);
          }
          const wType = [...(pcWeapon.system?.damage?.base?.types ?? [])][0] ?? null;
          // The raging and reckless facts clock-riders.js reads: an active effect NAMED "Rage" and one named "Reckless".
          made.push(...(await pcAttacker.createEmbeddedDocuments('ActiveEffect', [
            { name: 'Rage', img: 'icons/svg/aura.svg', transfer: false, disabled: false, changes: [] },
            { name: 'Reckless', img: 'icons/svg/aura.svg', transfer: false, disabled: false, changes: [] }])).map(e => e.id));
          // A combat on the PC Attacker's turn (oncePerTurn is judged by the turn chit, written only in a combat).
          [combat17] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          created.combats.push(combat17.id);
          await combat17.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
            { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
          await combat17.startCombat();
          await sleep(400);
          const act = attackOf(pcAttacker, pcWeapon);
          const { msg, offer } = await a1Hit(pcAttacker, pcToken, act);
          const box = riderBox(offer, 'frenzy');
          const row = riderRow(offer, 'frenzy');
          ok(`17a. raging and Reckless, the first hit of the turn: the offer's TICKED row "Frenzy — ${formula} ${wType ?? ''}" (N the Rage Damage)`,
            !!formula && /d6/.test(formula) && !!box && box.checked && new RegExp(`Frenzy — ${reEsc(formula)}`).test(row) && (!wType || row.includes(wType)),
            `raw=${raw} formula=${formula} type=${wType} offer=${!!offer} checked=${box?.checked} row="${row}" turn=${combat17.combatant?.actor?.name}`);
          const dmg = await a1Roll(msg, offer);
          const r = ridersOf(dmg).find(x => x.key === 'frenzy');
          const chit = await waitFor(() => pcAttacker.effects.find(e => (e.getFlag(MOD, 'mastery') === 'rider') && (e.getFlag(MOD, 'riderKey') === 'frenzy')), 6000);
          ok('17b. it rides as its own part of the weapon\'s type ("raging and reckless — once this turn") and writes the once-per-turn chit',
            !!r && (r.formula === formula) && (!wType || (r.type === wType)) && /raging and reckless — once this turn/.test(r.why ?? '') && !!chit,
            `rider=${JSON.stringify(r)} chit=${chit?.name ?? null}`);
          const { msg: m2, offer: o2 } = await a1Hit(pcAttacker, pcToken, act);
          const d2 = o2 ? await a1Roll(m2, o2) : await a1Damage(m2);
          ok('17c. the second hit that turn shows none: no Frenzy row, nothing rides (the chit stands)',
            !!d2 && !riderBox(o2, 'frenzy') && !ridersOf(d2).some(x => x.key === 'frenzy'),
            `offer=${!!o2} riders=${JSON.stringify(ridersOf(d2).map(x => x.key))} formulas=[${(d2?.rolls ?? []).map(x => x.formula).join(' | ')}]`);
          await combat17.delete(); combat17 = null;
          await dropEffects(pcAttacker, pcAttacker.effects.filter(e => e.name === 'Reckless').map(e => e.id));
          const { msg: m3, offer: o3 } = await a1Hit(pcAttacker, pcToken, act);
          const d3 = o3 ? await a1Roll(m3, o3) : await a1Damage(m3);
          ok('17d. raging without Reckless (out of combat): no Frenzy', !!d3 && !riderBox(o3, 'frenzy') && !ridersOf(d3).some(x => x.key === 'frenzy'),
            `offer=${!!o3} riders=${JSON.stringify(ridersOf(d3).map(x => x.key))}`);
        } finally {
          await closeOffers();
          try { if (combat17 && game.combats.get(combat17.id)) await combat17.delete(); } catch { /* gone */ }
          await dropEffects(pcAttacker, [...made, ...riderChits(pcAttacker)]);
          await unlend(pcAttacker, frenzy);
        }
      }
    }

    // ---- 18. Hunter's Prey: the option asked once and kept; Colossus Slayer; Change; Horde Breaker's reminder
    if (want(18)) {
      await closeDialogs(); await a1Victim();
      if (!pcWeapon) log.push('§18 skipped: BF Test PC Attacker has no weapon');
      else {
        const prey = await lend(pcAttacker, "Hunter's Prey");
        const KEY = 'hunters-prey-colossus-slayer';
        const optOf = () => pcAttacker.items.get(prey.id)?.getFlag(MOD, 'option') ?? null;
        const askOf = offer => offer?.element?.querySelector(`[data-bf-option-ask="${prey.id}"]`) ?? null;
        try {
          const { formula: cs } = a1Formula(prey, 'Damage', pcAttacker);
          const wType = [...(pcWeapon.system?.damage?.base?.types ?? [])][0] ?? null;
          const act = attackOf(pcAttacker, pcWeapon);
          // a/b — the first hit, on a DAMAGED target (300 / 400), out of combat
          const { msg, offer } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 300 });
          const ask = askOf(offer);
          const radios = [...(ask?.querySelectorAll(`input[name="bf-option-${prey.id}"]`) ?? [])];
          ok('18a. the first hit asks "Hunter\'s Prey — which option did you take?": Colossus Slayer ("… rides this hit") and Horde Breaker, none picked, no rider row yet',
            !!ask && /Hunter's Prey — which option did you take\?/.test(textOf(ask)) && radios.some(r => r.value === 'Colossus Slayer')
              && radios.some(r => r.value === 'Horde Breaker') && radios.every(r => !r.checked) && /rides this hit/.test(textOf(ask)) && !riderBox(offer, KEY),
            `offer=${!!offer} radios=${radios.map(r => r.value)} ask="${textOf(ask).slice(0, 260)}"`);
          ask?.querySelector('input[value="Colossus Slayer"]')?.click();
          await sleep(50);
          const d1 = await a1Roll(msg, offer);
          const r1 = ridersOf(d1).find(x => x.key === KEY);
          ok(`18b. picked Colossus Slayer: kept on the feature (option flag); on the damaged target its ${cs} of the weapon's type rides`,
            (optOf() === 'Colossus Slayer') && !!r1 && /d8/.test(r1.formula ?? '') && (r1.formula === cs) && (!wType || (r1.type === wType))
              && (r1.option === 'Colossus Slayer') && /the target is damaged/.test(r1.why ?? '') && (msg?.getFlag(MOD, 'clockPick') ?? []).includes(KEY),
            `option=${optOf()} cs=${cs} rider=${JSON.stringify(r1)} pick=${JSON.stringify(msg?.getFlag(MOD, 'clockPick'))}`);
          // c — an UNDAMAGED target: kept, so nothing asks; not due, so nothing rides
          const { msg: m2, offer: o2 } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 400 });
          const d2 = o2 ? await a1Roll(m2, o2) : await a1Damage(m2);
          ok('18c. an undamaged target (400 / 400): no ask, no Colossus Slayer row, nothing rides',
            !!d2 && !askOf(o2) && !riderBox(o2, KEY) && !ridersOf(d2).some(x => x.key === KEY),
            `offer=${!!o2} riders=${JSON.stringify(ridersOf(d2).map(x => x.key))}`);
          // d — damaged again: the kept option's TICKED row, no ask
          const { msg: m3, offer: o3 } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 300 });
          const box3 = riderBox(o3, KEY);
          ok('18d. kept: the next damaged hit asks nothing — the ticked row "Colossus Slayer — 1d8 …"',
            !!box3 && box3.checked && !askOf(o3) && /Colossus Slayer — .*d8/.test(riderRow(o3, KEY)),
            `offer=${!!o3} checked=${box3?.checked} ask=${!!askOf(o3)} row="${riderRow(o3, KEY)}"`);
          const d3 = await a1Roll(m3, o3);
          // e/f — the card's Change
          const change = await waitFor(() => [...(cardEl(d3?.id)?.querySelectorAll('button') ?? [])].find(b => /Change Hunter's Prey option/.test(b.textContent ?? '')), 6000);
          ok('18e. the damage card: "Colossus Slayer — … rode this roll" with "Change Hunter\'s Prey option"',
            !!change && /Colossus Slayer — .*rode this roll/.test(cardText(d3?.id)), cardText(d3?.id).slice(0, 260));
          change?.click();
          const cleared = await waitFor(() => optOf() === null, 6000);
          ok('18f. Change forgets the option', cleared === true, `option=${JSON.stringify(optOf())}`);
          // g — asked again; Horde Breaker; BF Test Cleric stands 5 ft from the Victim (1600 vs 1500, y 1900)
          const tH = Date.now();
          const { msg: m4, offer: o4 } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 300 });
          const ask4 = askOf(o4);
          ask4?.querySelector('input[value="Horde Breaker"]')?.click();
          await sleep(50);
          const d4 = await a1Roll(m4, o4);
          const hb = await waitFor(() => hewNotices(tH, 'Horde Breaker')[0] ?? null, 8000);
          const n = hb?.getFlag(MOD, 'hewNotice');
          const clericName = clericToken.document?.name ?? cleric.name;
          ok(`18g. the next hit asks again; Horde Breaker is kept (nothing rides) and, ${clericName} within 5 ft of the target, Hew's reminder "Horde Breaker — BF Test PC Attacker can attack again … within 5 ft of …"`,
            !!ask4 && (optOf() === 'Horde Breaker') && !!d4 && !ridersOf(d4).some(x => x.key === KEY) && !!hb
              && /Horde Breaker — BF Test PC Attacker can attack again/.test(hb.content ?? '') && /within 5 ft of/.test(n?.why ?? '')
              && (n?.why ?? '').includes(clericName) && !n?.offer,
            `ask=${!!ask4} option=${optOf()} riders=${JSON.stringify(ridersOf(d4).map(x => x.key))} notice=${JSON.stringify(n ? { label: n.label, why: n.why, offer: !!n.offer } : null)}`);
          await ackHew('Horde Breaker');
        } finally {
          await closeOffers();
          await ackHew('Horde Breaker');
          await unlend(pcAttacker, prey);
        }
      }
    }

    // ---- 19. War Priest: Hew's reminder with the uses; none left, none
    if (want(19)) {
      await closeDialogs(); await a1Victim();
      if (!clericWeapon) log.push('§19 skipped: BF Test Cleric has no weapon');
      else {
        const wp = await lend(cleric, 'War Priest');
        const uses = () => cleric.items.get(wp.id)?.system?.uses;
        try {
          await wp.update({ 'system.uses.spent': 0 });
          if (!(Number(uses()?.max) > 0)) {
            // UNSURE: the pack's max (likely the Wisdom modifier) read 0 on the fixture — pinned so the uses show
            await wp.update({ 'system.uses.max': '3', 'system.uses.spent': 0 });
            log.push(`§19: War Priest's max read 0 on BF Test Cleric — the lent copy set to 3`);
          }
          const act = attackOf(cleric, clericWeapon);
          const t1 = Date.now();
          const { msg, offer } = await a1Hit(cleric, clericToken, act);
          if (offer) await a1Roll(msg, offer); else await a1Damage(msg);
          const card = await waitFor(() => hewNotices(t1, 'War Priest')[0] ?? null, 8000);
          const n = card?.getFlag(MOD, 'hewNotice');
          const left = `${uses()?.value} of ${uses()?.max} use`;
          ok(`19a. a weapon attack: Hew's reminder "War Priest — BF Test Cleric can attack again", "… ${left}s left", a reminder (no drive)`,
            !!card && /War Priest — BF Test Cleric can attack again/.test(card.content ?? '') && (n?.why ?? '').includes(left) && !n?.offer,
            `card=${!!card} notice=${JSON.stringify(n ? { label: n.label, why: n.why, offer: !!n.offer } : null)} uses=${JSON.stringify({ value: uses()?.value, max: uses()?.max })}`);
          if (Number(game.settings.get(MOD, 'decisionTimer')) > 0) {
            const pop = await waitFor(() => hewPopup('War Priest'), 6000);
            ok('19b. it pops: "War Priest — BF Test Cleric", OK only', !!pop && !pop.element.querySelector('button[data-action="use"]'), `popup=${!!pop} text="${textOf(pop?.element).slice(0, 160)}"`);
            await ackHew('War Priest');
          } else log.push('§19b skipped: decisionTimer is 0 — Hew\'s popup never opens');
          await wp.update({ 'system.uses.spent': Number(uses()?.max) || 0 });
          const t2 = Date.now();
          const { msg: m2, offer: o2 } = await a1Hit(cleric, clericToken, act);
          if (o2) await a1Roll(m2, o2); else await a1Damage(m2);
          await sleep(2000);   // load-bearing: time for a WRONG reminder
          ok('19c. no uses left: no reminder', !hewNotices(t2, 'War Priest').length && (Number(uses()?.value) === 0),
            `notices=${hewNotices(t2, 'War Priest').length} uses=${JSON.stringify({ value: uses()?.value, max: uses()?.max })}`);
        } finally {
          await closeOffers();
          await ackHew('War Priest');
          await unlend(cleric, wp);
        }
      }
    }

    // ---- 20. Repelling Blast: a card line per Eldritch Blast beam; a Huge target none; the enchantment's cantrip
    if (want(20)) {
      await closeDialogs(); await a1Victim();
      const ebSrc = await findPHB('Eldritch Blast', 'spell');
      const sorcToken = canvas.tokens.get(sorcererDoc.id);
      if (!ebSrc || !sorcToken) log.push(`§20 skipped: Eldritch Blast=${!!ebSrc} sorcererToken=${!!sorcToken}`);
      else {
        const rb = await lend(sorcerer, 'Repelling Blast');
        const own = [];
        const vDoc = victimToken.document;
        const vSize = { width: vDoc.width, height: vDoc.height };
        const priorSize = victim.system._source.traits?.size ?? 'med';
        const SAYS = /Repelling Blast — push it up to 10 feet straight away from you \(move the token\)/;
        // ⚠ No receipt to wait for: Eldritch Blast's volley applies after the last beam — the damage message is the record.
        const ebDamage = msg => waitFor(() => damageFor(msg?.id) ?? null, 12000);
        const ebRoll = async (msg, offer) => { offer?.element?.querySelector('button[data-action="roll"]')?.click(); return ebDamage(msg); };
        const castable = async src => {
          const data = src.toObject(); data.system.prepared = 1; data.system.method = 'atwill';
          const [it] = await sorcerer.createEmbeddedDocuments('Item', [data]); own.push(it); return it;
        };
        try {
          const eb = await castable(ebSrc);
          const ebAct = eb.system.activities.find(a => a.type === 'attack');
          // a/b — two beams (the volley's rays are separate attack rolls; rolled here without the aim)
          const beams = [];
          for (let i = 0; i < 2; i++) {
            const { msg, offer } = await a1Hit(sorcerer, sorcToken, ebAct);
            const box = riderBox(offer, 'repelling-blast');
            const row = riderRow(offer, 'repelling-blast');
            const dmg = offer ? await ebRoll(msg, offer) : await ebDamage(msg);
            const any = damageFor(msg?.id);
            beams.push({ offer: !!offer, checked: !!box?.checked, row, rider: ridersOf(dmg).find(x => x.key === 'repelling-blast') ?? null, id: dmg?.id ?? null,
              attack: msg?.id ?? null, damage: any?.id ?? null, receipt: !!any?.getFlag(MOD, 'receipt'), flags: Object.keys(any?.flags?.[MOD] ?? {}), pick: msg?.getFlag(MOD, 'clockPick') ?? null });
          }
          await sleep(600);
          ok('20a. each Eldritch Blast beam that hits (no enchantment on the sheet: the row\'s spell): the offer\'s TICKED no-dice row "Repelling Blast — push it up to 10 feet …"',
            beams.every(b => b.offer && b.checked && /Repelling Blast — push it up to 10 feet/.test(b.row)),
            JSON.stringify(beams.map(b => ({ offer: b.offer, checked: b.checked, row: b.row.slice(0, 90) }))));
          ok('20b. a card line per beam: "Repelling Blast — push it up to 10 feet straight away from you (move the token)"; no dice added',
            beams.every(b => b.rider && !b.rider.formula && SAYS.test(b.rider.says ? `Repelling Blast — ${b.rider.says}` : '') && SAYS.test(cardText(b.id))),
            JSON.stringify(beams.map(b => ({ rider: b.rider, attack: b.attack, damage: b.damage, receipt: b.receipt, flags: b.flags, pick: b.pick, card: cardText(b.id ?? b.damage).slice(0, 160) }))));
          // c — a Huge target: none (maxSize lg)
          await victim.update({ 'system.traits.size': 'huge' });
          await sleep(300);
          const { msg: mH, offer: oH } = await a1Hit(sorcerer, sorcToken, ebAct);
          const dH = oH ? await ebRoll(mH, oH) : await ebDamage(mH);
          ok('20c. a Huge target: no Repelling Blast row, no line', !!dH && !riderBox(oH, 'repelling-blast') && !ridersOf(dH).some(x => x.key === 'repelling-blast'),
            `size=${victim.system.traits.size} offer=${!!oH} riders=${JSON.stringify(ridersOf(dH).map(x => x.key))}`);
          await victim.update({ 'system.traits.size': priorSize });
          if ((vDoc.width !== vSize.width) || (vDoc.height !== vSize.height)) await vDoc.update(vSize);   // UNSURE: dnd5e may resize the token with the size
          // d — enchanted onto ANOTHER cantrip (Fire Bolt): Eldritch Blast says nothing, the enchanted cantrip does
          const fbSrc = await findPHB('Fire Bolt', 'spell');
          const ench = rb.effects.find(e => e.type === 'enchantment');
          if (!fbSrc) log.push('§20d skipped: no Fire Bolt in the PHB');
          else {
            const fb = await castable(fbSrc);
            // UNSURE: an enchantment created straight on the item (the "Make Repelling" use's result, without its dialog);
            // the machine reads only type "enchantment" + the feature's name (clock-riders.js enchantedBy).
            const data = ench ? foundry.utils.mergeObject(ench.toObject(), { origin: rb.uuid, disabled: false }, { inplace: false })
              : { name: rb.name, type: 'enchantment', img: rb.img, origin: rb.uuid, transfer: false, disabled: false, changes: [] };
            delete data._id;
            data.name = rb.name;
            await fb.createEmbeddedDocuments('ActiveEffect', [data]);
            const { msg: mE, offer: oE } = await a1Hit(sorcerer, sorcToken, ebAct);
            const dE = oE ? await ebRoll(mE, oE) : await ebDamage(mE);
            const fbAct = sorcerer.items.get(fb.id)?.system?.activities?.find(a => a.type === 'attack');
            const { msg: mF, offer: oF } = await a1Hit(sorcerer, sorcToken, fbAct);
            const dF = oF ? await ebRoll(mF, oF) : await ebDamage(mF);
            await sleep(600);
            ok('20d. the invocation enchanted onto Fire Bolt: an Eldritch Blast hit says nothing, a Fire Bolt hit carries the line',
              !!dE && !ridersOf(dE).some(x => x.key === 'repelling-blast') && !!dF && ridersOf(dF).some(x => x.key === 'repelling-blast') && SAYS.test(cardText(dF?.id)),
              `eb=${JSON.stringify(ridersOf(dE).map(x => x.key))} fb=${JSON.stringify(ridersOf(dF).map(x => x.key))} fbCard="${cardText(dF?.id).slice(0, 160)}" ench=${!!ench}`);
          }
        } finally {
          await closeOffers();
          if (victim.system._source.traits?.size !== priorSize) await victim.update({ 'system.traits.size': priorSize });
          if ((vDoc.width !== vSize.width) || (vDoc.height !== vSize.height)) await vDoc.update(vSize).catch(() => {});
          for (const it of own) await unlend(sorcerer, it).catch(() => sorcerer.items.get(it.id)?.delete());
          await unlend(sorcerer, rb);
        }
      }
    }

    // ---- 21. Dark One's Blessing: the warlock's kill, an ally's kill within 10 ft, a kill beyond it
    if (want(21)) {
      await closeDialogs(); await spendLuck();
      const src = cleric.system._source;
      hgKeep(cleric, { 'system.attributes.hp.temp': src.attributes.hp.temp ?? 0, 'system.details.originalClass': src.details?.originalClass ?? '' });
      hgKeep(victim, { 'system.attributes.hp.value': victim.system._source.attributes.hp.value, 'system.attributes.hp.max': victim.system._source.attributes.hp.max });
      const blessing = await hgLend(cleric, "Dark One's Blessing", 'feat');
      // The pack's heal reads @classes.warlock.levels: without a warlock class it resolves to nothing and pays nothing.
      // UNSURE: a class item created straight on the sheet (no advancement manager) — dnd5e may set originalClass (kept above).
      const warlock = await hgLend(cleric, 'Warlock', 'class', { 'system.levels': 3 });
      const rd = cleric.getRollData();
      const N = Math.max(1, Number(rd?.classes?.warlock?.levels) + Number(rd?.abilities?.cha?.mod ?? 0));
      if (!blessing || !warlock || !Number.isFinite(N) || !pcWeapon || !clericWeapon) {
        log.push(`§21 skipped: blessing=${!!blessing} warlock=${!!warlock} N=${N} pcWeapon=${!!pcWeapon} clericWeapon=${!!clericWeapon}`);
      } else {
        const vfx0 = new Set(victim.effects.map(e => e.id));
        const temp = () => Number(cleric.system.attributes.hp.temp ?? 0);
        const blessCard = since => game.messages.contents.find(m => (m.timestamp >= since) && m.getFlag(MOD, 'healOnHit')?.kill
          && (m.getFlag(MOD, 'healOnHit')?.casterUuid === cleric.uuid)) ?? null;
        const said = m => cardText(m?.id) || String(m?.content ?? '').replace(/<[^>]+>/g, ' ').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, ' ');
        const title = new RegExp(`Dark One's Blessing — ${cleric.name} gains ${N} Temporary Hit Points`);
        const reset = async () => {
          await cleric.update({ 'system.attributes.hp.temp': 0 });
          await victim.update({ 'system.attributes.hp.value': 1 });
          await sleep(200);
        };

        // (a) the warlock's own kill
        await reset();
        const sA = Date.now();
        await hgStrike(cleric, clericToken, clericWeapon, victimToken);
        const fellA = await waitFor(() => vhp() <= 0, 8000);
        const cA = await waitFor(() => blessCard(sA), 8000);
        const recA = await waitFor(() => (cA?.getFlag(MOD, 'receipt')?.targets?.length ? cA.getFlag(MOD, 'receipt') : null), 6000);
        await waitFor(() => temp() === N, 4000);
        await sleep(400);
        const fA = cA?.getFlag(MOD, 'healOnHit');
        ok(`21a. the Cleric drops the Victim: "Dark One's Blessing — BF Test Cleric gains ${N} Temporary Hit Points" ("you dropped an enemy"), receipted, ${N} temp HP`,
          fellA && !!cA && title.test(said(cA)) && (fA?.amount === N) && /you dropped an enemy/.test(fA?.why ?? '') && (fA?.targetUuid === victim.uuid)
            && (recA?.targets ?? []).some(t => t.uuid === cleric.uuid) && (temp() === N),
          `N=${N} (warlock ${rd?.classes?.warlock?.levels} + cha ${rd?.abilities?.cha?.mod}) fell=${fellA} vhp=${vhp()} card=${!!cA} text=${said(cA).slice(0, 160)} flag=${JSON.stringify(fA)} receipt=${JSON.stringify(recA?.targets?.map(t => t.name) ?? null)} temp=${temp()}`);

        // (b) an ally's kill 5 ft from the warlock
        await reset();
        const sB = Date.now();
        await hgStrike(pcAttacker, pcToken, pcWeapon, victimToken);
        const fellB = await waitFor(() => vhp() <= 0, 8000);
        const cB = await waitFor(() => blessCard(sB), 8000);
        await waitFor(() => temp() === N, 4000);
        await sleep(400);
        const fB = cB?.getFlag(MOD, 'healOnHit');
        ok(`21b. the PC Attacker drops the Victim 5 ft from the Cleric: the Cleric gains ${N} temp HP ("… ft from you")`,
          fellB && !!cB && title.test(said(cB)) && /ft from you/.test(fB?.why ?? '') && (temp() === N),
          `fell=${fellB} card=${!!cB} why=${fB?.why} text=${said(cB).slice(0, 160)} temp=${temp()}`);

        // (c) an ally's kill 55 ft away: an unlinked Victim token in this block
        await cleric.update({ 'system.attributes.hp.temp': 0 });
        const [farDoc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(victim.prototypeToken.toObject(),
          { x: 800, y: 800, actorId: victim.id, actorLink: false, disposition: -1 }, { inplace: false })]);
        created.tokens.push(farDoc.id);
        const farTok = await waitFor(() => canvas.tokens.get(farDoc.id), 10000);
        const farActor = () => scene.tokens.get(farDoc.id)?.actor ?? null;
        await farActor()?.update({ 'system.attributes.hp.value': 1 });
        await sleep(200);
        const sC = Date.now();
        if (farTok) await hgStrike(pcAttacker, pcToken, pcWeapon, farTok);
        const fellC = await waitFor(() => Number(farActor()?.system?.attributes?.hp?.value ?? 1) <= 0, 8000);
        await sleep(2500);
        const cC = blessCard(sC);
        ok('21c. the PC Attacker drops a Victim 55 ft from the Cleric: no card, no temp HP',
          !!farTok && fellC && !cC && (temp() === 0),
          `tok=${!!farTok} fell=${fellC} hp=${farActor()?.system?.attributes?.hp?.value} card=${cC ? said(cC).slice(0, 120) : null} temp=${temp()}`);

        // restore: the far token, the Victim's HP and any status the drop left, the temp HP
        if (scene.tokens.get(farDoc.id)) await scene.deleteEmbeddedDocuments('Token', [farDoc.id]);
        const drops = victim.effects.filter(e => !vfx0.has(e.id) && [...(e.statuses ?? [])].some(s => ['dead', 'unconscious', 'prone'].includes(s))).map(e => e.id);
        if (drops.length) await victim.deleteEmbeddedDocuments('ActiveEffect', drops).catch(() => {});
        await victim.update({ 'system.attributes.hp.value': Number(victim.system.attributes.hp.max) });
        await cleric.update({ 'system.attributes.hp.temp': 0 });
      }
      if (warlock) await unlend(cleric, warlock);
      if (blessing) await unlend(cleric, blessing);
      CONFIG.Dice.randomUniform = realPRNG;
    }

    // ---- 22. Starry Form: the constellation asked; the Chalice's second heal
    if (want(22)) {
      await closeDialogs();
      await set('castApply', true);   // retired (the stamp is unconditional) — harmless, as smoke-shields §8
      const ws = await hgLend(cleric, 'Wild Shape', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const sf = await hgLend(cleric, 'Starry Form', 'feat');
      let cure = cleric.items.find(i => (i.type === 'spell') && (i.name === 'Cure Wounds')) ?? null;
      const cureLent = !cure;
      if (!cure) cure = await hgLend(cleric, 'Cure Wounds', 'spell', { 'system.prepared': 1 });
      const sfItem = () => cleric.items.get(sf?.id);
      const consumeAct = () => sfItem()?.system.activities.find(a => a.name === 'Consume Wild Shape');
      const chaliceAct = () => sfItem()?.system.activities.find(a => a.name === 'Chalice');
      // UNSURE: a fixture with no Circle of the Stars scale — the Chalice's die stands in as 1d6 on the lent copy.
      if (chaliceAct() && (foundry.utils.getProperty(cleric.getRollData(), 'scale.stars.die') === undefined)) {
        await sfItem().update({ [`system.activities.${chaliceAct()._id ?? chaliceAct().id}.healing.custom.formula`]: '1d6 + @abilities.wis.mod' });
      }
      if (!ws || !sf || !cure || !consumeAct() || !chaliceAct()) {
        log.push(`§22 skipped: wildShape=${!!ws} starryForm=${!!sf} cure=${!!cure} consume=${!!consumeAct()} chalice=${!!chaliceAct()}`);
      } else {
        const clearForm = async () => {
          const ids = cleric.effects.filter(e => /^(Starry Form|Dragon Form)/.test(e.name) || e.getFlag(MOD, 'formChip')).map(e => e.id);
          if (ids.length) await cleric.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
        };
        const chip = () => cleric.effects.find(e => e.getFlag(MOD, 'formChip')?.choice === 'Starry Form') ?? null;
        const forms = () => cleric.effects.filter(e => e.active && /^(Starry Form|Dragon Form)/.test(e.name)).map(e => e.name);
        const wsSpent = () => Number(cleric.items.get(ws.id)?.system?.uses?.spent ?? 0);
        const shape = async pick => {
          await clearForm(); await hgClose(/^Starry Form —/);
          clericToken.control({ releaseOthers: true });
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          await sleep(100);
          let res = await consumeAct().use({ subsequentActions: false }, { configure: false }, {});
          // UNSURE: the Wild Shape consumption resolves by the lent copy's compendiumSource; if dnd5e refuses it, the
          // use is retried without consuming (the constellation is the row under test, not the Wild Shape spend).
          let consumed = true;
          if (!res?.message) { consumed = false; res = await consumeAct().use({ consume: false, subsequentActions: false }, { configure: false }, {}); }
          const card = res?.message ?? null;
          await waitFor(() => card?.getFlag(MOD, 'castApply')?.choice, 4000);
          const choice = foundry.utils.deepClone(card?.getFlag(MOD, 'castApply')?.choice ?? null);
          const btn = await waitFor(() => hgPickButton(pick), 5000);
          const buttons = ['Archer', 'Chalice', 'Dragon'].filter(n => !!hgPickButton(n));
          const text = cardText(card?.id);
          btn?.click();
          await waitFor(() => forms().includes('Starry Form') && chip(), 8000);
          await sleep(600);
          return { card, choice, buttons, text, consumed, chosen: card?.getFlag(MOD, 'castApply')?.choice?.chosen ?? null, forms: forms(), chip: chip() };
        };

        const d = await shape('Dragon');
        ok('22a. "Consume Wild Shape" asks: the card pending "Which constellation glimmers on you?", the popup a button each — Archer, Chalice, Dragon',
          (d.choice?.key === 'Starry Form') && !d.choice?.chosen && (JSON.stringify(d.choice?.options) === JSON.stringify(['Archer', 'Chalice', 'Dragon']))
            && /Which constellation glimmers on you\?/.test(d.text) && (d.buttons.length === 3),
          `choice=${JSON.stringify(d.choice)} buttons=${JSON.stringify(d.buttons)} consumed=${d.consumed} wsSpent=${wsSpent()} card=${d.text.slice(0, 200)}`);
        ok('22b. Dragon: Starry Form AND Dragon Form land; the chip reads dragon',
          (d.chosen === 'Dragon') && d.forms.includes('Starry Form') && d.forms.some(n => /^Dragon Form/.test(n)) && (d.chip?.getFlag(MOD, 'formChip')?.form === 'dragon'),
          `chosen=${d.chosen} forms=${JSON.stringify(d.forms)} chip=${d.chip?.name ?? null}`);

        const a = await shape('Archer');
        ok('22c. Archer: Starry Form lands, no Dragon Form; the chip reads archer',
          (a.chosen === 'Archer') && a.forms.includes('Starry Form') && !a.forms.some(n => /^Dragon Form/.test(n)) && (a.chip?.getFlag(MOD, 'formChip')?.form === 'archer'),
          `chosen=${a.chosen} forms=${JSON.stringify(a.forms)} chip=${a.chip?.name ?? null}`);

        const c = await shape('Chalice');
        ok('22d. Chalice: Starry Form lands, no Dragon Form; the form chip "Starry Form: Chalice" stands',
          (c.chosen === 'Chalice') && c.forms.includes('Starry Form') && !c.forms.some(n => /^Dragon Form/.test(n))
            && (c.chip?.name === 'Starry Form: Chalice') && (c.chip?.getFlag(MOD, 'formChip')?.form === 'chalice'),
          `chosen=${c.chosen} forms=${JSON.stringify(c.forms)} chip=${c.chip?.name ?? null} wsSpent=${wsSpent()}`);

        // The Chalice: Cure Wounds (level 1) at the PC Attacker; the Halfling (10 ft from the Cleric) is the second heal.
        hgKeep(pcAttacker, { 'system.attributes.hp.value': pcAttacker.system._source.attributes.hp.value });
        await halfling.update({ 'system.attributes.hp.value': 300, 'system.attributes.hp.temp': 0 });
        const hName = halflingToken.document.name;
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        pcToken.setTarget(true, { releaseOthers: true });
        await sleep(100);
        faces([[4, 8]]);
        // UNSURE: rolled straight off the activity (smoke-heal's shape) — no slot is spent; the `also` row reads only the
        // spell's level (> 0), never the slot.
        const cureAct = cleric.items.get(cure.id)?.system.activities.find(x => x.type === 'heal');
        const rolls = await cureAct?.rollDamage({}, { configure: false }, {});
        const healCard = rolls?.[0]?.parent ?? null;
        const offer = await waitFor(() => [...(cardEl(healCard?.id)?.querySelectorAll('button') ?? [])].find(b => textOf(b) === hName) ?? null, 6000);
        const names = [...(cardEl(healCard?.id)?.querySelectorAll('button') ?? [])].map(b => textOf(b));
        const pop = await waitFor(() => popups().find(app => /^Chalice —/.test(app.title ?? '')) ?? null, 3000);
        ok('22e. the Cure Wounds card offers "Chalice — heal one more within 30 ft" with a button per creature (the Cleric and the Halfling among them); the popup opens',
          !!offer && /Chalice — heal one more within 30 ft/.test(cardText(healCard?.id)) && names.includes(clericToken.document.name) && !!pop,
          `card=${!!healCard} buttons=${JSON.stringify(names)} pop=${pop?.title ?? null} text=${cardText(healCard?.id).slice(-200)}`);
        faces([[6, 6]]);
        const hp0 = hp();
        offer?.click();
        const flag = await waitFor(() => game.messages.get(healCard?.id)?.getFlag(MOD, 'alsoHeal')?.picked ? game.messages.get(healCard.id).getFlag(MOD, 'alsoHeal') : null, 6000);
        // UNSURE: the Chalice heal is use() then rollDamage() on the heal activity (the handoff's unverified seam).
        const rose = await waitFor(() => hp() > hp0, 10000);
        await sleep(600);
        ok('22f. the Halfling\'s button: the Chalice heal is used on the Halfling — its HP rises; the card says "Chalice — BF Test Halfling is healed too"',
          (flag?.picked === halfling.uuid) && (flag?.also === 'Chalice') && rose && new RegExp(`Chalice — ${hName} is healed too`).test(cardText(healCard?.id)),
          `flag=${JSON.stringify(flag)} hp ${hp0}→${hp()} text=${cardText(healCard?.id).slice(-160)}`);

        await hgClose(/^(Chalice|Starry Form) —/);
        await clearForm();
        await healFull();
        await pcAttacker.update({ 'system.attributes.hp.value': priorActor[pcAttacker.id]['system.attributes.hp.value'] });
      }
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      if (cure && cureLent) await unlend(cleric, cure);
      if (sf) await unlend(cleric, sf);
      if (ws) await unlend(cleric, ws);
      CONFIG.Dice.randomUniform = realPRNG;
    }

    // ---- 23. Sacred Weapon's light goes out with the weapon's enchantment
    if (want(23)) {
      await closeDialogs();
      const sw = await hgLend(cleric, 'Sacred Weapon', 'feat');
      const act = sw ? cleric.items.get(sw.id)?.system.activities.find(a => a.type === 'enchant') : null;
      const weapon = clericWeapon ? cleric.items.get(clericWeapon.id) : null;
      const cdoc = clericToken.document;
      const lightNow = () => ({ bright: scene.tokens.get(cdoc.id)?.light?.bright ?? null, dim: scene.tokens.get(cdoc.id)?.light?.dim ?? null });
      const lightFx = () => cleric.effects.find(e => e.getFlag(MOD, 'tokenLight')?.key === 'Sacred Weapon') ?? null;
      const enchantOn = () => cleric.items.get(weapon?.id)?.effects?.find(e => (e.type === 'enchantment') && (e.name === 'Sacred Weapon')) ?? null;
      if (!act || !weapon) log.push(`§23 skipped: activity=${!!act} weapon=${!!weapon}`);
      else {
        const before = lightNow();
        clericToken.control({ releaseOthers: true });
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        await sleep(100);
        // The Paladin's Channel Divinity is not on this sheet: the use spends nothing (the light is the row under test).
        const res = await act.use({ consume: { resources: false, spellSlot: false, action: false }, subsequentActions: false }, { configure: false }, {});
        const card = res?.message ?? null;
        const fx = await waitFor(lightFx, 8000);
        const lit = await waitFor(() => (lightNow().bright === 20) ? lightNow() : null, 5000);
        const keys = (fx?.system?.changes ?? []).map(ch => `${ch.key}=${ch.value}`);
        ok('23a. the use lights the Cleric\'s token: 20 ft Bright, 40 ft Dim (the light effect, the enchantment\'s 10-minute clock)',
          !!fx && keys.includes('token.light.bright=20') && keys.includes('token.light.dim=40') && !!lit && (lit.dim === 40),
          `effect=${fx?.name ?? null} changes=[${keys.join(', ')}] light=${JSON.stringify(lightNow())} before=${JSON.stringify(before)} duration=${JSON.stringify(fx?._source?.duration ?? null)}`);
        await sleep(500);
        ok('23b. the card says "Sacred Weapon — … sheds light: 20 ft Bright, 20 ft more Dim · while the weapon\'s enchantment stands"',
          /Sacred Weapon — .+ sheds light: 20 ft Bright, 20 ft more Dim/.test(cardText(card?.id)) && /while the weapon's enchantment stands/.test(cardText(card?.id)),
          `flag=${JSON.stringify(card?.getFlag(MOD, 'tokenLight')?.landed?.map(l => l.name) ?? null)} text=${cardText(card?.id).slice(-240)}`);
        // dnd5e enchants on a weapon DROPPED on the card: the suite applies the use's profile to the Cleric's weapon.
        // UNSURE: `act.effects[0]._id` is the profile id applyEnchantment wants (dnd5e.mjs:36541 finds p._id).
        const profileId = act.effects?.[0]?._id ?? null;
        try { await act.applyEnchantment(profileId, weapon, { chatMessage: card, strict: false }); }
        catch (err) { log.push(`§23 applyEnchantment threw: ${err?.message}`); }
        const ench = await waitFor(enchantOn, 5000);
        ok('23c. the weapon carries the Sacred Weapon enchantment; the light still stands', !!ench && !!lightFx() && (lightNow().bright === 20),
          `enchant=${ench?.name ?? null} weapon=${cleric.items.get(weapon.id)?.name} light=${JSON.stringify(lightNow())}`);
        if (ench) await ench.delete();
        const out = await waitFor(() => !lightFx() && (lightNow().bright === before.bright) && (lightNow().dim === before.dim), 8000);
        ok('23d. the enchantment deleted: the light effect goes and the token is back to its prior light',
          out, `effect=${lightFx()?.name ?? null} light=${JSON.stringify(lightNow())} before=${JSON.stringify(before)}`);
      }
      // restore: any enchantment or light left behind, the lend
      const leftEnch = enchantOn();
      if (leftEnch) await leftEnch.delete().catch(() => {});
      const leftLight = cleric.effects.filter(e => e.getFlag(MOD, 'tokenLight')?.key === 'Sacred Weapon').map(e => e.id);
      if (leftLight.length) await cleric.deleteEmbeddedDocuments('ActiveEffect', leftLight).catch(() => {});
      if (sw) await unlend(cleric, sw);
    }

    // ---- 24. the Rage's turn-end reminder (TURN_GRANTS remind: "extend")
    if (want(24)) {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);   // a killed run's leftovers: the fixture carries no Rage of its own
      const rage = await lend(pcAttacker, 'Rage');
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      try {
        await combat.createEmbeddedDocuments('Combatant', [
          { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
          { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
        await combat.startCombat();
        await sleep(400);
        const reminders = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart)
          && (m.getFlag(MOD, 'turnGrant')?.remind === 'extend') && (m.getFlag(MOD, 'turnGrant')?.actorUuid === pcAttacker.uuid)
          && String(m.getFlag(MOD, 'turnGrant')?.place ?? '').startsWith(`${combat.id}|`));
        const reminderFor = round => reminders().find(m => String(m.getFlag(MOD, 'turnGrant').place).startsWith(`${combat.id}|${round}|`)) ?? null;
        const toTurnOf = async actor => {   // advance until `actor`'s turn is the current one
          for (let i = 0; (i < 4) && (combat.combatant?.actorId !== actor.id); i++) { await combat.nextTurn(); await sleep(300); }
        };
        await toTurnOf(pcAttacker);
        const r1 = combat.round;
        // Round r1, the barbarian's turn: it enters Rage (the pack's own activity; cast.js lands the effect).
        const card = await useFeature(pcToken, rage);
        const rageFx = await waitFor(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, 6000);
        // UNSURE: the Rage's activity is a self-aimed utility carrying the "Rage" effect (castApply stamps it) — if it
        // never lands, the whole section is diagnosed here, not guessed around.
        ok('24a. the Rage entered on the barbarian\'s turn lands "Rage" on it (the usage card stamped castApply)',
          !!rageFx && !!card?.getFlag(MOD, 'castApply'),
          `fx=${rageFx?.name ?? null} start=${JSON.stringify(rageFx?.start ?? null)} stamp=${!!card?.getFlag(MOD, 'castApply')} activity=${actNamed(rage)?.type}/${actNamed(rage)?.target?.affects?.type}`);
        await combat.nextTurn();                       // the entering turn ends
        await sleep(2000);
        // UNSURE: the handoff's guess — the "Rage" effect's `start` stamp names the turn it was entered
        // (chitStampOf → `combat:round:turn`); a red here with a card posted means the stamp is not that.
        ok('24b. the turn the Rage was entered is never reminded', !reminderFor(r1),
          `card=${cardText(reminderFor(r1)?.id).slice(0, 160)} start=${JSON.stringify(rageFx?.start ?? null)}`);
        await toTurnOf(pcAttacker);
        const r2 = combat.round;
        await sleep(300);
        await combat.nextTurn();                       // a turn with no attack roll and no save forced ends
        const quiet = await waitFor(() => reminderFor(r2), 6000);
        await waitFor(() => cardEl(quiet?.id), 3000);
        ok('24c. a turn with no attack roll and no save forced: the card "Rage — it ends now unless you extended it", nothing is removed',
          !!quiet && /Rage — it ends now unless you extended it/.test(cardText(quiet?.id)) && /nothing is removed/.test(cardText(quiet?.id))
            && (quiet?.getFlag(MOD, 'turnGrant')?.key === 'Rage') && !!fxNamed(pcAttacker, ['Rage'])[0],
          `card=${cardText(quiet?.id).slice(0, 220)} flag=${JSON.stringify(quiet?.getFlag(MOD, 'turnGrant') ?? null)} rage=${!!fxNamed(pcAttacker, ['Rage'])[0]}`);
        if (!pcWeapon) log.push('§24c skipped the attack turn: BF Test PC Attacker has no weapon');
        else {
          await toTurnOf(pcAttacker);
          const r3 = combat.round;
          victimPrior();
          await victim.update({ 'system.attributes.hp.max': 400 });
          const atk = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [15] });   // an attack roll at the hostile Victim
          await sleep(800);
          await combat.nextTurn();
          await sleep(2500);
          ok('24d. a turn WITH an attack roll at an enemy ends with no card', !!atk && !reminderFor(r3),
            `attack=${atk?.id ?? null} card=${cardText(reminderFor(r3)?.id).slice(0, 160)}`);
        }
      } finally {
        await closeA1();
        if (game.combats.get(combat.id)) await combat.delete();
        await dropFx(pcAttacker, RAGE_FX);
        await unlend(pcAttacker, rage);
        clearTargets();
      }
    }

    // ---- 25. Rage of the Wilds: the pick at the Rage, the Wolf's ring, the gate
    if (want(25)) {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);
      // UNSURE: a ring stands only on a LIVE scene (emanations.js liveNow) — the active scene, or one a connected
      // user views. The suite only views the range; activated here as smoke-emanations does, restored after.
      const priorActive = game.scenes.active ?? null;
      if (priorActive?.id !== scene.id) { await scene.activate(); await sleep(1500); }
      const rage = await lend(pcAttacker, 'Rage');
      const wilds = await lend(pcAttacker, 'Rage of the Wilds');
      const t0 = Date.now();
      const pickButton = label => [...document.querySelectorAll('.application.dialog button[data-action^="pick-"]')].find(b => textOf(b) === label) ?? null;
      const wolfRegion = () => scene.regions.find(r => { const fl = r.getFlag(MOD, 'emanation'); return (fl?.kind === 'feature') && (fl.key === 'Rage of the Wolf') && (fl.tokenId === pcToken.document.id); }) ?? null;
      const memberOn = actor => actor.effects.find(e => e.getFlag(MOD, 'emanation') && e.name.startsWith('Rage of the Wolf')) ?? null;   // "Rage of the Wolf — <bearer>"
      try {
        const card = await useFeature(pcToken, rage);
        const choice = card?.getFlag(MOD, 'castApply')?.choice ?? null;
        const rageFx = await waitFor(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, 6000);
        ok('25a. the Rage\'s card asks "Rage of the Wilds — Bear, Eagle or Wolf?" (a free pick), and the Rage lands at once, before any pick',
          (choice?.key === 'Rage of the Wilds') && (JSON.stringify(choice?.options) === JSON.stringify(['Bear', 'Eagle', 'Wolf'])) && (choice?.free === true)
            && !choice?.chosen && !!rageFx,
          `choice=${JSON.stringify(choice)} rage=${!!rageFx}`);
        const wolf = await waitFor(() => pickButton('Wolf'), 6000);
        await waitFor(() => cardEl(card?.id), 3000);
        ok('25b. the popup on the barbarian\'s client: a button each for Bear, Eagle and Wolf; the card says "pick one"',
          !!wolf && !!pickButton('Bear') && !!pickButton('Eagle') && /Rage of the Wilds — Bear, Eagle or Wolf\?/.test(cardText(card?.id)) && /pick one/.test(cardText(card?.id)),
          `wolf=${!!wolf} bear=${!!pickButton('Bear')} card=${cardText(card?.id).slice(0, 200)}`);
        wolf?.click();
        const wolfFx = await waitFor(() => fxNamed(pcAttacker, ['Rage of the Wolf']).find(e => !e.getFlag(MOD, 'emanation')) ?? null, 8000);
        const wolfCard = game.messages.contents.find(m => (m.timestamp >= t0) && (m.id !== card?.id) && (m.getAssociatedItem?.()?.id === wilds.id)) ?? null;
        ok('25c. Wolf chosen: the feature\'s own Wolf activity used (its card), "Rage of the Wolf" on the barbarian',
          (card?.getFlag(MOD, 'castApply')?.choice?.chosen === 'Wolf') && !!wolfCard && !!wolfFx,
          `chosen=${card?.getFlag(MOD, 'castApply')?.choice?.chosen} wolfCard=${wolfCard?.id ?? null} activity=${wolfCard?.getFlag('dnd5e', 'activity')?.id ?? null} fx=${wolfFx?.name ?? null}`);
        await sleep(800);
        // UNSURE — a probable DEFECT, not a test guess: polish.js castChoice keys the Wolf's own card by its item
        // (Rage of the Wilds IS the row's key), so that card may be stamped with a second free pick and re-open the
        // popup. Red here = the code, not the suite.
        ok('25d. the Wolf\'s own card asks nothing more (no second pick, no popup)', !wolfCard?.getFlag(MOD, 'castApply')?.choice && !pickButton('Wolf'),
          `wolfChoice=${JSON.stringify(wolfCard?.getFlag(MOD, 'castApply')?.choice ?? null)} popup=${!!pickButton('Wolf')}`);
        await closeA1();
        const region = await waitFor(wolfRegion, 10000);
        const member = await waitFor(() => memberOn(victim), 8000);
        ok('25e. the quiet ring: a region attached to the barbarian\'s token, the Victim within 5 ft wears the member copy; no emanation card; the Cleric (an ally) wears none',
          !!region && (region.attachment?.token?.id === pcToken.document.id) && !!member && !memberOn(cleric)
            && !game.messages.contents.some(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'emanationCard')?.key === 'Rage of the Wolf')),
          `region=${region?.id ?? null} flag=${JSON.stringify(region?.getFlag(MOD, 'emanation') ?? null)} member=${member?.name ?? null} victimFx=${JSON.stringify(victim.effects.map(e => [e.name, !!e.getFlag(MOD, 'emanation')]))} cleric=${!!memberOn(cleric)} cards=${game.messages.contents.filter(m => (m.timestamp >= t0) && m.getFlag(MOD, 'emanationCard')).map(m => m.getFlag(MOD, 'emanationCard').key)}`);
        if (!clericWeapon || !pcWeapon) log.push(`§25 gate skipped: clericWeapon=${!!clericWeapon} pcWeapon=${!!pcWeapon}`);
        else {
          const ally = await gateFor(clericToken, attackOf(cleric, clericWeapon), victimToken);
          ok('25f. the Cleric attacking the Victim: the gate lists "Rage of the Wolf", net Advantage',
            ally.open && /Rage of the Wolf/.test(ally.text) && (ally.net === 'advantage'), `net=${ally.net} text=${ally.text.slice(0, 220)}`);
          const own = await gateFor(pcToken, attackOf(pcAttacker, pcWeapon), victimToken);
          ok('25g. the barbarian\'s OWN attack at the Victim: no "Rage of the Wolf" row', own.open && !/Rage of the Wolf/.test(own.text),
            `net=${own.net} text=${own.text.slice(0, 220)}`);
        }
      } finally {
        await closeA1();
        await dropFx(pcAttacker, RAGE_FX);
        await unlend(pcAttacker, wilds);
        await unlend(pcAttacker, rage);
        const gone = await waitFor(() => !wolfRegion() && !memberOn(victim), 8000);
        if (!gone) {
          log.push('§25 cleanup: the Wolf ring outlived its lends — deleted by hand');
          const r = wolfRegion(); if (r) await r.delete().catch(() => {});
          const m = memberOn(victim); if (m) await m.delete().catch(() => {});
        }
        clearTargets();
        if (priorActive && (priorActive.id !== scene.id)) { await priorActive.activate().catch(() => {}); await sleep(1000); }
        // ⚠ Activating the prior scene moves this page's canvas off the range: every later section needs it back.
        if (canvas.scene?.id !== scene.id) { await scene.view(); for (let i = 0; i < 40 && !(canvas.ready && canvas.scene?.id === scene.id); i++) await sleep(250); await sleep(500); }
      }
    }

    // ---- 26. Tides of Chaos: the buy box (ADVANTAGE_BUYS)
    if (want(26)) {
      await closeA1();
      const native = pcAttacker.items.find(i => (i.type === 'feat') && (i.name === 'Tides of Chaos')) ?? null;
      const tides = native ?? await lend(pcAttacker, 'Tides of Chaos');
      const priorUses = { 'system.uses.spent': tides.system._source.uses?.spent ?? 0, 'system.uses.max': tides.system._source.uses?.max ?? '' };
      try {
        // UNSURE: the pack's Tides of Chaos carries uses max 1; a max that reads 0 on a non-sorcerer sheet hides the
        // box (buysFor demands max > 0) — set to 1 here when it does not read positive.
        if (!(Number(tides.system.uses?.max) > 0)) await tides.update({ 'system.uses.max': '1' });
        await tides.update({ 'system.uses.spent': 0 });
        const boxOf = dlg => [...(dlg?.element?.querySelectorAll('[data-bf-buy]') ?? [])].find(b => /Tides of Chaos/.test(textOf(b))) ?? null;
        const tickOf = dlg => dlg?.element?.querySelector('input[name="bf-buy"][data-bf-buy-name="Tides of Chaos"]') ?? null;
        const netOf = dlg => dlg?.element?.querySelector('[data-bf-reminder-head] [data-bf-mode]')?.dataset?.bfMode ?? null;
        const openDlg = async () => { const d = await waitFor(rollDialog, 6000); await waitFor(() => boxOf(d), 3000); await sleep(150); return d; };
        const left = () => Number(pcAttacker.items.get(tides.id)?.system?.uses?.value ?? -1);
        const maxN = Number(pcAttacker.items.get(tides.id)?.system?.uses?.max ?? 0);
        const FULL = new RegExp(`Tides of Chaos — 1 use · ${maxN} left`);
        // The attack: the box, closed unrolled (nothing targeted, nothing lands).
        if (!pcWeapon) log.push('§26a skipped: BF Test PC Attacker has no weapon');
        else {
          pcToken.control({ releaseOthers: true }); clearTargets(); await sleep(80);
          const p = attackOf(pcAttacker, pcWeapon).rollAttack({}, {}, {});
          const d = await openDlg();
          ok('26a. an attack dialog: the box "Tides of Chaos — 1 use · 1 left" with an Advantage tick', FULL.test(textOf(boxOf(d))) && !!tickOf(d),
            `box="${textOf(boxOf(d)).slice(0, 90)}" tick=${!!tickOf(d)}`);
          try { await d?.close(); } catch { /* gone */ }
          await Promise.resolve(p).catch(() => {});
        }
        // The save: ticked, pressed Advantage — the use spent, the record names the buy.
        {
          const t1 = Date.now();
          void pcAttacker.rollSavingThrow({ ability: 'dex' });
          const d = await openDlg();
          const box = textOf(boxOf(d));
          const tick = tickOf(d);
          if (tick) { tick.checked = true; tick.dispatchEvent(new Event('change', { bubbles: true })); }
          await sleep(200);
          const net = netOf(d);
          d?.element?.querySelector('button[data-action="advantage"]')?.click();
          const msg = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t1) && (m.getFlag(MOD, 'poolSpend')?.ability === 'Tides of Chaos')) ?? null, 8000);
          await sleep(400);
          const rec = msg?.getFlag(MOD, 'reminder');
          ok('26b. a save dialog: the box; ticked, the net Advantage; pressed, the save rolls at Advantage, the use spent, the record names Tides of Chaos',
            FULL.test(box) && (net === 'advantage') && (Number(msg?.rolls?.[0]?.options?.advantageMode) === 1) && (left() === maxN - 1)
              && (rec?.sources ?? []).some(s => (s.kind === 'buy') && /Tides of Chaos/.test(s.label)),
            `box="${box.slice(0, 80)}" net=${net} mode=${msg?.rolls?.[0]?.options?.advantageMode} left=${left()} rec=${JSON.stringify(rec?.sources ?? null)} spend=${JSON.stringify(msg?.getFlag(MOD, 'poolSpend') ?? null)}`);
        }
        // The check with none left: greyed, no tick.
        {
          await tides.update({ 'system.uses.spent': maxN });
          void pcAttacker.rollSkill({ skill: 'ath' });
          const d = await openDlg();
          ok('26c. a check dialog with no use left: the box greyed "no uses left", no tick', !!boxOf(d) && /no uses left/.test(textOf(boxOf(d))) && !tickOf(d),
            `box="${textOf(boxOf(d)).slice(0, 100)}" tick=${!!tickOf(d)}`);
          try { await d?.close(); } catch { /* gone */ }
        }
      } finally {
        await closeA1();
        clearTargets();
        if (native) await native.update(priorUses).catch(() => {});
        else await unlend(pcAttacker, tides);
      }
    }

    // ---- 27. Commanding Presence: the scoped superiority fold (SUPERIORITY_FOLDS)
    if (want(27)) {
      await closeA1();
      const fighter = game.actors.getName('BF Test Fighter');
      const pool = fighter?.items.find(i => i.name === 'Combat Superiority') ?? null;
      if (!fighter || !pool) log.push(`§27 skipped: BF Test Fighter=${!!fighter} Combat Superiority=${!!pool} — run tools/fixture-suite.mjs`);
      else {
        const priorSpent = pool.system._source.uses?.spent ?? 0;
        // UNSURE: the fixture (a copy of a real Battle Master) may carry Commanding Presence itself — then it is
        // used as it stands and never deleted. Lent from the PHB pack, its consumption re-links to the fixture's
        // Combat Superiority by the pack uuid (actor.sourcedItems), as smoke-superiority's lent maneuvers do.
        const native = fighter.items.find(i => (i.type === 'feat') && (i.name === 'Commanding Presence')) ?? null;
        const cp = native ?? await lend(fighter, 'Commanding Presence');
        const poolLeft = () => Number(fighter.items.get(pool.id)?.system?.uses?.value ?? -1);
        const rescueWindow = text => [...document.querySelectorAll('.application')]
          .find(el => el.querySelector('[data-bf-rescue-row]') && (el.textContent ?? '').includes(text)) ?? null;
        const labels = fl => (fl?.offers ?? []).map(o => o.label);
        const foldOf = async skill => {
          faces([[8, 20]]);
          const rolls = await fighter.rollSkill({ skill }, { configure: false }, {});
          const m = rolls?.[0]?.parent ?? null;
          const flag = await waitFor(() => m?.getFlag(MOD, 'd20fold') ?? null, 3000);
          await sleep(300);
          return { m, flag };
        };
        try {
          await pool.update({ 'system.uses.spent': 0 });
          const full = poolLeft();
          const seen = {};
          for (const skill of ['itm', 'prf', 'ath', 'per']) {   // Persuasion LAST: its window stays open to accept
            seen[skill] = await foldOf(skill);
            if (skill !== 'per') await closeA1();
          }
          ok('27a. a Persuasion check offers "Commanding Presence" — the superiority die (the fold\'s tactical spend, the feature\'s scope)',
            labels(seen.per.flag).includes('Commanding Presence') && (seen.per.flag?.skill === 'per'),
            `offers=${JSON.stringify(labels(seen.per.flag))} die=${(seen.per.flag?.offers ?? []).find(o => o.label === 'Commanding Presence')?.dieFormula}`);
          ok('27b. Intimidation and Performance offer it too', labels(seen.itm.flag).includes('Commanding Presence') && labels(seen.prf.flag).includes('Commanding Presence'),
            `itm=${JSON.stringify(labels(seen.itm.flag))} prf=${JSON.stringify(labels(seen.prf.flag))}`);
          ok('27c. Athletics does not', !labels(seen.ath.flag).includes('Commanding Presence'), `ath=${JSON.stringify(labels(seen.ath.flag))}`);
          // Accept on the Persuasion check (still open): the rescue window's row, keyed by NAME.
          const win = await waitFor(() => rescueWindow('Commanding Presence'), 6000);
          win?.querySelector('[data-bf-rescue-action="tactical:Commanding Presence"]')?.click();
          const done = await waitFor(() => { const fl = seen.per.m?.getFlag(MOD, 'd20fold'); return (fl?.spends?.some(s => (s.name === 'Commanding Presence') && !s.pendingVerdict) && Number.isFinite(fl.foldedTotal)) ? fl : null; }, 10000);
          ok('27d. accepted on Persuasion: a Superiority Die spent, the die rolled and the total patched, the spend named Commanding Presence',
            !!win && (done?.spends?.[0]?.name === 'Commanding Presence') && (done?.foldedTotal === done?.baseTotal + done?.spends?.[0]?.die) && (poolLeft() === full - 1),
            `win=${!!win} flag=${JSON.stringify(done && { status: done.status, outcome: done.outcome, spends: done.spends, base: done.baseTotal, folded: done.foldedTotal })} pool=${poolLeft()}/${full}`);
        } finally {
          CONFIG.Dice.randomUniform = realPRNG;
          await closeA1();
          await pool.update({ 'system.uses.spent': priorSpent }).catch(() => {});
          if (!native) await unlend(fighter, cp);
        }
      }
    }

    // ================================================ §A2 — the hit menu's Monk and Psi Warrior groups (RULINGS *The PHB classes — A2*)
    const hitBox = (offer, key) => offer?.element?.querySelector(`input[name="bf-hit"][value="${key}"]`) ?? null;
    const hitRow = (offer, key) => textOf(offer?.element?.querySelector(`[data-bf-hit-row="${key}"]`));
    const hitRows = offer => [...(offer?.element?.querySelectorAll('[data-bf-hit-row]') ?? [])].map(r => r.dataset.bfHitRow);
    const groupText = (offer, key) => textOf(offer?.element?.querySelector(`div[data-bf-hit-group="${key}"]`));
    const tick = async (offer, ...keys) => { for (const k of keys) { hitBox(offer, k)?.click(); await sleep(60); } };
    const saveCardFor = (key, since) => game.messages.contents.find(m => (m.timestamp >= since) && (m.getFlag(MOD, 'hitManeuverCard')?.key === key)) ?? null;
    const outcomeOn = card => card?.getFlag(MOD, 'saves')?.targets?.find(t => t.uuid === victim.uuid)?.outcome ?? null;
    const settledSave = (key, since) => waitFor(() => { const c = saveCardFor(key, since); return outcomeOn(c) ? c : null; }, 12000);
    const typesOf = d => (d?.rolls ?? []).flatMap(r => [...(r.options?.types ?? []), r.options?.type].filter(Boolean));
    /** The PHB's Unarmed Strike weapon on BF Test PC Attacker (taken back at teardown). */
    const lendUnarmed = async () => {
      const src = await fromUuid('Compendium.dnd-players-handbook.equipment.Item.phbUnarmedStrike');
      if (!src) return null;
      const [us] = await pcAttacker.createEmbeddedDocuments('Item', [src.toObject()]);
      lentBy.set(pcAttacker, [...(lentBy.get(pcAttacker) ?? []), us.id]);
      return us;
    };
    /** A lent copy's damage part pinned to `formula` (the fixture has no Monk / Psi Warrior scale — §17's shape). */
    const pinPart = async (item, act, formula) => {
      const parts = act.toObject().damage.parts;
      parts[0].custom = { enabled: true, formula };
      await item.update({ [`system.activities.${act.id}.damage.parts`]: parts });
    };
    const vfxBase = new Set(victim.effects.map(e => e.id));
    const victimFx = () => victim.effects.filter(e => !vfxBase.has(e.id));
    const dropVictimFx = async () => { const ids = victimFx().map(e => e.id); if (ids.length) await victim.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {}); };
    const a2Combat = async () => {
      const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(c.id);
      await c.createEmbeddedDocuments('Combatant', [
        { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
        { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
      await c.startCombat();
      await sleep(400);
      return c;
    };

    // ---- 28. Stunning Strike and Hand of Harm: the Monk's Focus group
    if (want(28)) {
      await closeDialogs(); await a1Victim(); await set('saveRolls', 'auto');
      const focus = await hgLend(pcAttacker, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const stun = await hgLend(pcAttacker, 'Stunning Strike', 'feat');
      const hoh = await hgLend(pcAttacker, 'Hand of Harm', 'feat');
      const us = await lendUnarmed();
      let combat28 = null;
      try {
        if (!focus || !stun || !hoh || !us || !pcWeapon) log.push(`§28 skipped: focus=${!!focus} stun=${!!stun} hoh=${!!hoh} unarmed=${!!us} weapon=${!!pcWeapon}`);
        else {
          await pinPart(hoh, hoh.system.activities.find(a => a.type === 'damage'), '1d8 + @abilities.wis.mod');
          const spent = () => Number(pcAttacker.items.get(focus.id)?.system?.uses?.spent ?? 0);
          const usAct = () => pcAttacker.items.get(us.id).system.activities.find(a => a.type === 'attack');
          const fx = () => victimFx().map(e => e.name);

          const r0 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('28a. a Longsword hit (a Martial weapon without Light): neither Stunning Strike nor Hand of Harm',
            !hitBox(r0.offer, 'stunning-strike') && !hitBox(r0.offer, 'hand-of-harm'), `offer=${!!r0.offer} rows=${hitRows(r0.offer)}`);
          if (r0.offer) await a1Roll(r0.msg, r0.offer); else await a1Damage(r0.msg);

          const t1 = Date.now();
          const r1 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('28b. an Unarmed Strike hit: the group "Monk\'s Focus · 5 Focus Points left", "Stunning Strike — 1 Focus Point", "Hand of Harm — 1d8 + N necrotic · 1 Focus Point"',
            !!hitBox(r1.offer, 'stunning-strike') && !!hitBox(r1.offer, 'hand-of-harm') && /5 Focus Points left/.test(groupText(r1.offer, 'monks-focus'))
              && /1 Focus Point/.test(hitRow(r1.offer, 'stunning-strike')) && /1d8 \+ -?\d+ necrotic · 1 Focus Point/.test(hitRow(r1.offer, 'hand-of-harm')),
            `group="${groupText(r1.offer, 'monks-focus').slice(0, 200)}"`);
          await tick(r1.offer, 'stunning-strike');
          faces([[1, 20]]);   // every die a 1: the save fails
          await a1Roll(r1.msg, r1.offer);
          const c1 = await settledSave('stunning-strike', t1);
          await waitFor(() => fx().includes('Stunned'), 6000); await sleep(600);
          ok('28c. Stunning Strike, the save failed: Stunned lands, Slowed does not; ONE Focus Point spent (the save\'s own use is the cost)',
            (outcomeOn(c1) === 'failed') && fx().includes('Stunned') && !fx().includes('Slowed') && (spent() === 1),
            `outcome=${outcomeOn(c1)} fx=${JSON.stringify(fx())} spent=${spent()}`);
          await dropVictimFx();

          const t2 = Date.now();
          const r2 = await a1Hit(pcAttacker, pcToken, usAct());
          await tick(r2.offer, 'stunning-strike');
          faces([[20, 20]]);   // every die a 20: the save succeeds
          await a1Roll(r2.msg, r2.offer);
          const c2 = await settledSave('stunning-strike', t2);
          await waitFor(() => fx().includes('Slowed'), 6000); await sleep(600);
          ok('28d. the save succeeded: Slowed lands (the success half — the pack marks it failure-only), Stunned does not; a second point spent',
            (outcomeOn(c2) === 'saved') && fx().includes('Slowed') && !fx().includes('Stunned') && (spent() === 2),
            `outcome=${outcomeOn(c2)} fx=${JSON.stringify(fx())} spent=${spent()} names=${JSON.stringify(c2?.getFlag(MOD, 'saves')?.effectNames ?? null)}`);
          await dropVictimFx();

          const t3 = Date.now();
          const r3 = await a1Hit(pcAttacker, pcToken, usAct());
          await tick(r3.offer, 'stunning-strike', 'hand-of-harm');
          const both = !!hitBox(r3.offer, 'stunning-strike')?.checked && !!hitBox(r3.offer, 'hand-of-harm')?.checked;
          faces([[1, 20]]);
          const d3 = await a1Roll(r3.msg, r3.offer);
          await settledSave('stunning-strike', t3); await sleep(800);
          ok('28e. both ride one hit (the group\'s two picks): the necrotic die on the roll, two more Focus Points',
            both && typesOf(d3).includes('necrotic') && (spent() === 4),
            `both=${both} types=${JSON.stringify(typesOf(d3))} spent=${spent()} picks=${JSON.stringify((d3?.getFlag(MOD, 'hitManeuver')?.picks ?? []).map(p => p.key))}`);
          await dropVictimFx();

          await pcAttacker.items.get(focus.id).update({ 'system.uses.spent': 0 });
          combat28 = await a2Combat();
          const t4 = Date.now();
          const r4 = await a1Hit(pcAttacker, pcToken, usAct());
          await tick(r4.offer, 'stunning-strike');
          faces([[1, 20]]);
          await a1Roll(r4.msg, r4.offer);
          await settledSave('stunning-strike', t4); await sleep(800);
          const chit = pcAttacker.effects.find(e => e.getFlag(MOD, 'riderKey') === 'stunning-strike') ?? null;
          const r5 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('28f. in a combat, the second hit this turn: Stunning Strike greyed "used this turn" (its chit), Hand of Harm still offered',
            !!chit && /used this turn/.test(hitRow(r5.offer, 'stunning-strike')) && (hitBox(r5.offer, 'stunning-strike')?.disabled === true) && (hitBox(r5.offer, 'hand-of-harm')?.disabled === false),
            `chit=${chit?.name ?? null} row="${hitRow(r5.offer, 'stunning-strike').slice(0, 80)}"`);
          if (r5.offer) await a1Roll(r5.msg, r5.offer);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (combat28 && game.combats.get(combat28.id)) await combat28.delete();
        await sleep(800);   // the last save's effect lands after its card
        await dropVictimFx();
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [us, hoh, stun, focus]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 29. Open Hand Technique: after Flurry of Blows, one free pick
    if (want(29)) {
      await closeDialogs(); await a1Victim(); await set('saveRolls', 'auto'); await dropVictimFx();
      const focus = await hgLend(pcAttacker, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const oht = await hgLend(pcAttacker, 'Open Hand Technique', 'feat');
      const us = await lendUnarmed();
      let combat29 = null;
      try {
        if (!focus || !oht || !us || !pcWeapon) log.push(`§29 skipped: focus=${!!focus} oht=${!!oht} unarmed=${!!us}`);
        else {
          const usAct = () => pcAttacker.items.get(us.id).system.activities.find(a => a.type === 'attack');
          const OHT = ['open-hand-addle', 'open-hand-push', 'open-hand-topple'];
          const r0 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('29a. out of combat (no turn to read the Flurry in): an Unarmed Strike offers Addle / Push / Topple, the group "free"',
            OHT.every(k => !!hitBox(r0.offer, k)) && /free/.test(groupText(r0.offer, 'open-hand-technique')),
            `rows=${hitRows(r0.offer)} group="${groupText(r0.offer, 'open-hand-technique').slice(0, 120)}"`);
          if (r0.offer) await a1Roll(r0.msg, r0.offer);

          combat29 = await a2Combat();
          const r1 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('29b. in a combat, no Flurry of Blows this turn: none', !OHT.some(k => hitBox(r1.offer, k)), `rows=${hitRows(r1.offer)}`);
          if (r1.offer) await a1Roll(r1.msg, r1.offer); else await a1Damage(r1.msg);

          const flurry = pcAttacker.items.get(focus.id).system.activities.find(a => a.name === 'Flurry of Blows');
          await flurry?.use({ consume: { resources: false, action: false, spellSlot: false }, subsequentActions: false }, { configure: false }, {});
          const chit = await waitFor(() => pcAttacker.effects.find(e => e.getFlag(MOD, 'riderKey') === 'flurry-of-blows') ?? null, 6000);
          const t2 = Date.now();
          const r2 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('29c. Flurry of Blows used: its turn chit; the next Unarmed Strike offers the three, one pick',
            !!chit && OHT.every(k => !!hitBox(r2.offer, k)), `chit=${chit?.name ?? null} rows=${hitRows(r2.offer)}`);
          await tick(r2.offer, 'open-hand-push', 'open-hand-topple');
          const one = !hitBox(r2.offer, 'open-hand-push')?.checked && !!hitBox(r2.offer, 'open-hand-topple')?.checked;
          faces([[1, 20]]);
          await a1Roll(r2.msg, r2.offer);
          const c2 = await settledSave('open-hand-topple', t2);
          await waitFor(() => victim.statuses?.has?.('prone'), 6000); await sleep(400);
          ok('29d. one pick (Topple gave Push way); the Dexterity save failed: Toppled — the target Prone',
            one && (outcomeOn(c2) === 'failed') && !!victim.statuses?.has?.('prone'),
            `one=${one} outcome=${outcomeOn(c2)} fx=${JSON.stringify(victimFx().map(e => e.name))}`);
          await dropVictimFx();

          const r3 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('29e. a Longsword hit after the Flurry: none (an Unarmed Strike only)', !OHT.some(k => hitBox(r3.offer, k)), `rows=${hitRows(r3.offer)}`);
          if (r3.offer) await a1Roll(r3.msg, r3.offer); else await a1Damage(r3.msg);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (combat29 && game.combats.get(combat29.id)) await combat29.delete();
        await dropVictimFx();
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [us, oht, focus]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 30. Psionic Power: Psionic Strike on the menu, Protective Field for an ally and for yourself
    if (want(30)) {
      await closeDialogs(); await a1Victim(); await spendLuck(); await dropReactionChips(pcAttacker);
      hgKeep(pcAttacker, { 'system.attributes.hp.value': pcAttacker.system._source.attributes.hp.value, 'system.attributes.hp.max': pcAttacker.system._source.attributes.hp.max });
      // The Psi Warrior's own item: the Soulknife's shares the name and the identifier.
      const src = await fromUuid('Compendium.dnd-players-handbook.classes.Item.phbftrPsionicPow');
      let pp = null;
      if (src) {
        const data = src.toObject();
        foundry.utils.setProperty(data, '_stats.compendiumSource', src.uuid);
        [pp] = await pcAttacker.createEmbeddedDocuments('Item', [data]);
        lentBy.set(pcAttacker, [...(lentBy.get(pcAttacker) ?? []), pp.id]);
        await pp.update({ 'system.uses.max': '4', 'system.uses.spent': 0 });
      }
      try {
        if (!pp || !pcWeapon) log.push(`§30 skipped: psionicPower=${!!pp} weapon=${!!pcWeapon}`);
        else {
          const strikeAct = pp.system.activities.find(a => a.name === 'Psionic Strike');
          const fieldAct = pp.system.activities.find(a => a.name === 'Protective Field');
          await pinPart(pp, strikeAct, '1d8 + @abilities.int.mod');
          await pp.update({ [`system.activities.${fieldAct.id}.healing.custom.formula`]: 'max(1, 1d8 + @abilities.int.mod)' });
          const left = () => Number(pcAttacker.items.get(pp.id)?.system?.uses?.value ?? -1);
          await pcAttacker.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });

          const r1 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('30a. a Longsword hit: "Psionic Strike — 1d8 + N force · 1 Psionic Energy Die" in the Psionic Power group',
            !!hitBox(r1.offer, 'psionic-strike') && /1d8 \+ -?\d+ force · 1 Psionic Energy Die/.test(hitRow(r1.offer, 'psionic-strike')),
            `row="${hitRow(r1.offer, 'psionic-strike').slice(0, 120)}" group="${groupText(r1.offer, 'psionic-power').slice(0, 80)}"`);
          await tick(r1.offer, 'psionic-strike');
          const d1 = await a1Roll(r1.msg, r1.offer);
          await sleep(600);
          ok('30b. ticked: the force die rides the roll, one Psionic Energy Die spent', typesOf(d1).includes('force') && (left() === 3),
            `types=${JSON.stringify(typesOf(d1))} left=${left()}`);

          // Protective Field for an ally: the hostile Attacker hits the Halfling, BF Test PC Attacker within 30 ft
          const fieldPopup = () => popups().find(app => /Protective Field/.test(textOf(app.element)) && app.element?.querySelector?.('button[data-action="cast"]')) ?? null;
          const holdOn = since => game.messages.contents.find(m => (m.timestamp >= since) && m.getFlag(MOD, 'damageHold')) ?? null;
          const t2 = Date.now();
          const m2 = await swing({ d20: [19], dmg: 6 });
          const pop = await waitFor(fieldPopup, 8000);
          ok('30c. the Halfling hit: Protective Field asks BF Test PC Attacker ("within 30 ft of you · a Reaction · a Psionic Energy Die", Reduce)',
            !!pop && /within 30 ft of you/.test(textOf(pop?.element)) && /Psionic Energy Die/.test(textOf(pop?.element))
              && (textOf(pop?.element?.querySelector('button[data-action="cast"]')) === 'Reduce'),
            `attack=${!!m2} pop="${textOf(pop?.element).slice(0, 220)}"`);
          faces([[8, 8]]);
          pop?.element?.querySelector('button[data-action="cast"]')?.click();
          const h2 = await waitFor(() => { const m = holdOn(t2); const f = m?.getFlag(MOD, 'damageHold'); return (f?.status === 'resolved') ? f : null; }, 12000);
          await sleep(800);
          // Out of combat no Reaction chip is written (a turn to give it back is needed): the die is the spend.
          ok('30d. Reduce: the die + Int off the Halfling\'s damage, a Psionic Energy Die spent',
            (h2?.answer === 'cast') && (Number(h2?.reduceBy) >= 1) && (left() === 2),
            `hold=${JSON.stringify(h2 && { answer: h2.answer, reduceBy: h2.reduceBy, amount: h2.amount, label: h2.label })} left=${left()} hp=${hp()}`);
          await closeDialogs(); await dropReactionChips(pcAttacker);

          // none left: never asked
          await pcAttacker.items.get(pp.id).update({ 'system.uses.spent': 4 });
          const t3 = Date.now();
          await swing({ d20: [19], dmg: 6 });
          await sleep(2500);
          ok('30e. no Psionic Energy Dice left: the Halfling\'s damage lands with nobody asked', !fieldPopup() && !holdOn(t3) && (hp() < 400),
            `pop=${!!fieldPopup()} hold=${!!holdOn(t3)} hp=${hp()}`);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        await dropReactionChips(pcAttacker);
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        if (pp) await unlend(pcAttacker, pp);
        await healFull();
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 31. Elemental Attunement: its own Elemental Strike, the push or pull
    if (want(31)) {
      await closeDialogs(); await a1Victim(); await set('saveRolls', 'auto');
      const focus = await hgLend(pcAttacker, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const ea = await hgLend(pcAttacker, 'Elemental Attunement', 'feat');
      try {
        // Elemental Strike and Elemental Save are the enchantment's RIDERS: hidden until "Active Attunement" is applied
        // to the item (a use with configure false applies nothing — §23's shape).
        const attune = ea?.system?.activities?.find(a => a.type === 'enchant');
        const attuned = attune ? await attune.use({ subsequentActions: false }, { configure: false }, {}) : null;
        try { await attune?.applyEnchantment(attune.effects?.[0]?._id ?? null, pcAttacker.items.get(ea.id), { chatMessage: attuned?.message ?? null, strict: false }); }
        catch (err) { log.push(`§31 applyEnchantment threw: ${err?.message}`); }
        const strike = await waitFor(() => pcAttacker.items.get(ea?.id)?.system?.activities?.find(a => (a.name === 'Elemental Strike') && a.canUse) ?? null, 6000);
        if (!ea || !strike || !pcWeapon) log.push(`§31 skipped: ea=${!!ea} strike=${!!strike} (usable after the attunement) enchantments=${JSON.stringify(pcAttacker.items.get(ea?.id)?.effects?.map(e => [e.name, e.type, e.isAppliedEnchantment ?? null]) ?? null)}`);
        else {
          await pinPart(ea, strike, '1d8 + @mod');
          const r0 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('31a. a Longsword hit: no Elemental Attunement row (its own Elemental Strike only)', !hitBox(r0.offer, 'elemental-attunement'), `rows=${hitRows(r0.offer)}`);
          if (r0.offer) await a1Roll(r0.msg, r0.offer); else await a1Damage(r0.msg);
          const t1 = Date.now();
          const r1 = await a1Hit(pcAttacker, pcToken, pcAttacker.items.get(ea.id).system.activities.find(a => a.name === 'Elemental Strike'));
          ok('31b. an Elemental Strike hit: "Push or pull — free"', !!hitBox(r1.offer, 'elemental-attunement') && /Push or pull/.test(hitRow(r1.offer, 'elemental-attunement')) && /free/.test(hitRow(r1.offer, 'elemental-attunement')),
            `row="${hitRow(r1.offer, 'elemental-attunement')}"`);
          await tick(r1.offer, 'elemental-attunement');
          faces([[1, 20]]);
          await a1Roll(r1.msg, r1.offer);
          const c1 = await settledSave('elemental-attunement', t1);
          await sleep(600);
          ok('31c. the Strength save, failed; the card says the table moves the token (pushed or pulled up to 10 feet)',
            (outcomeOn(c1) === 'failed') && /pushed or pulled up to 10 feet/.test(cardText(c1?.id)),
            `outcome=${outcomeOn(c1)} card="${cardText(c1?.id).slice(0, 220)}" acts=${JSON.stringify([...pcAttacker.items.get(ea.id).system.activities].map(a => [a.name, a.canUse, a.isRider, a.isHidden]))} riders=${JSON.stringify(pcAttacker.items.get(ea.id).flags?.dnd5e?.riders ?? null)}`);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (ea) await unlend(pcAttacker, ea);
        if (focus) await unlend(pcAttacker, focus);
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ================================================ §A4 — the healing seam and the caster's rows (RULINGS *The PHB classes — A4*)
    const a4Card = (since, test) => game.messages.contents.find(m => (m.timestamp >= since) && test(m)) ?? null;

    // ---- 32. Potent Cantrip: the caster's mirror of Evasion
    if (want(32)) {
      await closeDialogs(); await set('saveRolls', 'auto');
      const potent = await hgLend(attacker, 'Potent Cantrip', 'feat');
      let flameId = attacker.items.find(i => (i.name === 'Sacred Flame') && (i.type === 'spell'))?.id;
      if (!flameId) {
        const flame = await hgLend(attacker, 'Sacred Flame', 'spell', { 'system.prepared': 1, 'system.method': 'atwill' });
        flameId = flame?.id;
      }
      const flameAct = () => attacker.items.get(flameId)?.system?.activities?.find(a => a.type === 'save');
      /** Sacred Flame at the Halfling, every die at its top face (the save a 20): the card, its entry, the damage and the HP lost. */
      const flameAtHalfling = async () => {
        await healFull();
        const t0 = Date.now();
        attackerToken.control({ releaseOthers: true });
        halflingToken.setTarget(true, { releaseOthers: true });
        await sleep(100);
        faces([[20, 20]]);
        const use = await flameAct().use({ consume: { spellSlot: false } }, { configure: false }, {});
        const card = use?.message ?? null;
        const entry = await waitFor(() => { const e = card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === halfling.uuid); return e?.done ? e : null; }, 12000);
        const dmg = await waitFor(() => a4Card(t0, m => (m.type === 'damage') && (m.system?.origin === card?.id || m._source?.system?.origin === card?.id)), 8000);
        // A success with no share writes no receipt (the multiplier is null): the wait runs out, then the HP are read.
        await waitFor(() => dmg?.getFlag(MOD, 'receipt'), 6000);
        await sleep(500);
        clearTargets();
        return { card, entry, dmg, total: Number(dmg?.rolls?.reduce((n, r) => n + (Number(r.total) || 0), 0)), lost: 400 - hp() };
      };
      try {
        if (!potent || !flameAct()) log.push(`§32 skipped: potent=${!!potent} flame=${!!flameAct()}`);
        else {
          const a = await flameAtHalfling();
          ok('32a. the Halfling saves; the entry carries the caster\'s row (casterHalf: Potent Cantrip)',
            (a.entry?.outcome === 'saved') && (a.entry?.casterHalf?.by === 'Potent Cantrip'),
            JSON.stringify({ outcome: a.entry?.outcome, casterHalf: a.entry?.casterHalf ?? null }));
          ok('32b. half the roll lands', (a.total > 1) && (a.lost === Math.floor(a.total / 2)), `total=${a.total} lost=${a.lost}`);
          ok('32c. the card says "saved — half damage (Potent Cantrip)"', /saved — half damage \(Potent Cantrip\)/.test(cardText(a.card?.id)), cardText(a.card?.id).slice(0, 240));
          await unlend(attacker, potent);
          const b = await flameAtHalfling();
          ok('32d. taken back: a saved Sacred Flame lands nothing', (b.entry?.outcome === 'saved') && !b.entry?.casterHalf && (b.lost === 0), `outcome=${b.entry?.outcome} lost=${b.lost}`);
        }
      } finally {
        if (potent) await unlend(attacker, potent);
        await healFull();
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 33. Disciple of Life: the healing roll carries 2 + the slot level
    if (want(33)) {
      await closeDialogs();
      const own = cleric.items.find(i => (i.name === 'Disciple of Life') && (i.type === 'feat'));
      const disciple = own ?? await hgLend(cleric, 'Disciple of Life', 'feat');
      const cure = await hgLend(cleric, 'Cure Wounds', 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
      const cureAct = () => cleric.items.get(cure?.id)?.system?.activities?.find(a => a.type === 'heal');
      const bonusOf = m => (m?.rolls ?? []).flatMap(r => r.terms ?? []).find(t => t?.flavor === 'Disciple of Life') ?? null;
      /** Cure Wounds from the Cleric at the Halfling (HP 1), the dice pinned low but never a 1; the settled message. */
      const cureHalfling = async (scaling = 0) => {
        await halfling.update({ 'system.attributes.hp.value': 1, 'system.attributes.hp.temp': 0 });
        halflingToken.setTarget(true, { releaseOthers: true });
        await sleep(100);
        faces([[3, 8], [5, 8]]);
        const rolls = await cureAct().rollDamage(scaling ? { scaling } : {}, { configure: false }, {});
        const m = rolls?.[0]?.parent ?? null;
        await waitFor(() => m?.getFlag(MOD, 'receipt'), 10000);
        CONFIG.Dice.randomUniform = realPRNG;
        clearTargets();
        return m;
      };
      const healTotal = m => (m?.rolls ?? []).reduce((n, r) => n + (Number(r.total) || 0), 0);
      try {
        if (!disciple || !cureAct()) log.push(`§33 skipped: disciple=${!!disciple} cure=${!!cureAct()}`);
        else {
          const m2 = await cureHalfling(1);
          const line = (await waitFor(() => cardEl(m2?.id)?.querySelector('.bf-heal-bonus-line'), 5000))?.textContent?.trim() ?? '';
          ok('33a. level 2: the healing roll carries 4[Disciple of Life]; the card says "Disciple of Life — +4 healing"',
            (Number(bonusOf(m2)?.number) === 4) && /Disciple of Life — \+4 healing/.test(line), `formula="${m2?.rolls?.[0]?.formula}" line="${line}"`);
          ok('33b. the healing lands with it, once', !!m2?.getFlag(MOD, 'receipt') && (hp() === Math.min(400, 1 + healTotal(m2))), `hp=${hp()} total=${healTotal(m2)}`);
          const m1 = await cureHalfling(0);
          ok('33c. level 1: +3', Number(bonusOf(m1)?.number) === 3, `formula="${m1?.rolls?.[0]?.formula}"`);
          await cleric.items.get(cure.id)?.update({ 'system.method': 'innate' });
          const mi = await cureHalfling(0);
          ok('33d. cast innately (no slot): no bonus', !bonusOf(mi) && !!mi, `formula="${mi?.rolls?.[0]?.formula}"`);
        }
      } finally {
        if (cure) await unlend(cleric, cure);
        if (disciple && !own) await unlend(cleric, disciple);
        await healFull();
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 34. Psychic Spells: a free row of the casting window
    if (want(34)) {
      await closeDialogs();
      const psychic = await hgLend(sorcerer, 'Psychic Spells', 'feat');
      const chill = await hgLend(sorcerer, 'Chill Touch', 'spell', { 'system.prepared': 1, 'system.method': 'spell', 'system.sourceItem': 'class:warlock' });
      const spellAct = name => sorcerer.items.find(i => (i.type === 'spell') && (i.name === name))?.system?.activities?.find(a => ['attack', 'save', 'damage'].includes(a.type)) ?? null;
      const usageApps = () => [...foundry.applications.instances.values()].filter(a => /ActivityUsageDialog|UsageDialog/.test(a.constructor?.name ?? ''));
      // An attack needs a target to be used at all (polish.js): the Halfling.
      const openWindow = async name => {
        halflingToken.setTarget(true, { releaseOthers: true });
        await sleep(80);
        const pendingUse = spellAct(name)?.use({ consume: { spellSlot: false } }, { configure: true }, { create: true });
        pendingUse?.catch?.(() => { /* closed below */ });
        const app = await waitFor(() => usageApps().find(a => a.element?.querySelector?.('[data-bf-metamagic-field]')) ?? null, 6000);
        return { app, fs: app?.element?.querySelector('[data-bf-metamagic-field]') ?? null };
      };
      const rowOf = (fs, key) => fs?.querySelector(`[data-bf-metamagic-row="${key}"]`) ?? null;
      const closeWindows = async () => { for (const a of usageApps()) { try { await a.close(); } catch { /* gone */ } } };
      /** Cast Chill Touch through its window, Psychic Spells ticked or not; its damage rolled chained to the card. */
      const castChill = async tick => {
        const t0 = Date.now();
        const { app, fs } = await openWindow('Chill Touch');
        const box = rowOf(fs, 'psychic')?.querySelector('input[name="bf-metamagic-free"]');
        if (box && (box.checked !== tick)) box.click();
        await sleep(100);
        app?.element?.querySelector('button[data-action="use"], button[type="submit"]')?.click();
        const card = await waitFor(() => a4Card(t0, m => (m.type === 'usage') && (m.system?.activity?.uuid === spellAct('Chill Touch')?.uuid)), 8000);
        await sleep(300);
        const rolls = card ? await spellAct('Chill Touch').rollDamage({}, { configure: false }, { data: { 'system.origin': card.id } }) : null;
        clearTargets();
        return { card, dmg: rolls?.[0]?.parent ?? null, rolls };
      };
      try {
        if (!psychic || !chill || !spellAct('Fire Bolt')) log.push(`§34 skipped: psychic=${!!psychic} chill=${!!chill} fireBolt=${!!spellAct('Fire Bolt')}`);
        else {
          const fb = await openWindow('Fire Bolt');
          const fbRow = rowOf(fb.fs, 'psychic');
          ok('34a. Fire Bolt (the Sorcerer\'s own): the row greyed "not a Warlock spell"', (fbRow?.dataset?.bfOff === '1') && /not a Warlock spell/.test(textOf(fbRow)), textOf(fbRow) || `window=${!!fb.app} group=${!!fb.fs}`);
          await closeWindows();
          const ct = await openWindow('Chill Touch');
          const row = rowOf(ct.fs, 'psychic');
          const box = row?.querySelector('input[name="bf-metamagic-free"]');
          ok('34b. Chill Touch (a Warlock spell): "Psychic Spells · free", live, beside the Metamagic rows', !!box && !box.disabled && /Psychic Spells/.test(textOf(row)) && /free/i.test(textOf(row))
            && !!ct.fs?.querySelector('input[name="bf-metamagic"]'), textOf(row));
          box?.click(); await sleep(100);
          const paidOn = [...(ct.fs?.querySelectorAll('input[name="bf-metamagic"]') ?? [])].filter(b => !b.disabled).length;
          ok('34c. its tick greys no Metamagic row', paidOn > 0, `live paid rows=${paidOn}`);
          await closeWindows();
          await sleep(3200);   // the closed window's tick is swept
          const on = await castChill(true);
          const line = (await waitFor(() => cardEl(on.card?.id)?.querySelector('.bf-metamagic-free-line'), 5000))?.textContent?.trim() ?? '';
          ok('34d. cast ticked: the card carries the tick and says "Psychic Spells — the damage is psychic"',
            (on.card?.getFlag(MOD, 'metamagicFree')?.[0]?.key === 'psychic') && /Psychic Spells — the damage is psychic/.test(line), `flag=${JSON.stringify(on.card?.getFlag(MOD, 'metamagicFree'))} line="${line}"`);
          ok('34e. the damage roll is psychic', (on.rolls ?? []).length > 0 && on.rolls.every(r => r.options?.type === 'psychic') && (on.dmg?.getFlag(MOD, 'metamagicType')?.feature === 'Psychic Spells'),
            `types=${JSON.stringify((on.rolls ?? []).map(r => r.options?.type))}`);
          const off = await castChill(false);
          ok('34f. cast unticked: no tick on the card, the damage its own necrotic', !off.card?.getFlag(MOD, 'metamagicFree') && (off.rolls ?? []).length > 0 && off.rolls.every(r => r.options?.type === 'necrotic'),
            `flag=${JSON.stringify(off.card?.getFlag(MOD, 'metamagicFree') ?? null)} types=${JSON.stringify((off.rolls ?? []).map(r => r.options?.type))}`);
        }
      } finally {
        await closeWindows();
        if (chill) await unlend(sorcerer, chill);
        if (psychic) await unlend(sorcerer, psychic);
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 35. Potent Cantrip on a miss: rolled once the miss is final, half landed
    if (want(35)) {
      await closeDialogs(); await a1Victim();
      const potent = await hgLend(pcAttacker, 'Potent Cantrip', 'feat');
      const bolt = await hgLend(pcAttacker, 'Fire Bolt', 'spell', { 'system.prepared': 1, 'system.method': 'atwill' });
      const boltAct = () => pcAttacker.items.get(bolt?.id)?.system?.activities?.find(a => a.type === 'attack') ?? null;
      hgKeep(pcAttacker, { 'system.attributes.inspiration': pcAttacker.system._source.attributes?.inspiration ?? false });
      const vhp = () => Number(victim.system.attributes.hp.value);
      // ⚠ Only a window opened SINCE this attack: an earlier section's rescue window can still stand in a full run.
      const rescueWindow = prior => [...document.querySelectorAll('.application')]
        .find(el => !prior.has(el) && el.querySelector('[data-bf-rescue-action="heroic"]')) ?? null;
      const appsNow = () => new Set(document.querySelectorAll('.application'));
      const damagesFor = id => game.messages.contents.filter(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === id));
      const totalOf = d => Number(d?.rolls?.reduce((n, r) => n + (Number(r.total) || 0), 0));
      /** Fire Bolt at the Victim (400 HP): the d20 a 2, later dice `after`; the attack message. */
      const boltMiss = async (after = [[8, 10]]) => {
        await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
        pcToken.control({ releaseOthers: true });
        victimToken.setTarget(true, { releaseOthers: true });
        await sleep(100);
        faces([[2, 20], ...after]);
        const rolls = await boltAct().rollAttack({}, { configure: false }, {});
        return rolls?.[0]?.parent ?? null;
      };
      try {
        if (!potent || !boltAct()) log.push(`§35 skipped: potent=${!!potent} bolt=${!!boltAct()}`);
        else {
          await pcAttacker.update({ 'system.attributes.inspiration': false });
          await victim.update({ 'system.attributes.ac.override': 30 });
          // a. the clean miss, no rescue: the share rolls and lands
          const m1 = await boltMiss();
          const d1 = await waitFor(() => { const d = damagesFor(m1?.id)[0]; return d?.getFlag(MOD, 'receipt') ? d : null; }, 10000);
          const note1 = JSON.stringify(d1?.getFlag(MOD, 'receipt') ?? null);
          ok('35a. a missed Fire Bolt: its damage rolls and half lands, the receipt says "missed — Potent Cantrip, half damage"',
            (totalOf(d1) > 1) && ((400 - vhp()) === Math.floor(totalOf(d1) / 2)) && /missed — Potent Cantrip, half damage/.test(note1),
            `total=${totalOf(d1)} lost=${400 - vhp()} receipt=${note1.slice(0, 160)}`);
          CONFIG.Dice.randomUniform = realPRNG;
          // b. without the feature: nothing rolls
          await unlend(pcAttacker, potent);
          const m2 = await boltMiss();
          await sleep(2500);
          ok('35b. without Potent Cantrip a miss rolls nothing', !damagesFor(m2?.id).length && (vhp() === 400), `damages=${damagesFor(m2?.id).length} hp=${vhp()}`);
          CONFIG.Dice.randomUniform = realPRNG;
          const potent2 = await hgLend(pcAttacker, 'Potent Cantrip', 'feat');
          // c. a rescue window first (Heroic Inspiration): nothing rolls while it stands; Pass → the share
          await pcAttacker.update({ 'system.attributes.inspiration': true });
          const prior3 = appsNow();
          const m3 = await boltMiss();
          const win3 = await waitFor(() => rescueWindow(prior3), 8000);
          await sleep(1200);
          const early = damagesFor(m3?.id).length;
          ok('35c. with Heroic Inspiration the rescue window opens and NOTHING rolls while it stands', !!win3 && (early === 0) && (m3?.getFlag(MOD, 'd20fold')?.status === 'pending'),
            `window=${!!win3} damages=${early} fold=${m3?.getFlag(MOD, 'd20fold')?.status}`);
          faces([[8, 10]]);
          win3?.querySelector('button[data-action="pass"]')?.click();
          const d3 = await waitFor(() => { const d = damagesFor(m3?.id)[0]; return d?.getFlag(MOD, 'receipt') ? d : null; }, 10000);
          await sleep(800);
          ok('35d. Pass: the miss stands — the share rolls and half lands, once', (damagesFor(m3?.id).length === 1) && (totalOf(d3) > 1) && ((400 - vhp()) === Math.floor(totalOf(d3) / 2)),
            `damages=${damagesFor(m3?.id).length} total=${totalOf(d3)} lost=${400 - vhp()}`);
          CONFIG.Dice.randomUniform = realPRNG;
          // e. the Heroic reroll turns it: the FULL roll, one damage message, no share
          await pcAttacker.update({ 'system.attributes.inspiration': true });
          await victim.update({ 'system.attributes.ac.override': 12 });
          const prior4 = appsNow();
          const m4 = await boltMiss();
          const win4 = await waitFor(() => rescueWindow(prior4), 8000);
          faces([[20, 20], [8, 10]]);
          win4?.querySelector('[data-bf-rescue-action="heroic"]')?.click();
          const d4 = await waitFor(() => { const d = damagesFor(m4?.id)[0]; return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
          await sleep(1500);
          ok('35e. the Heroic reroll turns the miss: ONE damage roll, the full total lands (never a share beside it)',
            (damagesFor(m4?.id).length === 1) && (totalOf(d4) > 0) && ((400 - vhp()) === totalOf(d4)),
            `damages=${damagesFor(m4?.id).length} total=${totalOf(d4)} lost=${400 - vhp()} fold=${JSON.stringify(m4?.getFlag(MOD, 'd20fold')?.targets?.map(t => t.verdict))}`);
          await unlend(pcAttacker, potent2);
        }
      } finally {
        await closeDialogs();
        for (const it of pcAttacker.items.filter(i => ['Potent Cantrip', 'Fire Bolt'].includes(i.name) && (lentBy.get(pcAttacker) ?? []).includes(i.id))) await unlend(pcAttacker, it);
        await victim.update({ 'system.attributes.hp.value': 400 });
        CONFIG.Dice.randomUniform = realPRNG;
        clearTargets();
      }
    }

    // ---- 36. Arcane Ward: the ward pool
    if (want(36)) {
      await closeDialogs();
      const ward = await hgLend(sorcerer, 'Arcane Ward', 'feat', { 'system.uses.max': '12', 'system.uses.spent': 12 });
      const armor = await hgLend(sorcerer, 'Mage Armor', 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
      const sorcTok = canvas.tokens.placeables.find(t => t.actor?.id === sorcerer.id) ?? null;
      hgKeep(sorcerer, {
        'system.attributes.hp.value': sorcerer.system._source.attributes.hp.value,
        'system.attributes.hp.max': sorcerer.system._source.attributes.hp.max,
        'system.attributes.hp.temp': sorcerer.system._source.attributes.hp.temp ?? 0,
        'system.attributes.ac.override': sorcerer.system._source.attributes.ac.override ?? null,
        'system.spells': foundry.utils.deepClone(sorcerer.system._source.spells)
      });
      const wardNow = () => Number(sorcerer.items.get(ward?.id)?.system?.uses?.value ?? NaN);
      const shp = () => Number(sorcerer.system.attributes.hp.value);
      const setWard = n => sorcerer.items.get(ward.id).update({ 'system.uses.spent': 12 - n });
      const armorAct = () => sorcerer.items.get(armor?.id)?.system?.activities?.contents?.[0] ?? null;
      const lineOf = async card => (await waitFor(() => cardEl(card?.id)?.querySelector('.bf-ward-line'), 5000))?.textContent?.trim() ?? '';
      const cast = async (level = 1) => {
        sorcTok?.setTarget(true, { releaseOthers: true });
        await sleep(80);
        const r = await armorAct()?.use({ spell: { slot: `spell${level}` }, subsequentActions: false }, { configure: false }, {});
        clearTargets();
        const card = r?.message ?? null;
        await waitFor(() => card?.getFlag(MOD, 'wardRefill'), 6000);
        return card;
      };
      try {
        if (!ward || !armorAct() || !sorcTok) log.push(`§36 skipped: ward=${!!ward} armor=${!!armorAct()} token=${!!sorcTok}`);
        else {
          await sorcerer.update({ 'system.attributes.hp.max': 200, 'system.attributes.hp.value': 200, 'system.attributes.hp.temp': 0,
            'system.attributes.ac.override': 5, 'system.spells.spell1.value': 4, 'system.spells.spell2.value': 3 });
          // a. the first Abjuration slot cast creates it, full
          const c1 = await cast(1);
          ok('36a. Mage Armor (level 1) creates the ward: 12 of 12, the card says "created, 12 hit points (of 12)"',
            (wardNow() === 12) && /Arcane Ward — created, 12 hit points \(of 12\)/.test(await lineOf(c1)), `ward=${wardNow()} line="${await lineOf(c1)}"`);
          // b. damage applied straight to the actor (the card's own buttons' road): the ward takes it
          await sorcerer.applyDamage([{ value: 5, type: 'bludgeoning' }]);
          await sleep(500);
          ok('36b. 5 damage applied to the actor lands on the ward: HP untouched, the ward 12 → 7', (shp() === 200) && (wardNow() === 7), `hp=${shp()} ward=${wardNow()}`);
          // c. a hit through the module with the ward at 2: the receipt says what it took; the revert gives both back
          await setWard(2);
          attackerToken.control({ releaseOthers: true });
          sorcTok.setTarget(true, { releaseOthers: true });
          await sleep(80);
          faces([[15, 20], [6, 6], [6, 6]]);
          const usage = await act().use({ subsequentActions: false }, { configure: false }, {});
          const rolls = await act().rollAttack({}, { configure: false }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
          const atk = rolls?.[0]?.parent ?? null;
          const dmg = await waitFor(() => { const d = damageFor(atk?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
          CONFIG.Dice.randomUniform = realPRNG;
          clearTargets();
          const total = Number(dmg?.rolls?.reduce((n, r) => n + (Number(r.total) || 0), 0));
          const entry = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === sorcerer.uuid);
          ok('36c. a hit with the ward at 2: "Arcane Ward took 2 — N landed", the ward 0, the HP down by the rest',
            (wardNow() === 0) && (shp() === 200 - (total - 2)) && new RegExp(`Arcane Ward took 2 — ${total - 2} landed`).test(entry?.note ?? '') && (entry?.ward?.took === 2),
            `total=${total} hp=${shp()} ward=${wardNow()} note="${entry?.note}" ward=${JSON.stringify(entry?.ward)}`);
          const { revertTarget } = await import('/modules/fvtt-mod-battleflow/scripts/receipts.js');
          await revertTarget(dmg, sorcerer.uuid);
          await sleep(500);
          ok('36d. the revert gives both back: HP 200, the ward 2', (shp() === 200) && (wardNow() === 2), `hp=${shp()} ward=${wardNow()}`);
          // e. a level-2 Abjuration cast refills +4
          await setWard(0);
          const c2 = await cast(2);
          ok('36e. Mage Armor at level 2 refills +4: "Arcane Ward — +4 (4 of 12)"', (wardNow() === 4) && /Arcane Ward — \+4 \(4 of 12\)/.test(await lineOf(c2)),
            `ward=${wardNow()} line="${await lineOf(c2)}"`);
          // f. at 0 it takes nothing
          await setWard(0);
          await sorcerer.applyDamage([{ value: 5, type: 'bludgeoning' }]);
          await sleep(400);
          ok('36f. a ward at 0 takes nothing: the 5 lands', (shp() === 195) && (wardNow() === 0), `hp=${shp()} ward=${wardNow()}`);
        }
      } finally {
        if (armor) await unlend(sorcerer, armor);
        if (ward) await unlend(sorcerer, ward);
        CONFIG.Dice.randomUniform = realPRNG;
        clearTargets();
      }
    }

    // ================================================ §A6 — the grants on Initiative and at the turn (RULINGS *The PHB classes — A6*)
    // A healing activity's custom formula pinned on the lent copy (the fixtures carry no class scales or levels).
    const pinHeal = async (item, name, formula) => {
      const a = actNamed(item, name);
      if (a) await item.update({ [`system.activities.${a.id}.healing.custom`]: { enabled: true, formula } });
    };
    const grantCards = (actor, row) => game.messages.contents.filter(m => (m.timestamp >= suiteStart)
      && (m.getFlag(MOD, 'initiativeGrant')?.actorUuid === actor.uuid) && (m.getFlag(MOD, 'initiativeGrant')?.row === row));
    const grantLine = async m => (await waitFor(() => cardEl(m?.id)?.querySelector('.bf-initiative-grant-line'), 5000))?.textContent?.trim() ?? '';
    const titled = re => popups().find(app => re.test(titleOf(app))) ?? null;

    // ---- 37. the Initiative grants: Persistent Rage (automatic), Uncanny Metabolism (offered); the Rage reminder silenced
    if (want(37)) {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);
      hgKeep(halfling, { 'system.attributes.hp.value': halfling.system._source.attributes.hp.value,
        'system.attributes.hp.max': halfling.system._source.attributes.hp.max });
      const rage = await hgLend(pcAttacker, 'Rage', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 2 });
      const persistent = await hgLend(pcAttacker, 'Persistent Rage', 'feat');
      const focus = await hgLend(halfling, "Monk's Focus", 'feat', { 'system.uses.max': '3', 'system.uses.spent': 3 });
      const uncanny = await hgLend(halfling, 'Uncanny Metabolism', 'feat');
      if (uncanny) await pinHeal(uncanny, 'Uncanny Metabolism', '1d8 + 5');
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      const spentOf = (actor, item) => Number(actor.items.get(item?.id)?.system?.uses?.spent ?? NaN);
      const hhp = () => Number(halfling.system.attributes.hp.value);
      try {
        if (!rage || !persistent || !focus || !uncanny) log.push(`§37 skipped: rage=${!!rage} persistent=${!!persistent} focus=${!!focus} uncanny=${!!uncanny}`);
        else {
          await halfling.update({ 'system.attributes.hp.max': 60, 'system.attributes.hp.value': 30 });
          // ⚠ The created combatants do not come back in the order asked: find each by its actor.
          await combat.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id },
            { tokenId: halflingToken.document.id, sceneId: scene.id, actorId: halfling.id }]);
          const pcC = combat.combatants.find(c => c.actorId === pcAttacker.id);
          const hC = combat.combatants.find(c => c.actorId === halfling.id);
          // a. Persistent Rage: automatic — the Rage uses back, its own use spent, the card
          await combat.setInitiative(pcC.id, 18);
          const pr = await waitFor(() => { const m = grantCards(pcAttacker, 'Persistent Rage')[0]; return m?.getFlag(MOD, 'initiativeGrant')?.applied ? m : null; }, 8000);
          ok('37a. Persistent Rage at Initiative: Rage 3 of 3, its own use spent, the card "Persistent Rage — Rage uses regained (3 of 3)"',
            !!pr && (spentOf(pcAttacker, rage) === 0) && (spentOf(pcAttacker, persistent) === 1) && /Persistent Rage — Rage uses regained \(3 of 3\)/.test(await grantLine(pr)),
            `card=${!!pr} rageSpent=${spentOf(pcAttacker, rage)} own=${spentOf(pcAttacker, persistent)} line="${await grantLine(pr)}" all=${JSON.stringify(grantCards(pcAttacker, 'Persistent Rage').map(m => m.getFlag(MOD, 'initiativeGrant')))} read=${JSON.stringify(combat.getFlag(MOD, 'initiativeGrantRead') ?? null)} rages=${JSON.stringify(pcAttacker.items.filter(i => /rage/i.test(i.name)).map(i => [i.name, i.system.uses?.max, i.system.uses?.spent]))} init=${pcC.initiative}`);
          // b. Uncanny Metabolism: offered; Yes — the Focus Points back, the heal rolled and landed, its use spent
          faces([[4, 8]]);
          await combat.setInitiative(hC.id, 12);
          const um = await waitFor(() => grantCards(halfling, 'Uncanny Metabolism')[0] ?? null, 8000);
          const pop = await waitFor(() => titled(/^Uncanny Metabolism — /), 6000);
          ok('37b. Uncanny Metabolism at Initiative asks: "regain 3 Focus Points and 1d8 + 5 Hit Points? (once per Long Rest)"',
            !!pop && /regain 3 Focus Points and 1d8 \+ 5 Hit Points\? \(once per Long Rest\)/.test(textOf(pop?.element)),
            `card=${!!um} popup=${!!pop} text="${textOf(pop?.element).slice(0, 200)}"`);
          pop?.element?.querySelector('button[data-action="yes"]')?.click();
          const done = await waitFor(() => um?.getFlag(MOD, 'initiativeGrant')?.applied ? um : null, 8000);
          CONFIG.Dice.randomUniform = realPRNG;
          const healed = Number(done?.getFlag(MOD, 'initiativeGrant')?.healed ?? NaN);
          ok('37c. Yes: Focus 3 of 3, the heal (4 + 5 = 9) lands, its use spent; the line says both',
            (spentOf(halfling, focus) === 0) && (spentOf(halfling, uncanny) === 1) && (healed === 9) && (hhp() === 39)
              && /Focus Points regained \(3 of 3\), 9 Hit Points regained/.test(await grantLine(done)),
            `focus=${spentOf(halfling, focus)} own=${spentOf(halfling, uncanny)} healed=${healed} hp=${hhp()} line="${await grantLine(done)}"`);
          // d. rerolled: both spent — nothing is posted again
          const before = grantCards(pcAttacker, 'Persistent Rage').length + grantCards(halfling, 'Uncanny Metabolism').length;
          await rage.update({ 'system.uses.spent': 1 });
          await combat.resetAll();
          await sleep(600);
          await combat.setInitiative(pcC.id, 17);
          await combat.setInitiative(hC.id, 11);
          await sleep(2000);
          ok('37d. rerolled with both uses spent: no second card', (grantCards(pcAttacker, 'Persistent Rage').length + grantCards(halfling, 'Uncanny Metabolism').length) === before,
            `cards=${grantCards(pcAttacker, 'Persistent Rage').length + grantCards(halfling, 'Uncanny Metabolism').length} before=${before}`);
          // e. No keeps the use: nothing written
          await uncanny.update({ 'system.uses.spent': 0 });
          await focus.update({ 'system.uses.spent': 2 });
          await combat.resetAll();
          await sleep(600);
          await combat.setInitiative(hC.id, 10);
          const pop2 = await waitFor(() => titled(/^Uncanny Metabolism — /), 6000);
          pop2?.element?.querySelector('button[data-action="no"]')?.click();
          const um2 = await waitFor(() => grantCards(halfling, 'Uncanny Metabolism').find(m => m.getFlag(MOD, 'initiativeGrant')?.answer === 'no') ?? null, 6000);
          await sleep(600);
          ok('37e. No: the use kept, Focus untouched, the line "Uncanny Metabolism — kept for later"',
            !!um2 && (spentOf(halfling, uncanny) === 0) && (spentOf(halfling, focus) === 2) && /Uncanny Metabolism — kept for later/.test(await grantLine(um2)),
            `card=${!!um2} own=${spentOf(halfling, uncanny)} focus=${spentOf(halfling, focus)} line="${await grantLine(um2)}" read=${JSON.stringify(combat.getFlag(MOD, 'initiativeGrantRead') ?? null)} inits=${JSON.stringify(combat.combatants.map(c => c.initiative))} cards=${grantCards(halfling, 'Uncanny Metabolism').length}`);
          // f. Persistent Rage silences the Rage's turn-end reminder
          await combat.setInitiative(pcC.id, 20);
          await combat.startCombat();
          await sleep(400);
          const toTurnOf = async actor => { for (let i = 0; (i < 4) && (combat.combatant?.actorId !== actor.id); i++) { await combat.nextTurn(); await sleep(300); } };
          await toTurnOf(pcAttacker);
          await useFeature(pcToken, rage);
          await waitFor(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, 6000);
          await combat.nextTurn();
          await toTurnOf(pcAttacker);
          const r2 = combat.round;
          await combat.nextTurn();
          await sleep(2500);
          const reminded = game.messages.contents.some(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'turnGrant')?.remind === 'extend')
            && String(m.getFlag(MOD, 'turnGrant')?.place ?? '').startsWith(`${combat.id}|${r2}|`));
          ok('37f. with Persistent Rage a quiet raging turn ends with no reminder', !!fxNamed(pcAttacker, ['Rage'])[0] && !reminded,
            `rage=${!!fxNamed(pcAttacker, ['Rage'])[0]} reminded=${reminded}`);
        }
      } finally {
        await closeA1();
        await hgClose(/^Uncanny Metabolism — /);
        if (game.combats.get(combat.id)) await combat.delete();
        await dropFx(pcAttacker, RAGE_FX);
        for (const [actor, it] of [[pcAttacker, rage], [pcAttacker, persistent], [halfling, focus], [halfling, uncanny]]) if (it) await unlend(actor, it);
        CONFIG.Dice.randomUniform = realPRNG;
        clearTargets();
      }
    }

    // ---- 38. Vitality of the Tree: Vitality Surge at the Rage; Life-Giving Force at a raging turn start
    if (want(38)) {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);
      hgKeep(pcAttacker, { 'system.attributes.hp.temp': pcAttacker.system._source.attributes.hp.temp ?? 0 });
      hgKeep(cleric, { 'system.attributes.hp.temp': cleric.system._source.attributes.hp.temp ?? 0 });
      hgKeep(halfling, { 'system.attributes.hp.temp': halfling.system._source.attributes.hp.temp ?? 0 });
      const rage = await hgLend(pcAttacker, 'Rage', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const vitality = await hgLend(pcAttacker, 'Vitality of the Tree', 'feat');
      if (vitality) { await pinHeal(vitality, 'Vitality Surge', '7'); await pinHeal(vitality, 'Life-Giving Force', '2d6'); }
      const temp = actor => Number(actor.system.attributes.hp.temp ?? 0);
      const songs = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'restSong')?.table === 'turn')
        && (m.getFlag(MOD, 'restSong')?.actorUuid === pcAttacker.uuid));
      let combat = null;
      try {
        if (!rage || !vitality) log.push(`§38 skipped: rage=${!!rage} vitality=${!!vitality}`);
        else {
          for (const a of [pcAttacker, cleric, halfling]) await a.update({ 'system.attributes.hp.temp': 0 });
          // a. the Rage used: Vitality Surge's 7 temp HP, a card
          const since = Date.now();
          await useFeature(pcToken, rage);
          const surge = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= since) && (m.getFlag(MOD, 'turnGrant')?.key === 'Vitality Surge')) ?? null, 6000);
          await waitFor(() => temp(pcAttacker) === 7, 4000);
          ok('38a. the Rage used: "Vitality Surge — BF Test PC Attacker gains 7 Temporary Hit Points", temp 7',
            !!surge && (temp(pcAttacker) === 7) && /Vitality Surge — .+ gains 7 Temporary Hit Points/.test(cardText(surge?.id)),
            `card=${cardText(surge?.id).slice(0, 160)} temp=${temp(pcAttacker)}`);
          // b. a raging turn start: the gift is asked — one creature within 10 ft; OK gives it
          await waitFor(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, 6000);
          [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          created.combats.push(combat.id);
          faces([[3, 6], [4, 6]]);
          await combat.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
            { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
          await combat.startCombat();
          const ask = await waitFor(() => songs()[0] ?? null, 8000);
          CONFIG.Dice.randomUniform = realPRNG;
          const flag = ask?.getFlag(MOD, 'restSong');
          const pop = await waitFor(() => titled(/^Life-Giving Force — /), 6000);
          const names = (flag?.candidates ?? []).map(c => c.name);
          ok('38b. the raging turn start asks "Who gets 7 Temporary Hit Points?" — creatures on its side within 10 ft, never itself or the enemy',
            !!pop && (flag?.amount === 7) && (flag?.cap === 1) && /Who gets 7 Temporary Hit Points\?/.test(textOf(pop?.element))
              && names.length > 0 && !names.includes(pcToken.document.name) && !names.includes(victimToken.document.name),
            `amount=${flag?.amount} cap=${flag?.cap} candidates=${JSON.stringify(names)} popup=${!!pop}`);
          const picked = pop?.element?.querySelector('input[name="bf-rest-song"]:checked')?.value ?? null;
          pop?.element?.querySelector('button[data-action="ok"]')?.click();
          const landed = await waitFor(() => ask?.getFlag(MOD, 'restSong')?.applied ? ask : null, 8000);
          const target = picked ? fromUuidSync(picked) : null;
          ok('38c. OK: the one ticked creature gains the 7 temp HP; the card names it', !!landed && !!target && (temp(target) === 7)
            && (landed.getFlag(MOD, 'restSong')?.given ?? []).length === 1,
            `picked=${target?.name ?? null} temp=${target ? temp(target) : null} given=${JSON.stringify(landed?.getFlag(MOD, 'restSong')?.given ?? null)}`);
          // c. the Rage ended: the next turn start asks nothing
          const asked = songs().length;
          await dropFx(pcAttacker, RAGE_FX);
          await combat.nextTurn(); await sleep(300);
          await combat.nextTurn();
          await sleep(2000);
          ok('38d. not raging: the turn start asks nothing', songs().length === asked, `asks=${songs().length} before=${asked}`);
        }
      } finally {
        await closeA1();
        await hgClose(/^Life-Giving Force — /);
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await dropFx(pcAttacker, RAGE_FX);
        for (const it of [rage, vitality]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG;
        clearTargets();
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'classes', out, plan, f });
