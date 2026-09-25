/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): THE REST GRANTS — a feature whose text gives
 * the creature something "whenever you finish a Long Rest" that the platform does not give it
 * (decide/registry.js REST_GRANTS; Resourceful the first row: Heroic Inspiration). The Human walk,
 * 2026-09-25 (user: "human i think just needs initiatve to be ticked on long rest" — the sheet's
 * Heroic Inspiration box; the pack's own note: "Usage of this feature's activity does not
 * automatically grant Heroic Inspiration").
 *
 * THE SEAM: `dnd5e.preRestCompleted` — the rest's result is computed and its ONE actor update not
 * yet made, so the grant rides that update (`result.updateData`), landing with the hit points and
 * the uses it restores. The rest card then says what was gained (`dnd5e.restCompleted`, the card
 * made; the line reads the stamp).
 *
 * WHERE IT RUNS: the resting client — the rest runs where it was asked (the sheet, the GM's Rest
 * request), and the result is that client's. Nothing is asked: the feature's text grants it.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { lower } from "./lookup.js";
import { listedNames, restGrantEntries } from "./settings.js";
import { bfCard } from "./decide/present.js";
import { REST_GRANTS } from "./decide/registry.js";
import { SURFACES } from "./surfaces.js";

/** What a grant writes, by its `grant` word — the sheet facts the table knows how to set. */
const GRANT_WRITES = {
  inspiration: actor => ((actor.type === "character") && (actor.system?.attributes?.inspiration !== true))
    ? { "system.attributes.inspiration": true } : null
};

/** What a grant is called on the card. */
const GRANT_LABEL = { inspiration: "Heroic Inspiration" };

/** The listed rows this actor's sheet holds for this rest, with the write each one makes (nothing already had). */
function grantsFor(actor, restType) {
  const on = listedNames(restGrantEntries());
  const out = [];
  for ( const [name, row] of Object.entries(REST_GRANTS) ) {
    if ( !on.has(lower(name)) || !row.rests.includes(restType) ) continue;
    if ( !actor.items.some(i => (i.type === "feat") && (lower(i.name) === lower(name))) ) continue;
    const write = GRANT_WRITES[row.grant]?.(actor);
    if ( write ) out.push({ name, grant: row.grant, write });
  }
  return out;
}

Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !result?.updateData ) return;
    const grants = grantsFor(actor, result.type ?? config?.type ?? "long");
    if ( !grants.length ) return;
    for ( const g of grants ) foundry.utils.mergeObject(result.updateData, g.write);
    result.bfRestGrants = grants.map(({ name, grant }) => ({ name, grant }));
  } catch(err) {
    console.error(`${TITLE} | Rest grant failed — the rest goes on without it.`, err);
  }
});

// The rest card says what was gained — stamped once the card exists.
Hooks.on("dnd5e.restCompleted", (actor, result) => {
  const grants = result?.bfRestGrants;
  const message = result?.message;
  if ( !grants?.length || !message?.isOwner ) return;
  void message.setFlag(MODULE_ID, "restGrant", grants)
    .catch(err => console.error(`${TITLE} | Rest grant line failed.`, err));
});

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const grants = message.getFlag(MODULE_ID, "restGrant");
    if ( !grants?.length ) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const host = root?.querySelector(SURFACES.messageContent);
    if ( !host || host.querySelector("[data-bf-rest-grant]") ) return;
    for ( const g of grants ) {
      const line = document.createElement("div");
      line.setAttribute("data-bf-rest-grant", "");
      line.innerHTML = bfCard({ eyebrow: g.name, tone: "good", title: `${GRANT_LABEL[g.grant] ?? g.grant} gained` });
      host.appendChild(line);
    }
  } catch(err) {
    console.error(`${TITLE} | Rest grant line failed to draw.`, err);
  }
});
