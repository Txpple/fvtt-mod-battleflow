/**
 * Battle Flow — combat resolution that flows (design.md is the north star).
 *
 * Phase 1: the attack resolver. Two independent halves plus receipts, each behind its own
 * world setting (Game Settings → Configure Settings → Battle Flow), all default OFF:
 *
 *   - Auto-Roll Damage on Hit: when an attack roll resolves on the attacker's own client,
 *     re-run the system's hit test against the targets snapshotted on the attack message and,
 *     if at least one target was hit, press the card's Damage button programmatically —
 *     ammo/attack-mode recovery identical to the native handler, crit pre-configured, no
 *     dialog. A miss means the damage dice never exist. Modes: off / NPC attacks only /
 *     everyone, plus an optional "dramatic beat" delay between hit reveal and damage dice.
 *   - Auto-Apply Damage: on the active GM's client (single writer), a damage-roll message
 *     that chains back to an attack applies itself to the targets that attack hit, through
 *     the system's own resistance/immunity/threshold math (Actor5e#applyDamage) — exactly
 *     what the GM-only damage tray does, pressed automatically. The tray stays rendered and
 *     remains the manual path for corrections and edge calls.
 *   - Receipts + revert: every application stamps what it did (per-target prior HP snapshot
 *     and deltas) into a flag on the damage message, and the card grows a GM-only receipt
 *     row with a per-target ↩ revert that restores the snapshot. Idempotent and
 *     reload-proof: the flag is the state, the row is just a view of it.
 *
 * Architecture (design.md §4): the chat log is the state and the bus. No sockets, no
 * in-memory workflow object, no patching. The attacker's client volunteers the damage roll
 * (its attack, its dice); the active-GM elect volunteers the application (ownership is a
 * permission fact; a single writer prevents double-apply); the chain is resolved through the
 * system's own message registry (flags.dnd5e.originatingMessage), never a parallel one.
 *
 * Ground truths (dnd5e release-5.3.3 = commit 965ad2d, on Foundry v14):
 *   - dnd5e.rollAttackV2 fires on the rolling client only, after the attack message exists
 *     and before ammo consumption; rolls[0].parent IS the attack message (basic-roll.mjs
 *     buildPost assigns it whenever a message document was created).
 *   - Hit/miss is computed at render time and never persisted (chat-message.mjs:463):
 *     isMiss = !crit && ((total < ac) || fumble). Downstream consumers must recompute.
 *   - flags.dnd5e.targets = [{uuid, name, img, ac}] where uuid is the target ACTOR's uuid
 *     (utils.mjs getTargetDescriptors) and ac is null under total cover.
 *   - flags.dnd5e.originatingMessage is natively stamped from the DOM click's enclosing card
 *     (basic-roll.mjs:173); a programmatic roll MUST pass it in message data explicitly or
 *     the roll never enters dnd5e.registry.messages and the chain breaks.
 *   - The native damage tray builds damages via aggregateDamageRolls(rolls,
 *     {respectProperties: true}) → {value, type, properties: Set} and applies with
 *     actor.applyDamage(damages, {multiplier: 1, isDelta: true, originatingMessage, origin})
 *     (damage-application.mjs:335). Mirrored verbatim so the system's math stays
 *     authoritative. Healing activities mark their rolls "healing", never "damage".
 *   - applyDamage writes system.attributes.hp.{value,temp,tempmax}. Receipts snapshot the
 *     SOURCE values (actor.system._source): Actor#update writes source data, and derived
 *     values can carry active-effect noise that a later revert must not bake in.
 *   - dnd5e.renderChatMessage (message, html) fires after all system card enrichment — the
 *     seam the receipt row renders on.
 */

const MODULE_ID = "fvtt-mod-battleflow";
const TITLE = "Battle Flow";

/** Setting keys. */
const S = {
  autoDamage: "autoDamage",
  dramaticBeat: "dramaticBeat",
  autoApply: "autoApply"
};

const setting = key => game.settings.get(MODULE_ID, key);

/** Exactly one client may perform world-visible applications: the active GM's. */
const isActiveGM = () => game.users.activeGM?.isSelf ?? false;

