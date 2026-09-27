/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the VIEWS — the card row
 * (the demand's rows, bars, Roll and Answer buttons) and the create / update / delete watchers,
 * every resume floor on them. index.js is the directory's only public face.
 */
import { MODULE_ID, rollerUserFor,
  drivesMomentFor, canAnswerFor } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { verdictTail, verdictText } from "../decide/verdict.js";
import { popupKey, holdBarHTML, momentBarHTML, esc } from "../decide/present.js";
import { AREA_CHOICE_FLAG, AREA_ASK_FLAG, areaChoiceLine } from "../decide/area-ask.js";
import { livePopups, momentButton, scheduleBarSync, shownMoments } from "../ui.js";
import { saveAnsweredBy, foldSaveAnswer, flipForcedSave } from "./verdict.js";
import { applySaveConsequences, reconcileSaveDamage } from "./consequences.js";
import { refreshDemandFromTemplates, cleanupSpentTemplates } from "./areas.js";
import { openSaveDialog, armSaveTimer, disarmSaveTimer } from "./ask.js";
import { armSaveChoiceTimer, disarmSaveChoiceTimer, showSaveChoicePopup } from "./choices.js";
import { SURFACES } from "../surfaces.js";
import { CARD, isCard, resistedOf } from "../decide/card.js";

/* --- the answer channels and the resume discipline ------------------------------------------- */

Hooks.on("createChatMessage", message => {
  // A save roll landing folds into the demand it answers; the demand names its own driver, so the
  // gate sits inside.
  if ( isCard(message, CARD.save) ) {
    const found = saveAnsweredBy(message);
    if ( found && drivesMomentFor(found.card.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) )
      void foldSaveAnswer(found.card, found.uuid, message);
  }
  // The card's damage roll landing: verdicts that already exist apply now; the rest apply
  // as they fold, per target.
  if ( isCard(message, CARD.damage) ) {
    const origin = message.getOriginatingMessage?.();
    if ( origin && (origin !== message) && origin.getFlag(MODULE_ID, "saves") ) {
      void reconcileSaveDamage(origin);
    }
  }
});

Hooks.on("updateChatMessage", message => {
  // Legendary resistance: a save flipped to success after the fact.
  if ( isCard(message, CARD.save) && resistedOf(message) ) {
    void flipForcedSave(message);
  }

  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // Every client closes popups whose decision is made; the timer disarms when nothing is left.
  for ( const t of flag.targets ?? [] ) {
    const dialog = livePopups.get(popupKey(message.id, `save:${t.uuid}`));
    if ( dialog && (t.done || (flag.status !== "pending")) ) void dialog.close();
    // The fold choices' popups close the same way.
    const choiceDialog = livePopups.get(popupKey(message.id, `choice:${t.uuid}`));
    if ( choiceDialog && (!t.choice || t.choice.answer) ) void choiceDialog.close();
  }
  armSaveChoiceTimer(message);
  // A DROPPED entry's popup asks a withdrawn question (containment moved the demand off a target)
  // and no buzzer will come for it: close every popup for this card whose entry is gone, and clear
  // its shown-latch so a re-arrival gets a fresh ask. Every client — the popup lives wherever
  // canAnswerFor put it.
  const savePrefix = `${message.id}|save:`;
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(savePrefix) ) continue;
    const uuid = key.slice(savePrefix.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) void dialog.close();
  }
  // The latch key IS the popup key, so the same prefix un-latches.
  for ( const key of [...shownMoments] ) {
    if ( !key.startsWith(savePrefix) ) continue;
    const uuid = key.slice(savePrefix.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) shownMoments.delete(key);
  }
  if ( flag.status !== "pending" ) disarmSaveTimer(message.id);
  else {
    // The demand lands as an UPDATE (the system creates the card, the caster stamps it a beat
    // later), so arrival work rides here as well as on render.
    armSaveTimer(message);
  }
  if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
    for ( const t of flag.targets ?? [] ) {
      if ( t.done && !t.applied ) void applySaveConsequences(message, t.uuid);
    }
    // The convergent floor: a done demand re-offers its spent-area cleanup, so a one-shot lost to
    // an elect flip lands on the next update.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clocks disarm here.
Hooks.on("deleteChatMessage", message => {
  disarmSaveTimer(message.id);
  disarmSaveChoiceTimer(message.id);
});

/* --- the views: the card row and the dialog -------------------------------------------------- */

// A spell that chooses its targets: who its area affects, one line above the demand's rows.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const record = message.getFlag(MODULE_ID, AREA_CHOICE_FLAG);
  if ( !Array.isArray(record?.chosen) ) return;
  const content = html.querySelector?.(SURFACES.messageContent) ?? html;
  if ( !content || content.querySelector(".bf-area-choice") ) return;
  const line = document.createElement("div");
  line.className = "bf-area-choice";
  line.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
  line.innerHTML = `<i class="fa-solid fa-bullseye" data-tooltip="Creatures of your choice"></i> ${esc(areaChoiceLine(record))}`;
  content.appendChild(line);
});

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;

  // A WAITING demand (a targetless template stamp): zero targets, clock unarmed. Say so, and run
  // the adoption floor on the elect — the template CRUD hooks are only fast-paths, so a render is
  // what reliably notices the placed area.
  if ( !flag.targets?.length ) {
    if ( flag.status !== "pending" ) return;
    void refreshDemandFromTemplates(message);   // gated on the demand's own driver inside
    // The area has landed and its caster is being asked; the ask's own line speaks.
    if ( message.getFlag(MODULE_ID, AREA_ASK_FLAG)?.status === "pending" ) return;
    const abilityLabel = CONFIG.DND5E.abilities[flag.abilities?.[0]]?.label ?? flag.abilities?.[0] ?? "";
    const row = document.createElement("div");
    row.className = "battleflow-saves";
    row.style.marginTop = "0.35rem";
    const line = document.createElement("div");
    Object.assign(line.style, {
      fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6", fontWeight: "bold", opacity: "0.75"
    });
    line.textContent = `${abilityLabel} save DC ${flag.dc} — waiting for the template's area`;
    row.appendChild(line);
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    return;
  }

  const row = document.createElement("div");
  row.className = "battleflow-saves";
  row.style.marginTop = "0.35rem";

  const pending = flag.status === "pending";
  const abilityLabel = CONFIG.DND5E.abilities[flag.abilities?.[0]]?.label ?? flag.abilities?.[0] ?? "";

  for ( const t of flag.targets ) {
    // The platform's SUMMARY ROW is the line: a resolved target whose roll is summarized inside
    // this card gets the verdict's tail in that row beside its total; one with no summary row keeps
    // the line below. The platform re-renders the summary on every render, so the tail is fresh.
    if ( t.done && t.rollMessageId ) {
      const summary = [...html.querySelectorAll(SURFACES.cardSummary)].find(el => el.dataset.messageId === t.rollMessageId) ?? null;
      const host = summary?.querySelector(SURFACES.summaryRow) ?? null;
      const tail = host ? verdictTail(flag, t) : null;
      if ( tail ) {
        if ( !host.querySelector(".bf-verdict") ) {
          // Two lines: the row wraps, the names push the total right, the verdict takes line two.
          host.style.flexWrap = "wrap";
          const names = host.querySelector("ul");
          if ( names ) { names.style.flex = "1 1 auto"; names.style.minWidth = "0"; names.style.justifyContent = "flex-start"; }
          const span = document.createElement("span");
          span.className = "bf-verdict";
          span.style.cssText = "flex:1 0 100%;text-align:right;font-size:var(--font-size-11, 11px);font-weight:bold;color:"
            + `${t.outcome === "saved" ? "var(--dnd5e-color-blue, #3a7ca5)" : "var(--dnd5e-color-maroon, #740b0b)"};`;
          span.textContent = tail;
          host.appendChild(span);
        }
        continue;
      }
    }
    const line = document.createElement("div");
    Object.assign(line.style, {
      fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6", fontWeight: "bold"
    });
    if ( t.done ) {
      line.style.opacity = "0.85";
      line.innerHTML = `${esc(t.name)} — <span style="color:${t.outcome === "saved"
        ? "var(--dnd5e-color-blue, #3a7ca5)" : "var(--dnd5e-color-maroon, #740b0b)"};">`
        + `${verdictText(flag, t)}</span>`;
    } else {
      const actor = resolveUuid(t.uuid);
      const roller = (actor instanceof Actor) ? rollerUserFor(actor) : null;
      line.style.opacity = "0.75";
      line.textContent = `${t.name} — ${abilityLabel} save DC ${flag.dc}, waiting on ${roller?.name ?? "the GM"}`;
    }
    row.appendChild(line);
    // EVERY pending row runs the demand's bar, all anchored to the same absolute deadline.
    if ( pending && !t.done ) {
      const bar = document.createElement("div");
      bar.innerHTML = holdBarHTML(flag, "to roll");
      row.appendChild(bar);
    }
  }

  if ( pending ) {
    scheduleBarSync(row);
    armSaveTimer(message);

    // Resume, stateless: an answer, verdict or damage that landed while nobody could act.
    if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
      // The containment floor: a pending demand follows its area on every render (the template
      // CRUD hooks are unreliable on the headless elect).
      void refreshDemandFromTemplates(message);
      for ( const t of flag.targets ) {
        if ( t.done ) continue;
        const landed = game.messages.find(m => (m.getFlag(MODULE_ID, "respondsTo") === message.id)
          && (m.getFlag(MODULE_ID, "saveFor") === t.uuid));
        if ( landed ) void foldSaveAnswer(message, t.uuid, landed);
      }
    }

    for ( const t of flag.targets ) {
      if ( t.done ) continue;
      const actor = resolveUuid(t.uuid);
      if ( !canAnswerFor(actor) ) continue;
      // canAnswerFor ALONE routes the popup: an online owner excludes the GM; with the owner
      // offline the GM gets it, never nobody. Every pending demand opens its dialog once, cascading
      // (no queue); the button recalls it.
      const shownKey = popupKey(message.id, `save:${t.uuid}`);
      if ( !shownMoments.has(shownKey) ) {
        shownMoments.add(shownKey);
        void openSaveDialog(message, t.uuid);
      }
      row.appendChild(momentButton(`Roll — ${t.name}`, () => {
        shownMoments.delete(shownKey);
        void openSaveDialog(message, t.uuid);
      }));
    }
  }

  // Fold choices pop for whoever owns their SUBJECT, with a bar, an Answer recall and a buzzer
  // re-armed on render. OUTSIDE `pending`: choices open after a verdict.
  let choiceBars = false;
  for ( const t of flag.targets ?? [] ) {
    const c = t.choice;
    if ( !c || c.answer || t.applied ) continue;
    if ( c.deadline ) {
      // momentBarHTML, never holdBarHTML: the sub-object has no status, and the status-gated
      // wrapper would render nothing.
      const bar = document.createElement("div");
      bar.innerHTML = momentBarHTML(c, "to answer");
      row.appendChild(bar);
      choiceBars = true;
    }
    const subject = resolveUuid(c.subjectUuid);
    if ( !canAnswerFor(subject) ) continue;
    const shownKey = popupKey(message.id, `choice:${t.uuid}`);
    if ( !shownMoments.has(shownKey) ) {
      shownMoments.add(shownKey);
      void showSaveChoicePopup(message, t.uuid);
    }
    row.appendChild(momentButton(`Answer — ${c.itemName}`, () => void showSaveChoicePopup(message, t.uuid)));
  }
  if ( choiceBars && !pending ) scheduleBarSync(row);
  armSaveChoiceTimer(message);

  if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
    for ( const t of flag.targets ) {
      if ( t.done && !t.applied ) void applySaveConsequences(message, t.uuid);
    }
    if ( flag.targets.some(t => t.done) ) void reconcileSaveDamage(message);
    // The convergent floor, render side: the reload-resume twin of the update floor.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
});
