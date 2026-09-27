/**
 * Battle Flow — Use chips: a feature the pack ships as TEXT ONLY becomes a chip on use, so the gate can read it and the roll can spend it.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, statContext, queueFlagWrite } from "./core.js";
import { lower, featureNamed, activityNamed, resolveUuid } from "./lookup.js";
import { effectEntries, cardChipEntries, fightingStyleEntries, listedNames } from "./settings.js";
import { chipData, placeOf, hitTargets, withTargets } from "./shared.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { USE_CHIPS, CARD_CHIPS, COATINGS, tableIndex } from "./decide/registry.js";
import { CHIP_FLAG, chipClock, cardChipRowKey, chipsLeft, coatSaveAbility, dosesLeft } from "./decide/chips.js";
import { tokenForUuid } from "./geometry.js";
import { attackMessageForDamage } from "./auto-damage.js";
import { momentButton, openMomentPopup } from "./ui.js";
import { SURFACES } from "./surfaces.js";

/* ---------------------------------------------------------------------------------------------
 * USE CHIPS (user report 2026-09-02: "i added steady aim, which isnt appling, and should then
 * also trigger advantage for the rogue"). The 2024 PHB's Steady Aim is a utility activity —
 * instantaneous, self, NO effect — so there is nothing for any apply path to land: the feature's
 * whole consequence lives in its text. This machine turns the USE into a chip (USE_CHIPS, one
 * row per such feature): an ActiveEffect on the actor, named as the feature is, carrying the
 * rule in its description and the window the rules give it (Steady Aim: the current turn — the
 * Vex clock's shape against the attacker's own place), plus what the text changes on the sheet
 * (Speed 0 until the end of the turn). From there nothing is new: the effect table (EFFECT_BENDS)
 * has a row by that name, so the GATE reads it as Advantage and the ROLL spends it with a receipt
 * (mastery.js `spendChips`, the `spend: "attack"` shape). Membership is the Effect Sources list,
 * as for every effect row.
 *
 * WHERE IT RUNS: on the client that used the feature — `postUseActivity` fires there, and that
 * client owns the actor. Idempotent per usage card: a chip that stands is refreshed, never doubled.
 * ------------------------------------------------------------------------------------------- */

const USE_CHIP_INDEX = tableIndex(USE_CHIPS);

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    if ( !setting(S.riders) && !setting(S.masteryRiders) && !setting(S.effectRiders) ) { /* no feature switch of its own: the Effect Sources list is the switch */ }
    const item = activity?.item;
    const actor = activity?.actor;
    if ( !item || !actor?.isOwner ) return;
    const key = USE_CHIP_INDEX.keyNamed(item.name);
    if ( !key ) return;
    const listed = listedNames(effectEntries());
    if ( !listed.has(lower(key)) ) return;   // the list is the switch — as for every effect row
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    void writeUseChip(actor, item, USE_CHIPS[key], message);
  } catch(err) {
    console.error(`${TITLE} | Use chip failed — apply the feature by hand.`, err);
  }
});