/* ---------------------------------------------------------------------------------------------
 * Settings registration
 * ------------------------------------------------------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, S.autoDamage, {
    name: "Auto-Roll Damage on Hit",
    hint: "When an attack hits at least one of its selected targets, the damage rolls itself on the attacker's own client — no dialog, crit pre-applied. A miss rolls nothing. Attacks must be made with targets selected.",
    scope: "world", config: true, type: String, default: "off",
    choices: { off: "Off", npc: "NPC Attacks Only", all: "Everyone" }
  });

  game.settings.register(MODULE_ID, S.dramaticBeat, {
    name: "Dramatic Beat Before Damage",
    hint: "Seconds between the hit reveal and the damage dice hitting the table. 0 rolls immediately.",
    scope: "world", config: true, type: Number, default: 0,
    range: { min: 0, max: 10, step: 0.5 }
  });

  game.settings.register(MODULE_ID, S.autoApply, {
    name: "Auto-Apply Damage",
    hint: "The active GM's client applies a rolled attack's damage to the targets that attack hit, through the system's own resistance and immunity math. Every application leaves a receipt on the damage card with a per-target revert. The native damage tray stays available for manual calls.",
    scope: "world", config: true, type: Boolean, default: false
  });
});

// Settings-sheet polish (the combatplus idiom, from day one): a divider heading the module's
// block, and dependent fields greying out live while their governing setting is off.
Hooks.on("renderSettingsConfig", (app, element) => {
  const el = element instanceof HTMLElement ? element : element?.[0];
  if ( !el ) return;
  const input = key => el.querySelector(`[name="${MODULE_ID}.${key}"]`);
  const setEnabled = (field, enabled) => {
    if ( !field ) return;
    field.disabled = !enabled;
    const group = field.closest(".form-group");
    if ( group ) group.style.opacity = enabled ? "" : "0.4";
  };

  const autoDamage = input(S.autoDamage);
  const group = autoDamage?.closest(".form-group");
  if ( group && !group.previousElementSibling?.classList?.contains("bf-divider") ) {
    const header = document.createElement("h4");
    header.className = "divider bf-divider";
    header.textContent = "Attack Resolver";
    group.before(header);
  }

  const syncAll = () => setEnabled(input(S.dramaticBeat), autoDamage?.value !== "off");
  syncAll();
  autoDamage?.addEventListener("change", syncAll);
});

/* ---------------------------------------------------------------------------------------------
 * Shared: the hit test and the chain walk
 * ------------------------------------------------------------------------------------------- */

/**
 * Targets from an attack message's snapshot that the attack roll actually hit, recomputing
 * the system's own render-time test: crit hits, fumble misses, otherwise total >= ac.
 * A null AC (total cover, or a target with no AC data) is deliberately NOT auto-resolvable:
 * the system's targets tray classes those rows as hits (total < null is false), but the
 * outcome isn't determined by data we trust, so those targets are left to humans
 * (design.md §2.1) and the native tray.
 */
function hitTargets(attackMessage) {
  const roll = attackMessage.rolls[0];
  if ( !(roll instanceof dnd5e.dice.D20Roll) ) return [];
  const targets = attackMessage.getFlag("dnd5e", "targets") ?? [];
  return targets.filter(t =>
    (t.ac !== null) && (t.ac !== undefined)
    && (roll.isCritical || (!roll.isFumble && (roll.total >= t.ac))));
}

/**
 * The attack roll a damage message descends from, walked through the system's registry:
 * damage → originating usage card → associated attack rolls (chronological) → the last one
 * rolled before this damage. When the origin itself IS an attack message (an attack rolled
 * without a usage card; our own programmatic stamp falls back to the attack's id), use it
 * directly. Null when the damage isn't part of an attack chain (save/AoE damage — Phase 2).
 */
function resolveAttackMessage(damageMessage) {
  const origin = damageMessage.getOriginatingMessage(); // falls back to the message itself
  if ( origin === damageMessage ) return null;
  if ( origin.getFlag("dnd5e", "roll.type") === "attack" ) return origin;
  return origin.getAssociatedRolls("attack")
    .filter(m => m.timestamp <= damageMessage.timestamp)
    .pop() ?? null;
}

