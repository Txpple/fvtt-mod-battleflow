/**
 * Battle Flow — Receipts: the revert row on damage cards. Public facts, GM-only pools and controls.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { receiptAmounts, revertPlan, traitPhrase } from "./decide/receipt.js";
import { revertEffect } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * Receipts — the revert row on damage cards. Public facts, GM-only pools and controls.
 * The flag is the state; this is a view.
 * ------------------------------------------------------------------------------------------- */

/** EDGE: the system's own name for a damage or healing type. The phrase built from it is
 * decide/receipt.js's, which may not read CONFIG — the fallback when this finds nothing
 * lives there with the rest of the wording. */
function typeLabel(type) {
  return CONFIG.DND5E.damageTypes[type]?.label ?? CONFIG.DND5E.healingTypes?.[type]?.label;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const receipt = message.getFlag(MODULE_ID, "receipt");
  const effectReceipt = message.getFlag(MODULE_ID, "effectReceipt");
  if ( !receipt?.targets?.length && !effectReceipt?.targets?.length ) return;
  // Everyone sees WHO the damage landed on — otherwise a rolled number sits on the card with
  // no indication of who took it. Only the GM sees the HP pool and the revert control: the
  // party has no business reading a monster's hit points off a chat card.
  const isGM = game.user.isGM;

  // While an un-reverted application stands, every render of the card starts with its damage
  // tray collapsed, as if Apply had been pressed (same "manual" setting guard as the native
  // handler, damage-application.mjs:337). Stateless and per-tree by hard-won necessity: a
  // message renders into SEVERAL DOM trees (chat log, the notifications pane, popouts), and
  // any latched once-per-message guard collapses a tree that gets replaced while the ones on
  // screen skip (bit live 2026-08-15). A manually reopened tray survives until the next
  // re-render — which only a receipt change or a log rebuild triggers — because the flag is
  // the state and the tray, like the receipt row, is just a view of it.
  // ⚠ Toggle the ATTRIBUTE, never the property: this render tree is detached, so custom
  // elements in it are not yet upgraded — `tray.open = false` writes a plain property that
  // shadows the accessor and never touches the attribute (the system's own _collapseTrays
  // uses toggleAttribute for the same reason, chat-message.mjs:166).
  if ( receipt?.targets?.some(t => !t.reverted)
    && (game.settings.get("dnd5e", "autoCollapseChatTrays") !== "manual") ) {
    html.querySelector("damage-application")?.toggleAttribute("open", false);
  }

  const row = document.createElement("div");
  row.className = "battleflow-receipt";
  Object.assign(row.style, {
    margin: "0.25rem 0 0", padding: "0.25rem 0.5rem",
    border: "1px solid var(--color-border-light-2, #999a)", borderRadius: "4px",
    fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6"
  });

  for ( const t of receipt?.targets ?? [] ) {
    // The row mirrors the native tray's target entry (user call, 2026-08-15, third try):
    // 32px portrait, a STACKED name column, numbers on the right. The stack is what makes
    // it squeeze-proof — the title ellipsizes and the reason wraps BELOW the name inside
    // the column, so no flex fight can ever render "Ice Mephit" one character per line
    // again. The first attempt put the reason in the flex row (squeezed the name); the
    // second styled it as a block but left it appended in the row (same squeeze).
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
    } else { // old receipts carry no img — they keep the plain state glyph
      icon = document.createElement("i");
      icon.className = t.reverted ? "fa-solid fa-rotate-left" : "fa-solid fa-heart-crack";
      Object.assign(icon.style, { flex: "0 0 auto", opacity: t.reverted ? "0.5" : "0.85" });
    }
    icon.dataset.tooltip = t.name; // walk-5 (aa): every card icon names itself on hover

    const title = document.createElement("span");
    title.textContent = t.name;
    Object.assign(title.style, {
      flex: "1", minWidth: "0", fontWeight: "bold",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
    });
    if ( t.reverted ) title.style.textDecoration = "line-through";

    line.append(icon, title);

    // The second row carries the story (user's layout call, 2026-08-15): the reason and the
    // NUMBER, together, below the name — the top row is just who and the revert.
    //
    // ⚠ The number is `taken` (post-trait, pre-clamp), not the HP delta: the delta answers
    // "what did the pool do", but the table is owed "what did the hit deal". Pools stay
    // GM-only. Every number below, and the voice it speaks in, is decide/receipt.js.
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
      // A gain — healing, or a temp-HP grant — reads in a friendly blue; damage keeps the
      // tray's own maroon voice. Which of the three it is, and what it says, is decided one
      // layer down; the colours are the only part of it the stylesheet owns.
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
      button.addEventListener("click", () => revertTarget(message, t.uuid));
      line.append(button);
    }

    row.append(line, sub);
  }

  // Effect riders (Phase 1.9A): what landed, per target — same stacked shape as the damage
  // lines, led by the EFFECT's icon since that is the thing that arrived.
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
      icon.dataset.tooltip = e.name; // walk-5 (aa): every card icon names itself on hover

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

      // What the effect DOES, on hover (user call 2026-08-16). The description is stored on
      // the receipt entry at application time so the tooltip survives the effect's later
      // deletion (cascade, revert, death); older entries fall back to the live document.
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
        button.addEventListener("click", () => revertEffect(message, t.uuid, e.id));
        line.append(button);
      }

      row.append(line);
    }
  }

  html.querySelector(".message-content")?.appendChild(row);
});

/**
 * Restore one receipt target to its pre-application HP snapshot. Reload-proof: state is
 * re-read from the message flag at click time, never from the DOM, and the reverted marker is
 * written back to the flag (whose update re-renders the card on every client). What the revert
 * owes — and what it deliberately leaves alone — is decide/receipt.js's `revertPlan`.
 */
export async function revertTarget(message, uuid) {
  const receipt = foundry.utils.deepClone(message.getFlag(MODULE_ID, "receipt") ?? {});
  const plan = revertPlan(receipt, uuid);
  if ( !plan ) return;

  const actor = await fromUuid(uuid);
  if ( !(actor instanceof Actor) ) {
    ui.notifications.warn(`${TITLE}: that target no longer exists — nothing to revert.`);
    return;
  }

  await actor.update(plan.update);

  // combatplus's own heal-up handler usually beats us to the defeated mark; this covers the
  // table where that feature is off at revert time, and no-ops when everything is clean.
  if ( plan.clearDefeated ) await clearDefeated(actor);

  plan.entry.reverted = true;
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
