/**
 * Battle Flow — CORE (ARCHITECTURE.md §7, a leaf beside core.js): THE SURFACES MAP — every HTML
 * anchor this module reads off the PLATFORM's own markup, in one place.
 *
 * THE POSTURE (the dnd5e 6.0 pass, ASSESSMENT.md §3b, user-ruled 2026-09-15). At 6.0 the card's
 * DATA became the stable part and its HTML the unstable part — dnd5e treats `message.system` as
 * API and says outright not to rely on the card's markup, which now renders from templates that
 * will move through 6.x. This module's HTML dependencies are FEW against ~90 data reads, and the
 * rule for them is the hook-dispatch gate's rule applied to selectors:
 *
 *   1. every anchor lives HERE — no selector string for a platform element anywhere else
 *      (`tools/check-surfaces.mjs` fails the build on one);
 *   2. the same gate reads dnd5e's SHIPPED templates and bundle and fails when an anchor no
 *      longer appears there, pinned to the verified version like `dnd5e-hooks.json` — template
 *      churn becomes a build failure at the pin bump, not a row that silently never draws;
 *   3. data over anchors wherever the platform offers it (after 6.0, most places).
 *
 * ⚠ Imports nothing, touches nothing. The module's OWN markup (`[data-bf-*]`, `.bf-*`) is not
 * here — that is ours to move, and no gate can go stale on it.
 *
 * `core` anchors are Foundry's own and NOT checked against a file — core's templates are not in
 * the dnd5e install, and the hook gate found core's bundle unreadable for the same purpose (its
 * header says why). They are listed so the count is honest and the literal rule still holds.
 */

export const SURFACES = Object.freeze({
  /** Core's chat message body — where every row this module draws on a card goes. */
  messageContent: ".message-content",
  /** Core's chat message element, carrying the message id — a click's enclosing card. */
  messageId: "[data-message-id]",
  /** Core's settings form row — the settings sheet's groups, for the list hints. */
  formGroup: ".form-group",
  /** dnd5e's damage tray on a damage card — closed once the module has applied (receipts.js). */
  damageTray: "damage-application",
  /**
   * The action buttons on a usage card — hidden when the machine runs those workflows
   * (polish.js). 6.0 renders them as `section.icon-row > ul > li > button.icon[data-action]`
   * (chat/parts/card-buttons.hbs); the legacy content card keeps `.card-buttons`. Both listed
   * until phase 4 of the 6.0 pass moves the hide to data (`system.buttons[].visibility`).
   */
  cardButtons: ".card-buttons button[data-action], .icon-row button[data-action]",
  /** The roll configuration dialog's two parts (dnd5e's RollConfigurationDialog PARTS): the
   * fieldsets, and the button row the gate's section is drawn above. */
  dialogConfiguration: '[data-application-part="configuration"]',
  dialogButtons: '[data-application-part="buttons"]',
  /** The dialog's DEFAULT button — the one the platform autofocuses (dice/roll-buttons.hbs). */
  dialogDefault: "button[autofocus]",
  /** The dialog's ROLL button — its action is the buttons map's key (dice/roll-buttons.hbs). */
  dialogRoll: 'button[data-action="roll"]',
  /** The activity usage dialog's footer — the metamagic and emanation rows are inserted before
   * it. dnd5e's Dialog5e renders core's generic form footer as its `footer` part. */
  dialogFooter: "footer, .form-footer"
});

/**
 * Where each anchor is authored, for the gate. `file` is relative to a `systems/dnd5e` install
 * and `proof` is text that must appear in it (whitespace-collapsed); `core` rows carry no proof
 * and are reported, not checked.
 */
export const SURFACE_SOURCES = Object.freeze({
  messageContent: { where: "core" },
  messageId: { where: "core" },
  formGroup: { where: "core" },
  damageTray: { where: "dnd5e", file: "templates/chat/damage-card.hbs", proof: "<damage-application" },
  cardButtons: { where: "dnd5e", file: "templates/chat/parts/card-buttons.hbs", proof: "data-action" },
  dialogConfiguration: { where: "dnd5e", file: "dnd5e.mjs", proof: 'configuration: { template: "systems/dnd5e/templates/dice/roll-configuration.hbs"' },
  dialogButtons: { where: "dnd5e", file: "dnd5e.mjs", proof: 'buttons: { template: "systems/dnd5e/templates/dice/roll-buttons.hbs"' },
  dialogDefault: { where: "dnd5e", file: "templates/dice/roll-buttons.hbs", proof: "autofocus" },
  dialogRoll: { where: "dnd5e", file: "templates/dice/roll-buttons.hbs", proof: 'data-action="{{ @key }}"' },
  dialogFooter: { where: "dnd5e", file: "dnd5e.mjs", proof: 'class ActivityUsageDialog extends Dialog5e' }
});