/* ---------------------------------------------------------------------------------------------
 * Phase 1a — auto-roll damage on hit (the attacker's client; its attack, its dice)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.rollAttackV2", (rolls, { subject }) => {
  const mode = setting(S.autoDamage);
  if ( (mode === "off") || !subject ) return;
  if ( (mode === "npc") && (subject.actor?.type === "character") ) return;

  const attackMessage = rolls[0]?.parent;
  if ( !(attackMessage instanceof ChatMessage) ) return; // rolled with create:false — no chain to ride

  // Mirror the native card: no Damage button (no damage parts, no ammo), nothing to roll.
  if ( !subject.damage?.parts?.length && !subject.item?.system.properties?.has("amm") ) return;

  if ( !hitTargets(attackMessage).length ) return; // a miss means the damage dice never exist

  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  setTimeout(() => rollDamageForAttack(subject, attackMessage), beat);
});

/**
 * Press the Damage button the way AttackActivity.#rollDamage does at 5.3.3: recover attack
 * mode and ammunition from the attack message's flags — including the stored copy of
 * ammunition destroyed by consumption — pre-set critical, skip the dialog. The
 * originatingMessage is stamped explicitly because a programmatic roll has no DOM click to
 * inherit it from; without it the damage message never registers and auto-apply can't chain.
 */
async function rollDamageForAttack(activity, attackMessage) {
  try {
    const attackMode = attackMessage.getFlag("dnd5e", "roll.attackMode");
    let ammunition;
    const actor = attackMessage.getAssociatedActor();
    if ( actor ) {
      const storedData = attackMessage.getFlag("dnd5e", "roll.ammunitionData");
      ammunition = storedData
        ? new Item.implementation(storedData, { parent: actor })
        : actor.items.get(attackMessage.getFlag("dnd5e", "roll.ammunition"));
    }
    const isCritical = attackMessage.rolls[0]?.isCritical ?? false;
    const originId = attackMessage.getFlag("dnd5e", "originatingMessage") ?? attackMessage.id;
    await activity.rollDamage(
      { ammunition, attackMode, isCritical },
      { configure: false },
      { data: { "flags.dnd5e.originatingMessage": originId } }
    );
  } catch(err) {
    console.error(`${TITLE} | Auto-roll damage failed.`, err);
  }
}

/* ---------------------------------------------------------------------------------------------
 * Phase 1b — auto-apply damage to hit targets (the active-GM elect; single writer)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("createChatMessage", message => {
  if ( !setting(S.autoApply) || !isActiveGM() ) return;
  if ( message.getFlag("dnd5e", "roll.type") !== "damage" ) return; // healing is typed "healing"
  const attackMessage = resolveAttackMessage(message);
  if ( !attackMessage ) return;
  const hits = hitTargets(attackMessage);
  if ( hits.length ) void applyToHitTargets(message, hits);
});

/**
 * Apply a damage message's rolls to the given targets exactly as the native tray would, and
 * stamp the receipt. Damages are built with the system's own aggregation; application runs
 * through Actor5e#applyDamage so di/dr/dv, modification, threshold and temp-HP math stay
 * authoritative. The receipt records the pre-application SOURCE hp so a revert restores the
 * exact stored values.
 */
async function applyToHitTargets(damageMessage, hits) {
  try {
    const damages = dnd5e.dice.aggregateDamageRolls(damageMessage.rolls, { respectProperties: true })
      .map(roll => ({
        value: Math.max(0, roll.total),
        type: roll.options.type,
        properties: new Set(roll.options.properties ?? [])
      }));

    const receipts = [];
    for ( const target of hits ) {
      const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
      if ( !(actor instanceof Actor) || !actor.system.attributes?.hp ) continue;
      const src = actor.system._source.attributes.hp;
      const prior = { value: src.value, temp: src.temp, tempmax: src.tempmax };
      await actor.applyDamage(damages, {
        multiplier: 1, isDelta: true, originatingMessage: damageMessage, origin: damageMessage
      });
      const after = actor.system._source.attributes.hp;
      receipts.push({
        uuid: target.uuid,
        name: target.name,
        prior,
        delta: {
          value: (after.value ?? 0) - (prior.value ?? 0),
          temp: (after.temp ?? 0) - (prior.temp ?? 0)
        },
        reverted: false
      });
    }
    if ( receipts.length ) await damageMessage.setFlag(MODULE_ID, "receipt", { targets: receipts });
  } catch(err) {
    console.error(`${TITLE} | Auto-apply failed.`, err);
  }
}