async function writeUseChip(actor, item, row, message) {
  const stale = actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (lower(e.name) === lower(item.name)));
  if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
  const clock = chipClock(row.window, placeOf(actor));
  const effect = await ActiveEffect.implementation.create({
    name: item.name, img: item.img ?? "icons/svg/aura.svg",
    description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${item.name} was used; the next attack roll spends it.</p>`,
    origin: item.uuid, disabled: false, transfer: false,
    // A COPY: the registry row is frozen, and the document migration writes into its changes
    // (measured: "Cannot add property type, object is not extensible" refused the whole create).
    changes: (row.changes ?? []).map(c => ({ ...c })),
    ...(clock ? chipData(clock) : {}),
    flags: { [MODULE_ID]: { [CHIP_FLAG]: "use", useKey: row.key } }
  }, { parent: actor });
  // The card says it (R5): the chip stands, what it does, and what spends it.
  if ( message ) {
    await message.setFlag(MODULE_ID, "useChip", { ...statContext(actor.uuid), effectId: effect?.id ?? null, name: item.name, rule: row.rule, bend: row.bend, note: row.note ?? null })
      .catch(() => { /* the chip stands; only the card line is lost */ });
  }
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const u = message.getFlag(MODULE_ID, "useChip");
  if ( !u ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: "Use chip", tone: "good",
    title: `${u.name} — ${u.bend === "advantage" ? "Advantage" : "Disadvantage"} on the next attack roll`,
    subtitle: u.note ?? "spent by the roll",
    lines: [ruleLine(u.rule)]
  });
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});

/* ---------------------------------------------------------------------------------------------
 * CARD CHIPS (user, 2026-09-25, the Gnome walk: "for gnome tinker, just make it a buff on the char
 * that lasts for the duration"; ruled: offered at the Prestidigitation cast; "yea just give a buff
 * called tiny clockwork device ... the rest is played at table"; then "id like a popup to create
 * the clockwork with x/3 remaining ... if a person has 3 already, do a popup saying to remove a
 * clockwork first"). The table is decide/registry.js CARD_CHIPS; membership is the Card Chips
 * list. Tinker has NO activity — its use is ten minutes of Prestidigitation — so the cast asks: a
 * popup on the caster's client, the build or not, with what is left of the three. Nothing is
 * written without the answer (a plain Prestidigitation makes no device — R1, the caster's choice).
 * Every device is its OWN chip (`stacks` — the twin-chip dedupe in effect-riders.js leaves a
 * deliberate stack alone); at the row's max the popup says to remove one first, and builds none.
 * The card carries the offer too, a recall for the popup, and says what was built (R5).
 *
 * WHERE IT RUNS: the offer is stamped and asked on the casting client (it authored the card and
 * owns the caster); a recall asks whoever presses it, if they own the caster.
 * ------------------------------------------------------------------------------------------- */

const CARD_FLAG = "cardChip";

/** The chips of a row standing on an actor — every device, one chip each. */
const devicesOf = (actor, row) => actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "card")
  && (lower(e.name) === lower(row.chip)));

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const item = activity?.item;
    const actor = activity?.actor;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !item || !actor?.isOwner || !message ) return;
    const key = cardChipRowKey(CARD_CHIPS, { itemName: item.name, featureNames: actor.items.map(i => i.name) },
      listedNames(cardChipEntries()));
    if ( !key ) return;
    void message.setFlag(MODULE_ID, CARD_FLAG, { ...statContext(actor.uuid), key, chip: CARD_CHIPS[key].chip, made: false })
      .then(() => askCardChip(message))
      .catch(err => console.error(`${TITLE} | Could not offer ${key}.`, err));
  } catch(err) {
    console.error(`${TITLE} | Card chip offer failed — keep the feature by hand.`, err);
  }
});

/** The popup: build one, with what is left — or, at the max, remove one first. */
async function askCardChip(message) {
  const flag = message.getFlag(MODULE_ID, CARD_FLAG);
  const row = CARD_CHIPS[flag?.key];
  if ( !row || flag.made ) return;
  // live only: the caster whose sheet the chip lands on
  const actor = fromUuidSync(flag.sourceUuid ?? "");
  if ( !(actor instanceof Actor) || !actor.isOwner ) return;
  const left = chipsLeft(devicesOf(actor, row).length, row.max);
  const esc = foundry.utils.escapeHTML;
  const title = `${flag.key} — ${row.chip}`;
  const icon = "fa-solid fa-gears";
  // The choice comes FIRST, whatever stands (user, 2026-09-25: "the too many devices should be
  // gated behind the choice ... if they dont build it and just cast prestitigation normal, theres
  // no error") — the max is only told to someone who chose to build.
  await openMomentPopup(message, "cardChip", actor, { title, icon, gate: false,
    content: `<p>Build a <strong>${esc(row.chip)}</strong>? <strong>${left} of ${row.max}</strong> remaining.</p><p style="opacity:0.75;">It falls apart after 8 hours; what it does is played at the table.</p>`,
    buttons: [
      { action: "build", label: "Build it", icon: "fa-solid fa-gear", default: true, callback: () => void buildCardChip(message)
        .catch(err => console.error(`${TITLE} | Could not build the ${row.chip}.`, err)) },
      { action: "skip", label: "Not now" }
    ] });
}

/** Build one device: its own chip, refused at the row's max; the card stamped with what stands. */
async function buildCardChip(message) {
  const flag = message.getFlag(MODULE_ID, CARD_FLAG);
  const row = CARD_CHIPS[flag?.key];
  if ( !row || flag.made ) return;
  const actor = await fromUuid(flag.sourceUuid ?? "");
  if ( !(actor instanceof Actor) || !actor.isOwner ) return;
  const standing = devicesOf(actor, row).length;
  if ( !chipsLeft(standing, row.max) ) {
    // Chosen to build with none left: say so in a popup of its own (the ask's key is still closing).
    const esc = foundry.utils.escapeHTML;
    await openMomentPopup(message, "cardChipFull", actor, { title: `${flag.key} — ${row.chip}`, icon: "fa-solid fa-gears", gate: false,
      content: `<p><strong>${esc(actor.name)} already has ${row.max} of ${row.max}.</strong> Remove a ${esc(row.chip)} first — delete its buff on the sheet — then build again from the card.</p>`,
      buttons: [{ action: "ok", label: "OK", default: true }] });
    return;
  }
  const feature = actor.items.find(i => lower(i.name) === lower(row.feature)) ?? null;
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: row.chip, img: feature?.img ?? "icons/svg/aura.svg",
    description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${flag.key} was chosen at the Prestidigitation cast; what the device does is the table's.</p>`,
    origin: feature?.uuid ?? null, disabled: false, transfer: false,
    duration: { value: row.seconds, units: "seconds", expired: false }, start: { time: game.time.worldTime },
    flags: { [MODULE_ID]: { [CHIP_FLAG]: "card", cardKey: flag.key, stacks: true } }
  }]);
  if ( message.canUserModify?.(game.user, "update") ) {
    await message.setFlag(MODULE_ID, CARD_FLAG, { ...flag, made: true, effectId: effect?.id ?? null, standing: standing + (effect ? 1 : 0) })
      .catch(() => { /* the chip stands; only the card line is lost */ });
  }
}

