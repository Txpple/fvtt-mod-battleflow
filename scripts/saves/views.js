/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the VIEWS — the card row (the demand's rows, bars, Roll and Answer
 * buttons) and the create / update / delete watchers, every resume floor on them.
 * The machine-tier pass, Stage 4c (2026-09-05, ruling 3): saves.js became this directory —
 * one flag, one machine, one part per spine step; index.js is the only public face and fixes
 * the registration order. Every body here is the one saves.js carried; nothing was rewritten.
 * (The empty "who volunteers: the opt-out's silent roller" section marker saves.js still carried
 * — a fossil of the retired house popup — is not carried over.)
 */
import { MODULE_ID, rollerUserFor,
  drivesMomentFor, canAnswerFor } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { verdictText } from "../decide/verdict.js";
import { popupKey, holdBarHTML, momentBarHTML } from "../decide/present.js";
import { livePopups, momentButton, scheduleBarSync, shownMoments } from "../ui.js";
import { saveAnsweredBy, foldSaveAnswer, flipForcedSave } from "./verdict.js";
import { applySaveConsequences, reconcileSaveDamage } from "./consequences.js";
import { refreshDemandFromTemplates, cleanupSpentTemplates } from "./areas.js";
import { openSaveDialog, armSaveTimer, disarmSaveTimer } from "./ask.js";
import { armSaveChoiceTimer, disarmSaveChoiceTimer, showSaveChoicePopup } from "./choices.js";

/* --- the answer channels and the resume discipline ------------------------------------------- */

Hooks.on("createChatMessage", message => {
  // A save roll landing: fold it into whatever demand it answers. The demand names its own
  // driver, so the gate moves inside — this hook cannot know the card before it looks (v1.27.2).
  if ( message.getFlag("dnd5e", "roll.type") === "save" ) {
    const found = saveAnsweredBy(message);
    if ( found && drivesMomentFor(found.card.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) )
      void foldSaveAnswer(found.card, found.uuid, message);
  }
  // The card's damage roll landing: verdicts that already exist apply now; the rest apply
  // as they fold, per target.
  if ( message.getFlag("dnd5e", "roll.type") === "damage" ) {
    const origin = message.getOriginatingMessage?.();
    if ( origin && (origin !== message) && origin.getFlag(MODULE_ID, "saves") ) {
      void reconcileSaveDamage(origin);
    }
  }
});

Hooks.on("updateChatMessage", message => {
  // Legendary resistance: a save flipped to success after the fact.
  if ( (message.getFlag("dnd5e", "roll.type") === "save")
    && (message.getFlag("dnd5e", "roll.forceSuccess") === true) ) {
    void flipForcedSave(message);
  }

  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // Every client closes popups whose decision is made; the timer disarms when nothing is left.
  for ( const t of flag.targets ?? [] ) {
    const dialog = livePopups.get(popupKey(message.id, `save:${t.uuid}`));
    if ( dialog && (t.done || (flag.status !== "pending")) ) void dialog.close();
    // The fold choices' popups close the same way (v1.19.x ⑤/⑥), and their buzzer re-arms.
    const choiceDialog = livePopups.get(popupKey(message.id, `choice:${t.uuid}`));
    if ( choiceDialog && (!t.choice || t.choice.answer) ) void choiceDialog.close();
  }
  armSaveChoiceTimer(message);
  // A DROPPED entry's popup is asking a withdrawn question (the live Shatter strand,
  // 2026-08-17: containment moved the demand off a snapshot target, and the popup sat open
  // with a dead bar and no buzzer ever coming — the buzzer only knows entries that still
  // exist). Sweep every popup for this card whose entry is GONE, and clear its shown-latch
  // so a re-arrival gets a fresh ask. Runs on every client — the popup lives wherever
  // canAnswerFor put it, not where the refresh ran.
  const savePrefix = `${message.id}|save:`;
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(savePrefix) ) continue;
    const uuid = key.slice(savePrefix.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) void dialog.close();
  }
  // The latch key IS the popup key (the spine), so the dropped-entry sweep un-latches
  // through the same prefix — a re-arrival gets a fresh ask.
  for ( const key of [...shownMoments] ) {
    if ( !key.startsWith(savePrefix) ) continue;
    const uuid = key.slice(savePrefix.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) shownMoments.delete(key);
  }
  if ( flag.status !== "pending" ) disarmSaveTimer(message.id);
  else {
    // The demand lands as an UPDATE (the system creates the card, the caster stamps it a
    // beat later), so arrival work rides here as well as on render.
    armSaveTimer(message);
  }
  if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
    for ( const t of flag.targets ?? [] ) {
      if ( t.done && !t.applied ) void applySaveConsequences(message, t.uuid);
    }
    // The sweep's convergent floor (finding ②): a done demand re-offers its spent-area
    // cleanup here, so a one-shot lost to an elect flip lands on the next update.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clocks disarm here.