/* ---------------------------------------------------------------------------------------------
 * Receipts — the GM-only revert row on damage cards. The flag is the state; this is a view.
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const receipt = message.getFlag(MODULE_ID, "receipt");
  if ( !receipt?.targets?.length || !game.user.isGM ) return;

  const row = document.createElement("div");
  row.className = "battleflow-receipt";
  Object.assign(row.style, {
    margin: "0.25rem 0 0", padding: "0.25rem 0.5rem",
    border: "1px solid var(--color-border-light-2, #999a)", borderRadius: "4px",
    fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6"
  });

  for ( const t of receipt.targets ) {
    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", alignItems: "center", gap: "0.4rem" });

    const name = document.createElement("span");
    name.textContent = t.name;
    Object.assign(name.style, { flex: "1", fontWeight: "bold" });
    if ( t.reverted ) name.style.textDecoration = "line-through";

    const detail = document.createElement("span");
    const lost = -((t.delta.value ?? 0) + (t.delta.temp ?? 0));
    const from = (t.prior.value ?? 0) + (t.prior.temp ?? 0);
    detail.textContent = t.reverted
      ? "reverted"
      : `−${lost} HP (${from} → ${from - lost})`;
    if ( t.reverted ) detail.style.fontStyle = "italic";

    line.append(name, detail);

    if ( !t.reverted ) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "↩ Revert";
      Object.assign(button.style, {
        flex: "0 0 auto", width: "auto", margin: "0",
        padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4"
      });
      button.addEventListener("click", () => revertTarget(message, t.uuid));
      line.append(button);
    }

    row.append(line);
  }

  html.querySelector(".message-content")?.appendChild(row);
});

/**
 * Restore one receipt target to its pre-application HP snapshot. Idempotent and
 * reload-proof: state is re-read from the message flag at click time, never from the DOM,
 * and the reverted marker is written back to the flag (whose update re-renders the card on
 * every client). Deliberately NOT rewound: rolls, resources, ammo, concentration
 * (design.md §5 Phase 1) — re-applying to the right target is the native tray's job.
 */
async function revertTarget(message, uuid) {
  const receipt = foundry.utils.deepClone(message.getFlag(MODULE_ID, "receipt") ?? {});
  const entry = receipt.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.reverted ) return;

  const actor = await fromUuid(uuid);
  if ( !(actor instanceof Actor) ) {
    ui.notifications.warn(`${TITLE}: that target no longer exists — nothing to revert.`);
    return;
  }

  await actor.update({
    "system.attributes.hp.value": entry.prior.value,
    "system.attributes.hp.temp": entry.prior.temp,
    "system.attributes.hp.tempmax": entry.prior.tempmax
  });

  // Interaction contract with combatplus (design.md §9): a revert that raises the target
  // back above 0 also clears the defeated mark + dead overlay its auto-defeated set at 0.
  // combatplus's own heal-up handler usually beats us to it; this covers the table where
  // that feature is off at revert time, and no-ops when everything is already clean.
  if ( (entry.prior.value ?? 0) > 0 ) await clearDefeated(actor);

  entry.reverted = true;
  await message.setFlag(MODULE_ID, "receipt", receipt);
}

/** Mirror of combatplus's combatant matching (its updateActor handler), run in reverse. */
async function clearDefeated(actor) {
  for ( const combat of game.combats ) {
    for ( const c of combat.combatants ) {
      const match = actor.isToken ? c.tokenId === actor.token.id
        : (c.actorId === actor.id) && (c.token?.actorLink !== false);
      if ( match && c.isDefeated ) await c.update({ defeated: false });
    }
  }
  if ( actor.statuses.has("dead") ) await actor.toggleStatusEffect("dead", { active: false, overlay: true });
}