// The card says it (R5): the offer while it waits — its button recalls the popup — and what was built.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, CARD_FLAG);
  const row = f ? CARD_CHIPS[f.key] : null;
  if ( !row ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: f.key, tone: f.made ? "good" : "neutral",
    title: f.made ? `${row.chip} built — ${f.standing ?? 1} of ${row.max} standing` : row.ask,
    subtitle: f.made ? "each falls apart after 8 hours; what it does is played at the table"
      : `at most ${row.max} at a time; each falls apart after 8 hours`,
    lines: [ruleLine(row.rule)]
  });
  const content = html.querySelector(SURFACES.messageContent);
  content?.appendChild(line);
  if ( !f.made ) {
    // live only: the offer is its caster's to take — another client sees the line, not the button
    const actor = fromUuidSync(f.sourceUuid ?? "");
    if ( actor?.isOwner ) content?.appendChild(momentButton(`Build a ${row.chip}…`, () => void askCardChip(message)));
  }
});

/* ---------------------------------------------------------------------------------------------
 * THE COATINGS (the user, 2026-09-26, the PHB feats walk — a rule of cool, RULINGS *Bent by
 * choice*: "when Apply Poison is clicked, it puts a poison buff (self only) on the actor. dont make
 * the separate card or whatever it is they want player to do. player then gets poisoner buff for
 * the minute or until they hit something, then its removed. make clear its a bonus action"; and
 * "have it do the name of effect/floating text buff"). The table is decide/registry.js COATINGS;
 * a row answers to its `list` (the Poisoner: the Fighting Styles list's own entry for the feat).
 *
 *   THE USE (`dnd5e.preUseActivity`, the using client) — the pack's Apply Poison is an enchantment
 *   whose card asks for a weapon dropped on it; the use is VETOED and becomes a chip on the ACTOR
 *   instead: "Poison Coating", a minute of world time, a dose of the feature's uses spent (none
 *   left: a warning, nothing written). The table sees a card of its own — the Bonus Action said —
 *   and a float over the token, "+(Poison Coating)", as core floats every other effect.
 *   THE HIT (`dnd5e.preRollDamageV2` stamps the damage of a WEAPON attack while the chip stands;
 *   the author spends it once the damage lands and the hold is off) — the chip goes ("−(Poison
 *   Coating)"), and the feature's own save activity is used at the creatures the attack hit, so
 *   the Constitution save, the 2d8 on a failure and the card are the saves machine's; the Poisoned
 *   it only names is SAVE_PRESSES' "Poisoner" row, until the end of the Poisoner's next turn. A
 *   miss spends nothing — the rule spends the poison when the item deals damage.
 * ------------------------------------------------------------------------------------------- */

const COAT_FLAG = "coat";          // on the chip: which row
const COAT_USE = "coatUse";        // on the card the use posts
const COAT_HIT = "coatHit";        // on the damage message that spends the chip

/** The listed-names readers a row's `list` may name. */
const COAT_LISTS = { fightingStyles: fightingStyleEntries };

/** The row whose vetoed activity this is, on a listed feature — `{ name, row }` or null. */
function coatRowFor(activity) {
  const item = activity?.item;
  for ( const [name, row] of Object.entries(COATINGS) ) {
    if ( (lower(item?.name) !== lower(name)) || (lower(activity?.name) !== lower(row.activity)) ) continue;
    if ( !listedNames(COAT_LISTS[row.list]?.() ?? []).has(lower(name)) ) continue;
    return { name, row };
  }
  return null;
}