Hooks.on("deleteChatMessage", message => {
  disarmSaveTimer(message.id);
  disarmSaveChoiceTimer(message.id);
});

/* --- the views: the card row and the dialog -------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;

  // A WAITING demand (the v1.12.0 targetless template stamp): zero targets, clock unarmed.
  // Say so — a silent card here is indistinguishable from finding ③'s bug — and run the
  // adoption floor on the elect: the CRUD hooks are only fast-paths (the headless ground
  // truth), so a render is what reliably notices the placed area.
  if ( !flag.targets?.length ) {
    if ( flag.status !== "pending" ) return;
    void refreshDemandFromTemplates(message);   // gated on the demand's own driver inside
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
    html.querySelector(".message-content")?.appendChild(row);
    return;
  }

  const row = document.createElement("div");
  row.className = "battleflow-saves";
  row.style.marginTop = "0.35rem";

  const pending = flag.status === "pending";
  const abilityLabel = CONFIG.DND5E.abilities[flag.abilities?.[0]]?.label ?? flag.abilities?.[0] ?? "";

  for ( const t of flag.targets ) {
    const line = document.createElement("div");
    Object.assign(line.style, {
      fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6", fontWeight: "bold"
    });
    if ( t.done ) {
      line.style.opacity = "0.85";
      line.innerHTML = `${t.name} — <span style="color:${t.outcome === "saved"
        ? "var(--dnd5e-color-blue, #3a7ca5)" : "var(--dnd5e-color-maroon, #740b0b)"};">`
        + `${verdictText(flag, t)}</span>`;
    } else {
      const actor = resolveUuid(t.uuid);
      const roller = (actor instanceof Actor) ? rollerUserFor(actor) : null;
      line.style.opacity = "0.75";
      // Since finding (h) the GM's popup really does pop for an offline owner's actor, so
      // naming the roller is true again — the old "the timer (owner offline)" special case
      // described the quiet this fix removed.
      line.textContent = `${t.name} — ${abilityLabel} save DC ${flag.dc}, waiting on ${roller?.name ?? "the GM"}`;
    }
    row.appendChild(line);
    // EVERY pending row runs the demand's bar (v1.11.0, finding ④ — "two timers tick
    // side by side" was the user's expectation on a two-target demand; the single bar
    // under the last row read as that row's alone, with the others' "missing"). Each bar
    // anchors to the same absolute deadline, so the popup pairing and the drift-0 rule
    // are untouched — a resolved row's bar leaves with its pending text.
    if ( pending && !t.done ) {
      const bar = document.createElement("div");
      bar.innerHTML = holdBarHTML(flag, "to roll");
      row.appendChild(bar);
    }
  }

  if ( pending ) {
    scheduleBarSync(row);
    armSaveTimer(message);

    // Resume, stateless (the split discipline): an answer landed while nobody could fold;
    // a verdict landed while nobody could apply; damage landed while nobody could reconcile.
    if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
      // The containment floor: a pending demand follows its area on every render — the
      // template CRUD hooks are only fast-paths (measured unreliable on the headless elect).
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
      // v1.19.x finding (h): canAnswerFor ALONE routes the popup. The old extra
      // `isGM && hasPlayerOwner` quiet was mutually exclusive with canAnswerFor's own
      // active-owner check, so a player-owned target with its owner OFFLINE popped for
      // nobody and the buzzer ate the save — the walk's log shows Thomas failing two
      // Fireballs "(timer)" while the solo GM watched the bar. The v1.12.0 ruling ("as a
      // GM i dont care to see other player saves") is UNTOUCHED where it was made: an
      // online owner still excludes the GM inside canAnswerFor.
      // (No pre-roll choice can pend here since walk-5 (y): choices open off the VERDICT,
      // on entries this !t.done loop already skips — the save ask never defers.)
      // CASCADING, NO QUEUE (user, 2026-09-02): every pending demand opens its dialog once,
      // stepped down the staircase; the button recalls this card's dialog regardless.
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

  // Fold choices (v1.19.x ⑤/⑥): a pending choice pops for whoever owns its SUBJECT —
  // player-first, GM fallback (finding ①'s routing) — carries its own bar, keeps an Answer
  // recall, and re-arms its buzzer on render. Deliberately OUTSIDE `pending`: choices open
  // after a verdict, so the demand itself may already read resolved.
  let choiceBars = false;
  for ( const t of flag.targets ?? [] ) {
    const c = t.choice;
    if ( !c || c.answer || t.applied ) continue;
    if ( c.deadline ) {
      // momentBarHTML, never holdBarHTML (finding (n)): the sub-object has no status, and
      // the status-gated wrapper rendered "" here for a whole round — the card showed a
      // pending choice with no drain anywhere on screen.
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
    // The sweep's convergent floor (finding ②) — render side, the reload-resume twin of
    // the update floor above.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
  html.querySelector(".message-content")?.appendChild(row);
});
