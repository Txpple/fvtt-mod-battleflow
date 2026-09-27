/**
 * Battle Flow — CORE (ARCHITECTURE.md §7, a leaf beside core.js): THE SURFACES MAP — every anchor
 * read off the PLATFORM's markup, which is not API (NOTES §2 *the 6.0 pass*). Prefer data.
 * `tools/check-surfaces.mjs` fails the build on a platform selector elsewhere or an anchor missing
 * from dnd5e's templates. ⚠ Imports nothing; `core` anchors are listed, not checked.
 */

export const SURFACES = Object.freeze({
  messageContent: ".message-content",
  messageId: "[data-message-id]",
  formGroup: ".form-group",
  damageTray: "damage-application",
  /** A save rolled against a usage card is drawn in its summary (`chatCardSummary`); rows go there too. */
  cardSummary: ".card-summary[data-message-id]",
  summaryRow: ".save-summary",
  dialogConfiguration: '[data-application-part="configuration"]',
  dialogButtons: '[data-application-part="buttons"]',
  /** The button the platform autofocuses. */
  dialogDefault: "button[autofocus]",
  dialogRoll: 'button[data-action="roll"]',
  /** The usage dialog's footer: Dialog5e renders core's generic form footer. */
  dialogFooter: "footer, .form-footer",
  /** The LIVE item's name; a swing's own label is drawn here (hew.js). */
  cardHeaderTitle: ".card-header .name-stacked .title",
  cardHeader: ".card-header",
  cardActivityRow: ".activities li.activity[data-activity-uuid]"
});

/**
 * Where each anchor is authored, for the gate: `proof` must appear in `file` (relative to a
 * `systems/dnd5e` install); `core` rows are reported, not checked.
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
