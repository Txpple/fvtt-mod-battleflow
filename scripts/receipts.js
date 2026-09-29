/**
 * Battle Flow — Receipts: the revert row on damage cards, a view of the receipt flags. Who and
 * what is public; HP pools and the revert controls are GM-only.
 */
import { MODULE_ID, TITLE, queueFlagWrite } from "./core.js";
import { clearStatus } from "./shared.js";
import { receiptAmounts, revertPlan, traitPhrase } from "./decide/receipt.js";
import { revertEffect } from "./effect-riders.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

/** EDGE: the system's own name for a damage or healing type (the phrase is decide/receipt.js's). */
function typeLabel(type) {
  return CONFIG.DND5E.damageTypes[type]?.label ?? CONFIG.DND5E.healingTypes?.[type]?.label;
}

listen("dnd5e.renderChatMessage", "receipts", (message, html) => {
  const receipt = message.getFlag(MODULE_ID, "receipt");
  const effectReceipt = message.getFlag(MODULE_ID, "effectReceipt");
  if ( !receipt?.targets?.length && !effectReceipt?.targets?.length ) return;
  // Everyone sees WHO the damage landed on; only the GM sees the pool and the revert.
  const isGM = game.user.isGM;

  // An un-reverted application collapses the tray on every render (a message renders into SEVERAL
  // trees). ⚠ The ATTRIBUTE: the detached tree's custom elements are not upgraded, so `.open` shadows.
  if ( receipt?.targets?.some(t => !t.reverted)
    && (game.settings.get("dnd5e", "autoCollapseChatTrays") !== "manual") ) {
    html.querySelector(SURFACES.damageTray)?.toggleAttribute("open", false);
  }

  const row = document.createElement("div");
  row.className = "battleflow-receipt";
  Object.assign(row.style, {
    margin: "0.25rem 0 0", padding: "0.25rem 0.5rem",
    border: "1px solid var(--color-border-light-2, #999a)", borderRadius: "4px",
    fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6"
  });

  for ( const t of receipt?.targets ?? [] ) {
    // The native tray's entry shape; the STACKED name column keeps a long reason from squeezing it.
    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", alignItems: "center", gap: "0.5rem", margin: "2px 0" });

    let icon;
    if ( t.img ) {
      icon = document.createElement("img");
      icon.src = t.img;
      icon.alt = t.name;
      icon.className = "gold-icon"; // native framing wherever the system styles reach the card
      Object.assign(icon.style, {
        flex: "0 0 auto", width: "32px", height: "32px", objectFit: "cover",
        borderRadius: "4px",
        ...(t.reverted ? { filter: "grayscale(1)", opacity: "0.5" } : {})
      });
    } else { // older receipts carry no img — they keep the plain state glyph
      icon = document.createElement("i");
      icon.className = t.reverted ? "fa-solid fa-rotate-left" : "fa-solid fa-heart-crack";
      Object.assign(icon.style, { flex: "0 0 auto", opacity: t.reverted ? "0.5" : "0.85" });
    }
    icon.dataset.tooltip = t.name; // every card icon names itself on hover

    const title = document.createElement("span");
    title.textContent = t.name;
    Object.assign(title.style, {
      flex: "1", minWidth: "0", fontWeight: "bold",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
    });
    if ( t.reverted ) title.style.textDecoration = "line-through";

    line.append(icon, title);

    // The second row: the reason and the number. ⚠ The number is `taken` (what the hit dealt),
    // not the pool delta; every number and its voice is decide/receipt.js.
    const amounts = receiptAmounts(t);
    const sub = document.createElement("div");
    Object.assign(sub.style, { margin: "0 0 0 40px", lineHeight: "1.4" });
    if ( t.reverted ) {
      sub.textContent = "reverted";
      sub.style.fontStyle = "italic";
    } else {
      // A note (Graze) and the trait story share the reason slot, in that order.
      const phrases = [...(t.note ? [t.note] : []),
        ...(t.traits ?? []).map(x => traitPhrase({ ...x, label: typeLabel(x.type) }))
          .filter(Boolean)];
      if ( phrases.length ) {
        const why = document.createElement("span");
        why.textContent = `${phrases.join(", ")} · `;
        Object.assign(why.style, { fontStyle: "italic", opacity: "0.8" });
        sub.append(why);
      }
      // A gain reads blue; damage keeps the tray's maroon.
      const amount = document.createElement("span");
      amount.textContent = amounts.amountText;
      Object.assign(amount.style, {
        fontVariantNumeric: "tabular-nums", fontWeight: "bold",
        color: (amounts.tempOnly || amounts.healed) ? "var(--dnd5e-color-blue, #3a7ca5)"
          : "var(--dnd5e-color-maroon, #740b0b)"
      });
      sub.append(amount);
      if ( amounts.tempExtraText ) {
        const extra = document.createElement("span");
        extra.textContent = amounts.tempExtraText;
        Object.assign(extra.style, {
          fontVariantNumeric: "tabular-nums", opacity: "0.85",
          color: "var(--dnd5e-color-blue, #3a7ca5)"
        });
        sub.append(extra);
      }
      if ( isGM ) {
        // The pool is the GM's book: it says the −14 landed on a creature already at 0.
        const pool = document.createElement("span");
        pool.textContent = ` (${amounts.from} → ${amounts.after})`;
        Object.assign(pool.style, { fontVariantNumeric: "tabular-nums", opacity: "0.75" });
        sub.append(pool);
      }
    }

    if ( isGM && !t.reverted ) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "↩ Revert";
      Object.assign(button.style, {
        flex: "0 0 auto", width: "auto", margin: "0",
        padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4"
      });
      // ⚠ The catch is load-bearing: an un-caught await in a listener rejects into nothing
      // (NOTES.md §1). A failed revert must SAY so.
      button.addEventListener("click", () => revertTarget(message, t.uuid).catch(err => {
        console.error(`${TITLE} | Revert failed.`, err);
        ui.notifications.error(`${TITLE}: the revert did not complete — see the console.`);
      }));
      line.append(button);
    }

    row.append(line, sub);
  }

  // Effect lines: the same stacked shape, led by the EFFECT's icon.
  for ( const t of effectReceipt?.targets ?? [] ) {
    for ( const e of t.effects ?? [] ) {
      const line = document.createElement("div");
      Object.assign(line.style, { display: "flex", alignItems: "center", gap: "0.5rem", margin: "2px 0" });

      let icon;
      if ( e.img ) {
        icon = document.createElement("img");
        icon.src = e.img;
        icon.alt = e.name;
        icon.className = "gold-icon";
        Object.assign(icon.style, {
          flex: "0 0 auto", width: "32px", height: "32px", objectFit: "cover",
          borderRadius: "4px",
          ...(e.reverted ? { filter: "grayscale(1)", opacity: "0.5" } : {})
        });
      } else {
        icon = document.createElement("i");
        icon.className = "fa-solid fa-wand-magic-sparkles";
        Object.assign(icon.style, { flex: "0 0 auto", opacity: e.reverted ? "0.5" : "0.85" });
      }
      icon.dataset.tooltip = e.name; // every card icon names itself on hover

      const stack = document.createElement("div");
      Object.assign(stack.style, {
        flex: "1", minWidth: "0", display: "flex", flexDirection: "column", justifyContent: "center"
      });

      const title = document.createElement("span");
      title.textContent = e.name;
      Object.assign(title.style, {
        fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
      });
      if ( e.reverted ) title.style.textDecoration = "line-through";
      stack.append(title);

      const sub = document.createElement("span");
      sub.textContent = `on ${t.name}`;
      Object.assign(sub.style, { fontStyle: "italic", opacity: "0.8" });
      stack.append(sub);

      line.append(icon, stack);

      // The hover text is stored on the entry, so it survives the effect's deletion.
      const tip = e.description || (() => {
        try { return fromUuidSync(t.uuid)?.effects?.get(e.id)?.description ?? ""; }
        catch { return ""; }
      })();
      if ( tip ) line.dataset.tooltip = tip;

      if ( e.reverted ) {
        const gone = document.createElement("span");
        gone.textContent = "removed";
        Object.assign(gone.style, { flex: "0 0 auto", fontStyle: "italic" });
        line.append(gone);
      } else if ( isGM ) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "✕ Revert";
        Object.assign(button.style, {
          flex: "0 0 auto", width: "auto", margin: "0",
          padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4"
        });
        // Same catch as the damage revert above.
        button.addEventListener("click", () => revertEffect(message, t.uuid, e.id).catch(err => {
          console.error(`${TITLE} | Effect revert failed.`, err);
          ui.notifications.error(`${TITLE}: the revert did not complete — see the console.`);
        }));
        line.append(button);
      }

      row.append(line);
    }
  }

  html.querySelector(SURFACES.messageContent)?.appendChild(row);
});

