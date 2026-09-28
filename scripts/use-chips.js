/**
 * Battle Flow — Use chips: a feature the pack ships as TEXT ONLY becomes a chip on use, so the gate
 * can read it and the roll can spend it; plus the card chips (Tinker) and the coatings (Poisoner).
 * EDGE layer (ARCHITECTURE.md §7).
 */
import { MODULE_ID, TITLE, statContext, queueFlagWrite } from "./core.js";
import { ruleHTML } from "./rule-text.js";
import { lower, featureNamed, itemNamed, namesAnswering, activityNamed, asiAssigned, resolveUuid } from "./lookup.js";
import { effectEntries, cardChipEntries, fightingStyleEntries, listedNames } from "./decide/registry.js";
import { chipData, placeOf, hitTargets, withTargets } from "./shared.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { USE_CHIPS, CARD_CHIPS, COATINGS, answers, tableIndex } from "./decide/registry.js";
import { CHIP_FLAG, chipClock, cardChipRowKey, chipsLeft, coatSaveAbility, dosesLeft } from "./decide/chips.js";
import { tokenForUuid } from "./geometry.js";
import { attackMessageForDamage } from "./auto-damage.js";
import { momentButton, openMomentPopup } from "./ui.js";
import { SURFACES } from "./surfaces.js";

/* USE CHIPS (USE_CHIPS): a utility activity with NO effect becomes, on use, a chip named as the
 * feature, which the effect table's row lets the gate read and the roll spend. On the using client;
 * refreshed, never doubled. */

const USE_CHIP_INDEX = tableIndex(USE_CHIPS);

Hooks.on("dnd5e.postUseActivity", (activity, _usageConfig, results) => {
  try {
    const item = activity?.item;
    const actor = activity?.actor;
    if ( !item || !actor?.isOwner ) return;
    const key = USE_CHIP_INDEX.keyFor(item);
    if ( !key ) return;
    const listed = listedNames(effectEntries());
    if ( !listed.has(lower(key)) ) return;
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
    description: `${await ruleHTML(row.rule)}<p>Written by Battle Flow when ${item.name} was used; the next attack roll spends it.</p>`,
    origin: item.uuid, disabled: false, transfer: false,
    // ⚠ A COPY: the registry row is frozen and the document migration writes into its changes.
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

/* CARD CHIPS (CARD_CHIPS): a feature with NO activity is asked in a popup on the triggering cast;
 * nothing is written without the answer. Each device is its OWN chip (`stacks`), capped at the row's max. */

const CARD_FLAG = "cardChip";

/** The names the card-chip rows read a use and a sheet in: the items they ride, and the features they need. */
const CARD_CHIP_ONS = [...new Set(Object.values(CARD_CHIPS).map(r => r.on))];
const CARD_CHIP_FEATURES = [...new Set(Object.values(CARD_CHIPS).map(r => r.feature))];

/** The chips of a row standing on an actor — every device, one chip each. */
const devicesOf = (actor, row) => actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "card")
  && (lower(e.name) === lower(row.chip)));

Hooks.on("dnd5e.postUseActivity", (activity, _usageConfig, results) => {
  try {
    const item = activity?.item;
    const actor = activity?.actor;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !item || !actor?.isOwner || !message ) return;
    const key = cardChipRowKey(CARD_CHIPS, { itemName: namesAnswering([item], CARD_CHIP_ONS)[0],
      featureNames: namesAnswering(actor.items, CARD_CHIP_FEATURES) },
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
  // The choice comes FIRST: the max is only told to someone who chose to build.
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
  const feature = itemNamed(actor, row.feature);
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: row.chip, img: feature?.img ?? "icons/svg/aura.svg",
    description: `${await ruleHTML(row.rule)}<p>Written by Battle Flow when ${flag.key} was chosen at the Prestidigitation cast; what the device does is the table's.</p>`,
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

/* THE COATINGS (COATINGS; RULINGS *Bent by choice — the rule of cool*). THE USE: the pack's
 * enchantment is VETOED and becomes a chip on the ACTOR, a dose spent. THE HIT: a weapon's landed
 * damage spends the chip and uses the feature's save activity at the creatures hit; a miss spends nothing. */

const COAT_FLAG = "coat";          // on the chip: which row
const COAT_USE = "coatUse";        // on the card the use posts
const COAT_HIT = "coatHit";        // on the damage message that spends the chip

/** The listed-names readers a row's `list` may name. */
const COAT_LISTS = { fightingStyles: fightingStyleEntries };

/** The row whose vetoed activity this is, on a listed feature — `{ name, row }` or null. */
function coatRowFor(activity) {
  const item = activity?.item;
  for ( const [name, row] of Object.entries(COATINGS) ) {
    if ( !answers(name, item) || (lower(activity?.name) !== lower(row.activity)) ) continue;
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
    name: row.chip, img: row.img || feature.img || "icons/svg/aura.svg",
    description: `${await ruleHTML(row.rule)}<p>Written by Battle Flow when ${name}'s ${row.activity} was used (a Bonus Action): the next weapon hit spends it.</p>`,
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

// The float on every client: core floats only an effect with changes, and the chip has none.
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
// The hold's release (`attackHoldPending: false`) brings a held hit back.
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
    // ⚠ THE SAVE IS A RIDER, and dnd5e hides a rider on its source item (Activity#isHidden): it runs
    // from an in-memory copy of the feat with `riders.activity` emptied; nothing written.
    const source = feature ? feature.clone({ "flags.dnd5e.riders.activity": [] }, { keepId: true }) : null;
    const act = (source && ability) ? activityNamed(source, found.row.saves[ability]) : null;
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

// The damage card says it (R5): the coating spent on the hit, and who saves.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, COAT_HIT);
  const found = (f?.status === "spent") ? coatRowKeyed(f.key) : null;
  if ( !found ) return;
  const who = (f.targets ?? []).map(t => t.name ?? "").join(", ");   // bfCard escapes its subtitle (4a3cbd5)
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: found.name, tone: "good",
    title: `${found.row.chip} spent on the hit`,
    subtitle: f.note ?? `a Constitution save for ${who} — on a failure, 2d8 Poison and Poisoned until the end of your next turn`
  });
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});
