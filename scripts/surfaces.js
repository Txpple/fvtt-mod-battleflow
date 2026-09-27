/**
 * Battle Flow — CORE (ARCHITECTURE.md §7, a leaf beside core.js): THE SURFACES MAP — every HTML
 * anchor this module reads off the PLATFORM's own markup (NOTES §2 *the 6.0 pass*). dnd5e's card
 * DATA is API; its markup is not, so: every anchor lives HERE (`tools/check-surfaces.mjs` fails
 * the build on a platform selector elsewhere, and on an anchor missing from dnd5e's shipped
 * templates at the pinned version); prefer data wherever the platform offers it.
 * ⚠ Imports nothing. The module's own markup (`[data-bf-*]`) is not here. `core` anchors are
 * listed but not checked — core's templates are not in the dnd5e install.
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
   * dnd5e's SUMMARY of a chained roll inside its usage card: a save rolled against the card is
   * drawn here and its own card hidden (client setting `chatCardSummary`), so rows on such a roll
   * draw here too (ui.js `cardRow`).
   */
  cardSummary: ".card-summary[data-message-id]",
  /**
   * The ROW dnd5e draws inside that summary for a save; the verdict's tail is written beside its
   * total (saves/views.js).
   */
  summaryRow: ".save-summary",
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
  dialogFooter: "footer, .form-footer",
  /** A roll card's header title — the LIVE item's name, so a swing's own label is drawn here
   * (hew.js — "Quarterstaff — Pole Strike"). */
  cardHeaderTitle: ".card-header .name-stacked .title",
  /** A roll card's header — the attack's cover row is drawn directly under it. */
  cardHeader: ".card-header",
  /** A card's listed activity row (chat/parts/card-activities.hbs) — the rest card lists a feat's
   * rest-period activities here; rest-grants.js drops the ones its own after-rest popup gives. */
  cardActivityRow: ".activities li.activity[data-activity-uuid]"
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
  cardSummary: { where: "dnd5e", file: "templates/chat/usage-card.hbs", proof: 'class="card-summary" data-message-id' },
  summaryRow: { where: "dnd5e", file: "templates/chat/save-summary.hbs", proof: 'class="icon-row save-summary' },
  dialogConfiguration: { where: "dnd5e", file: "dnd5e.mjs", proof: 'configuration: { template: "systems/dnd5e/templates/dice/roll-configuration.hbs"' },
  dialogButtons: { where: "dnd5e", file: "dnd5e.mjs", proof: 'buttons: { template: "systems/dnd5e/templates/dice/roll-buttons.hbs"' },
  dialogDefault: { where: "dnd5e", file: "templates/dice/roll-buttons.hbs", proof: "autofocus" },
  dialogRoll: { where: "dnd5e", file: "templates/dice/roll-buttons.hbs", proof: 'data-action="{{ @key }}"' },
  dialogFooter: { where: "dnd5e", file: "dnd5e.mjs", proof: 'class ActivityUsageDialog extends Dialog5e' },
  cardHeaderTitle: { where: "dnd5e", file: "templates/chat/parts/card-header.hbs", proof: '<span class="title">{{ item.name }}</span>' },
  cardHeader: { where: "dnd5e", file: "templates/chat/parts/card-header.hbs", proof: '<section class="card-header no-description">' },
  cardActivityRow: { where: "dnd5e", file: "templates/chat/parts/card-activities.hbs", proof: '<li class="activity flexrow item-tooltip" data-activity-uuid="{{ uuid }}"' }
});