/** Restore one receipt target's pre-application HP, re-reading the flag (never the DOM). */
export async function revertTarget(message, uuid) {
  const plan = revertPlan(message.getFlag(MODULE_ID, "receipt"), uuid);
  if ( !plan ) return;

  const actor = await fromUuid(uuid);
  if ( !(actor instanceof Actor) ) {
    ui.notifications.warn(`${TITLE}: that target no longer exists — nothing to revert.`);
    return;
  }

  await actor.update(plan.update);
  // A ward pool's take goes back to the ward (its hit points are the feature's uses).
  if ( plan.ward?.took ) {
    // live only: the ward's hit points are its feature's uses on the bearer's sheet, never a card's snapshot
    const item = await fromUuid(plan.ward.itemUuid).catch(() => null);
    const spent = Number(item?.system?.uses?.spent ?? 0);
    if ( item ) await item.update({ "system.uses.spent": Math.max(0, spent - Number(plan.ward.took)) });
  }

  // combatplus usually clears the defeated mark first; this covers a table where it is off.
  if ( plan.clearDefeated ) await clearDefeated(actor);

  // The mark, through the serializer (ARCHITECTURE §4 law 2), the guard repeated inside the lock.
  await queueFlagWrite(message, "receipt", flag => {
    const entry = revertPlan(flag, uuid)?.entry;
    if ( !entry ) return false;
    entry.reverted = true;
  });
}

/**
 * combatplus's combatant matching, in reverse. ⚠ Best-effort: dnd5e races to clear the same marks,
 * and a lost race must not cost the caller its marker write.
 */
async function clearDefeated(actor) {
  for ( const combat of game.combats ) {
    for ( const c of combat.combatants ) {
      const match = actor.isToken ? c.tokenId === actor.token.id
        : (c.actorId === actor.id) && (c.token?.actorLink !== false);
      if ( !match || !c.isDefeated ) continue;
      try {
        await c.update({ defeated: false });
      } catch(err) {
        console.warn(`${TITLE} | Could not clear the defeated mark for ${actor.name}.`, err);
      }
    }
  }
  await clearStatus(actor, "dead");
}