/** The coating chip standing on an actor, or null. */
const coatChipOf = actor => actor?.effects?.find?.(e => !!e.getFlag(MODULE_ID, COAT_FLAG) && !e.disabled) ?? null;

/** A row by its `key` — `{ name, row }` or null. */
function coatRowKeyed(key) {
  const name = Object.keys(COATINGS).find(n => COATINGS[n].key === key);
  return name ? { name, row: COATINGS[name] } : null;
}

Hooks.on("dnd5e.preUseActivity", activity => {
  try {
    const found = coatRowFor(activity);
    const actor = activity?.actor;
    if ( !found || !actor?.isOwner ) return;
    void writeCoat(actor, activity, found.name, found.row)
      .catch(err => console.error(`${TITLE} | ${found.row.chip} could not be written — track it by hand.`, err));
    return false;   // the pack's enchantment card is not drawn: the chip on the actor IS the use
  } catch(err) {
    console.error(`${TITLE} | A coating's use failed — use the feature by hand.`, err);
  }
});

async function writeCoat(actor, activity, name, row) {
  const feature = activity.item;
  const uses = feature.system?.uses ?? {};
  const left = Number.isFinite(Number(uses.value)) ? Math.max(0, Number(uses.value)) : dosesLeft({ max: uses.max, spent: uses.spent });
  if ( left < row.dose ) {
    ui.notifications.warn(`${actor.name} has no poison doses left — make more first (${name}: Create Poison Doses).`);
    return;
  }
  await feature.update({ "system.uses.spent": (Number(uses.spent) || 0) + row.dose });
  const stale = actor.effects.filter(e => !!e.getFlag(MODULE_ID, COAT_FLAG));
  if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
  const place = placeOf(actor);
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: row.chip, img: activity.img || feature.img || "icons/svg/poison.svg",
    description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${name}'s ${row.activity} was used (a Bonus Action): the next weapon hit spends it.</p>`,
    origin: feature.uuid, disabled: false, transfer: false,
    duration: { value: row.seconds, units: "seconds", expired: false },
    start: place ? { combat: place.combat, combatant: place.combatant, initiative: place.initiative, round: place.round, turn: place.turn, time: place.time }
      : { time: game.time.worldTime },
    flags: { [MODULE_ID]: { [CHIP_FLAG]: "use", [COAT_FLAG]: row.key } }
  }]);
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: "",
    flags: { [MODULE_ID]: { [COAT_USE]: { ...statContext(actor.uuid), key: row.key, feature: name, chip: row.chip,
      effectId: effect?.id ?? null, left: left - row.dose, img: effect?.img ?? null } } }
  });
}

// The card says it (R5): the Bonus Action, what the chip does, the doses left.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const u = message.getFlag(MODULE_ID, COAT_USE);
  const found = u ? coatRowKeyed(u.key) : null;
  if ( !found ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    img: u.img ?? null, eyebrow: `${u.feature} — ${found.row.activity} · Bonus Action`, tone: "good",
    title: `${u.chip} — the next weapon hit poisons`,
    subtitle: `1 minute, or until it deals damage · ${u.left} dose${u.left === 1 ? "" : "s"} left`,
    lines: [ruleLine(found.row.rule)]
  });
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});

// The float, every client: "+(Poison Coating)" as it lands, "−(Poison Coating)" as it goes — core
// floats only an effect with changes, and the chip has none (fighting-styles.js, the same idiom).
const floatCoat = (effect, on) => {
  try {
    const actor = effect.parent;
    if ( !effect.getFlag(MODULE_ID, COAT_FLAG) || !(actor instanceof Actor) || !canvas?.interface?.createScrollingText ) return;
    for ( const token of actor.getActiveTokens(true) ) {
      if ( !token.visible || token.document.isSecret ) continue;
      canvas.interface.createScrollingText(token.center, `${on ? "+" : "−"}(${effect.name})`, {
        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
        direction: on ? CONST.TEXT_ANCHOR_POINTS.TOP : CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        distance: 2 * token.h, fontSize: 28, stroke: 0x000000, strokeThickness: 4, jitter: 0.25
      });
    }
  } catch(err) { console.warn(`${TITLE} | The coating's float could not draw.`, err); }
};
Hooks.on("createActiveEffect", effect => floatCoat(effect, true));
Hooks.on("deleteActiveEffect", effect => floatCoat(effect, false));

/* --- the hit: a weapon's damage while the chip stands ------------------------------------------ */

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    const activity = config?.subject;
    if ( (activity?.type !== "attack") || (activity.item?.type !== "weapon") ) return;
    const attacker = activity.actor;
    const chip = coatChipOf(attacker);
    if ( !chip ) return;
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${COAT_HIT}`, {
      ...statContext(attacker.uuid), status: "due", key: chip.getFlag(MODULE_ID, COAT_FLAG), chipId: chip.id, attackId: attackMessage.id
    });
  } catch(err) {
    console.error(`${TITLE} | The coating could not ride the hit — use the feature's save by hand.`, err);
  }
});

Hooks.on("createChatMessage", message => {
  if ( message.isAuthor && (message.getFlag(MODULE_ID, COAT_HIT)?.status === "due") ) void spendCoat(message);
});
// The hold's release (hold/continue.js writes `attackHoldPending: false`) brings a held hit back.
Hooks.on("updateChatMessage", message => {
  if ( message.isAuthor && (message.getFlag(MODULE_ID, COAT_HIT)?.status === "due") ) void spendCoat(message);
});

const spending = new Set();

async function spendCoat(message) {
  const f = message.getFlag(MODULE_ID, COAT_HIT);
  if ( (f?.status !== "due") || spending.has(message.id) ) return;
  if ( message.getFlag(MODULE_ID, "attackHoldPending") === true ) return;   // its release brings this back
  spending.add(message.id);
  try {
    const found = coatRowKeyed(f.key);
    const attackMessage = game.messages.get(f.attackId);
    const attacker = resolveUuid(f.sourceUuid ?? null) ?? attackMessage?.getAssociatedActor?.() ?? null;
    const hits = attackMessage ? hitTargets(attackMessage) : [];
    // A miss deals no damage: the coating stands for the next swing.
    const spent = !!found && !!attacker && (hits.length > 0);
    const feature = spent ? featureNamed(attacker, found.name) : null;
    const offered = spent ? Object.keys(found.row.saves) : [];
    const ability = spent ? coatSaveAbility({ offered, assigned: asiAssigned(feature),
      mods: Object.fromEntries(offered.map(a => [a, attacker.system?.abilities?.[a]?.mod ?? 0])) }) : null;
    const act = (feature && ability) ? activityNamed(feature, found.row.saves[ability]) : null;
    let claimed = false;
    await queueFlagWrite(message, COAT_HIT, current => {
      if ( current.status !== "due" ) return false;
      current.status = spent ? "spent" : "moot";
      if ( spent ) {
        current.ability = ability;
        current.targets = hits.map(t => ({ uuid: t.uuid, name: t.name }));
        if ( !act ) current.note = `${found.name}: no "${found.row.saves[ability] ?? "save"}" activity on the sheet — roll the save by hand`;
      }
      claimed = true;
    });
    if ( !claimed || !spent ) return;
    const chip = attacker.effects.get(f.chipId) ?? coatChipOf(attacker);
    if ( chip ) await chip.delete();
    if ( !act ) return;
    const tokens = hits.map(t => tokenForUuid(t.uuid)).filter(Boolean);
    const results = await withTargets(tokens, () => act.use({ consume: false }, { configure: false }, {}));
    const card = results?.message;
    if ( card instanceof ChatMessage ) await queueFlagWrite(message, COAT_HIT, current => { current.saveId = card.id; });
  } catch(err) {
    console.error(`${TITLE} | The coating's save failed — use the feature's save by hand.`, err);
  } finally {
    spending.delete(message.id);
  }
}

/** The abilities a feat's own Ability Score Improvement assigned (dnd5e's record on the item), or null. */
function asiAssigned(feature) {
  try {
    const advancements = feature?.advancement?.byId ? Object.values(feature.advancement.byId)
      : Object.values(feature?.system?.advancement ?? {});
    const asi = advancements.find(a => a?.type === "AbilityScoreImprovement");
    const assignments = asi?.value?.assignments ?? {};
    const keys = Object.entries(assignments).filter(([, v]) => Number(v) > 0).map(([k]) => k);
    return keys.length ? keys : null;
  } catch { return null; }
}

// The damage card says it (R5): the coating spent on the hit, and who saves.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, COAT_HIT);
  const found = (f?.status === "spent") ? coatRowKeyed(f.key) : null;
  if ( !found ) return;
  const who = (f.targets ?? []).map(t => esc(t.name ?? "")).join(", ");
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: found.name, tone: "good",
    title: `${found.row.chip} spent on the hit`,
    subtitle: f.note ?? `a Constitution save for ${who} — on a failure, 2d8 Poison and Poisoned until the end of your next turn`
  });
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});
