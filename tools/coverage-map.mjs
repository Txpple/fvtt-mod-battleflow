/**
 * THE COVERAGE MAP — which live suite exercises which machine, and what a change has to re-run.
 *
 *   loadCoverageMap()          Map<suite, covers[]>, read statically off every ORDER suite
 *   isSpine(file) / tierOf()   the tier map's answer (tools/check-layers.mjs holds the map)
 *   suitesFor(changed)         the ORDER rows a change selects, needs pulled, canonical order
 *   planFor(changed)           the same, with the reason per row and the files that ran nothing
 *
 * Each suite DECLARES the machine-tier files it drives (`const COVERS = [...]`); a claim means "a
 * change there should re-run me", deliberately generous. ⚠ A SPINE CHANGE IS THE FULL BATTERY:
 * nearly every machine imports the spine, so no smaller set tests it.
 * ⚠ Suites connect on import, so COVERS is PARSED from source text, strictly and loudly.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { edgesOf, jsFiles, LAYER_OF, SCRIPTS, toPosix } from "./check-layers.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));

/**
 * The canonical order. ⚠ `smoke-battleflow` then `smoke-hold` are ADJACENT ON PURPOSE. A `reset`
 * row is a seed or sweep some suite needs; it asserts nothing. `needs` resolves to the NEAREST row
 * of that name ABOVE the suite, and asking for the suite pulls it.
 */
export const ORDER = [
  // ⚠ FIRST, before anything measures a distance: a killed run's linked strays are swept.
  { name: "reset-fixture-state", note: "not a suite — sweeps a killed run's linked strays before anything measures distance", reset: true },
  { name: "smoke-battleflow", note: "the Phase 1 chain + the player-damage offer (§5d)" },
  {
    name: "smoke-hold", note: "⚠ MUST follow smoke-battleflow immediately — it rides its tokens",
    needs: ["smoke-battleflow"]
  },
  { name: "smoke-saves", note: "the save machine + the save-path damage offer (§18)" },
  { name: "smoke-volleys", note: "the volley folds — darts aimed by hand, rays as real attacks, the gate at the aim" },
  { name: "smoke-maneuvers", note: "the slowest — nine fold groups" },
  // ⚠ Right after smoke-maneuvers (same family); its §2 SPENDS the fixtures it asserts on, so the
  // seed is a battery step — a red for an empty resource pool is a broken gauge.
  { name: "fixture-d20-folds", note: "not a suite — the seed smoke-d20-folds spends", reset: true },
  {
    name: "smoke-d20-folds", note: "the three d20 folds — its own seed runs immediately above",
    needs: ["fixture-d20-folds"]
  },
  { name: "smoke-cast", note: "the cast slice — a utility cast's effects, a heal's dice, the exclusions" },
  { name: "smoke-riders", note: "the hit riders — a mark pays out only for the creature that placed it" },
  { name: "smoke-concentration", note: "the concentration assist — damage, ask, roll, verdict, break" },
  { name: "smoke-twoclient", note: "⚠ TWO clients — the relay's relayed half and D2's popup close" },
  { name: "check-popup-routing", note: "two clients, read-only — popups route to whoever decides" },
  { name: "reset-fixture-state", note: "not a suite — the sweep smoke-effects needs", reset: true },
  {
    name: "smoke-effects", note: "⚠ re-run before diagnosing: the documented dice-variance class",
    needs: ["reset-fixture-state"]
  },
  // ⚠ Right after smoke-effects: the same chips, expired by Foundry's own clock through real rounds.
  { name: "smoke-expiry", note: "the platform's clock on the chips, the spend, the cleave chit" },
  { name: "smoke-reminders", note: "the gate before the roll — every source, the net, the press" },
  { name: "smoke-sneak", note: "Sneak Attack as drawn — the tick, the menu, the dice, the crit, the chit, the effects" },
  { name: "smoke-clock", note: "the clock riders — Dreadful Strike once per turn with its uses, Assassinate on round one, the list as the switch" },
  // Beside smoke-sneak and smoke-clock: the same seam (preRollDamage) on the built fighter fixture.
  { name: "smoke-hitmenu", note: "the hit menu — the Battle Master's maneuvers on the damage offer: one pick, the die rides, the pool spent, the save through the machine, the sweep at a second creature" },
  // The same seam from the DEFENDER's side (the shields), and a bare damage cast's dice (Heat Metal).
  { name: "smoke-shields", note: "the damage shields — Fire Shield's type by its effect, Death Armor walked to its caster and once per turn, Armor of Agathys marked at the cast and ended with its pool, the reach, the list" },
  { name: "smoke-heatmetal", note: "the damage casts — Heat Metal's dice roll at the use and land, the save follows through the machine, Heated Metal read by both gates, the reheat, the list" },
  { name: "smoke-superiority", note: "the rest of the Battle Master's maneuvers — Parry's reduction on the hold, the four Bonus Action uses, Ambush and Tactical Assessment as scoped folds, Commander's Strike as a driven attack, Rally natively" },
  // ⚠ Before smoke-surfaces: it places a real template and Regions, deleted in its `finally`. The
  // seed re-places the Victim token smoke-effects sweeps off.
  { name: "fixture-suite", note: "not a suite — re-places the tokens smoke-metamagic and smoke-emanations need", reset: true },
  // Needs every fixture token standing (Sorcerer, goblins, Ranger), so it runs on the fresh placement.
  {
    name: "smoke-metamagic", note: "metamagic — the group in the casting window, the spend by hand, Careful's protected leaving the demand, Heightened's mark on the save gate, Distant / Extended / Transmuted / Twinned, Empowered on the dice, Seeking on the miss",
    needs: ["fixture-suite"]
  },
  {
    name: "smoke-emanations", note: "the emanations — the Paladin's aura stands with its token, applies to allies inside, lifts on exit; Spirit Guardians adopted, its saves on enter and turn end",
    needs: ["fixture-suite"]
  },
  // Both ride BF Test Halfling (Lucky, Savage Attacker); the nearest seed above is theirs.
  {
    name: "smoke-rescue", note: "the `roll` interrupt — Lucky, Warding Flare, Shadowy Dodge bend the hit: the popup's rows, the second d20, the crit undone, all-spent skips",
    needs: ["fixture-suite"]
  },
  {
    name: "smoke-savage", note: "Savage Attacker — the popup on a weapon hit, the set rolled again, the higher standing, the damage waiting, once per turn, the hold first",
    needs: ["fixture-suite"]
  },
  // BF Test Halfling is lent Celestial Revelation, Light and Sacred Flame, beside the Victim and Ranger.
  {
    name: "smoke-aasimar", note: "Celestial Revelation and the token lights — a self area placed on the token, an enemy area asking no ally, the `while` ring and its turn-end pulse, the form's rider on a hit and on a spell's one target, Light on a targeted token",
    needs: ["fixture-suite"]
  },
  // BF Test Goliath is lent Storm's Thunder and Large Form, beside the Victim.
  {
    name: "smoke-goliath", note: "the Goliath walk's pass 2 — Large Form's token size, the rebuke offered within its reach and driven at the damager (none out of reach), Stone's Endurance holding a non-attack damage at the applier",
    needs: ["fixture-suite"]
  },
  // BF Test Halfling is lent Relentless Endurance (and Death Ward's effect).
  {
    name: "smoke-drop", note: "drop to 1 HP — Relentless Endurance held at 1 and asked (Drop to 1 spends the use, Drop to 0 lands the 0), none when killed outright; Death Ward automatic, its effect removed",
    needs: ["fixture-suite"]
  },
  // BF Test Halfling is lent the PHB's Alert; its own combats and tokens.
  {
    name: "smoke-alert", note: "the Initiative swap — Alert asked once every combatant has an Initiative, the non-Incapacitated allies listed with theirs, Swap exchanging the two in the tracker; once per combat, No, the clock, the list",
    needs: ["fixture-suite"]
  },
  // BF Test Cleric is lent the PHB's Heroism and Hold Person; BF Test Victim wears their effects.
  {
    name: "smoke-spells", note: "the spells slice — Heroism's temp HP at the bearer's turn start; the repeating save: Hold Person's Paralyzed demanded at the bearer's turn end, a success removing it through the cast's receipt with the card line, a failure keeping it; a damaged trigger; the action offer",
    needs: ["fixture-suite"]
  },
  // BF Test Monster is lent the Monster Manual's traits by name; the Victim's own token beside it.
  {
    name: "smoke-monsters", note: "the Monster Manual's waiting rows — a monster's own activity repeating at the target's turn end and the petrifying escalation; the grappled target's damage at its own turn start or end; the grappler's own turn start",
    needs: ["fixture-suite"]
  },
  // BF Test Cleric is lent Sanctuary and Sacred Flame, BF Test Sorcerer Mirror Image; BF Test Attacker swings.
  {
    name: "smoke-wards", note: "the spells slice's Tier 3 — Sanctuary's gate before the attack roll and before a damaging spell's cast (the save demanded of the attacker; a failure turns it aside, a success makes the use again; the ward ends on its bearer's own attack), and Mirror Image's duplicates rolled on a hit that stands (a duplicate destroyed, the hit absorbed; the hit through; the last one ends it; Blindsight sees through)",
    needs: ["fixture-suite"]
  },
  // BF Test Cleric is lent the PHB's Healer and Cure Wounds.
  {
    name: "smoke-heal", note: "the healing rerolls — Healer's 1s on a healing spell and on Battle Medic (its own r1 taken off): rerolled automatically as the dice land (since 2026-09-26), the healing waiting for the new dice and landing once; none, the list, the kit's tending",
    needs: ["fixture-suite"]
  },
  // BF Test Halfling is lent the PHB's Resourceful.
  {
    name: "smoke-rest", note: "the rest grants — Resourceful's Heroic Inspiration on a Long Rest (the box ticked, the rest card's line), nothing on a Short Rest, nothing when unlisted; Musician's song — the allies within 30 ft asked after a Short or Long Rest, the inspired greyed, OK gives it",
    needs: ["fixture-suite"]
  },
  // BF Test Halfling's own Lucky: the gate's buy box and the `advantage` fold on a dialog-less initiative.
  {
    name: "smoke-lucky", note: "Lucky's Advantage half — the buy box in an attack, save, check and initiative dialog (the tick in the net, the spend, the record, none left greyed) and the no-dialog initiative fold (the higher d20 stands)",
    needs: ["fixture-suite"]
  },
  // BF Test Fighter is lent the PHB's six styles and its gear; the float over BF Test Victim's own token.
  {
    name: "smoke-damage-rules", note: "the fighting styles — the faces off the equipped boxes (Defense's AC, Dueling's second weapon), Great Weapon Fighting's floor, Thrown's and Dueling's +2, Two-Weapon's modifier, Unarmed Fighting's die, the line, the record, the float, the list",
    needs: ["fixture-suite"]
  },
  // Protection and Interception answering for the creature beside them; three tokens placed and removed.
  {
    name: "smoke-guards", note: "the guards — Protection's popup beside the defender's own (P1), the bent roll and the card naming the guard, \"Protected — <guard>\" and the gate's Disadvantage within 5 ft; Interception's claim on the attack's damage, the reduction, the pass",
    needs: ["fixture-suite"]
  },
  // Session 0's classes: BF Test Bard lent Cutting Words, BF Test Sorcerer Restore Balance; four tokens placed and removed.
  {
    name: "smoke-classes", note: "the PHB classes — §A3 the bystander's bend on a hit: the margin gate, the popup, the quiet road off the damage, Restore Balance's first d20, the reach, \"Not this combat\" and its sweep",
    needs: ["fixture-suite"]
  },
  // The splat books: Ravenloft's Survivor against the Fighter's rows, Arcane Shot's group, the Bloodied rebuke, Instinctive Charm, Ever-Ready Shot.
  {
    name: "smoke-splat", note: "the splat books — the Survivor collision (no Heroic Rally, no Defy Death on a feat), Arcane Shot's group and its one turn chit, Harvest Undead on becoming Bloodied, Instinctive Charm's save at the attacker, Ever-Ready Shot's one use back",
    needs: ["fixture-suite"]
  },
  // ⚠ ITS OWN SEED: the probe reads the fixture tokens, which smoke-metamagic and smoke-emanations
  // move and sweep; the seed runs only when the probe is selected.
  { name: "fixture-suite", note: "not a suite — re-places the tokens probe-effect-view needs", reset: true },
  {
    name: "probe-effect-view", note: "the effect view — the bar, the hover card, the held key, the fold",
    needs: ["fixture-suite"]
  },
  { name: "smoke-resources", note: "the resource notices — the flash, the card line, the silences, the spend stamp" },
  // ⚠ LAST because of what it CREATES: a real MeasuredTemplate would join smoke-saves' containment
  // arithmetic. It deletes its own in a `finally`.
  { name: "smoke-surfaces", note: "the three surfaces nothing else opens — settings, usage dialog, templates" },
  // ⚠ LAST, AFTER smoke-surfaces: it must find NO ACTIVE GM and refuses to run if it sees one.
  // A failed preflight here is almost always a lingering session from an earlier suite; re-run it alone.
  // ⚠ Its seed is a battery step: it needs the victim TOKEN and a player client cannot place one.
  { name: "fixture-suite", note: "not a suite — re-places the tokens smoke-nogm needs", reset: true },
  {
    name: "smoke-nogm", note: "⚠ NO GM — the flow elect; must run with every other client hung up",
    needs: ["fixture-suite"]
  }
];

/* --- the tiers ----------------------------------------------------------------------------- */

/** The one tier a suite claims. */
const MACHINE_TIER = "machines";
/** The tiers a change is WALKED up from (few importers: the machines importing them name the suites). */
const WALKED_TIERS = new Set(["decision", "registry"]);
/**
 * The tiers whose change is the FULL battery: every tier in check-layers.mjs's DEPTH neither
 * claimed nor walked, so a new tier defaults to the full battery.
 */
export const SPINE_TIERS = new Set(
  [...new Set(Object.values(LAYER_OF))].filter(t => (t !== MACHINE_TIER) && !WALKED_TIERS.has(t))
);

/** A path as the tier map keys it: scripts-relative, posix. Accepts the path with or without the `scripts/` prefix. */
const scriptsRel = file => toPosix(String(file)).replace(/^\.?\/?scripts\//, "");

/** The tier `check-layers.mjs` declares for a scripts file, or undefined for an undeclared one. */
export const tierOf = file => LAYER_OF[scriptsRel(file)];
/** A MACHINE-tier file — the only kind a suite claims. */
export const isMachine = file => tierOf(file) === MACHINE_TIER;
/** A file whose change is the full battery: core, spine, services or entry. */
export const isSpine = file => SPINE_TIERS.has(tierOf(file));

/* --- the claims ---------------------------------------------------------------------------- */

/**
 * The `[export] const COVERS = [ ... ]` literal out of a suite's SOURCE TEXT, or null when absent.
 * ⚠ Strict: string literals, commas and comments only — anything else throws, since a loose parse
 * would read an unseen claim as empty.
 */
export function parseCovers(src) {
  const heads = [...src.matchAll(/^(?:export\s+)?const\s+COVERS\s*=\s*\[/gm)];
  if (!heads.length) return null;
  if (heads.length > 1) throw new Error("declares COVERS more than once");
  const open = heads[0].index + heads[0][0].length;
  const close = src.indexOf("];", open);
  if (close < 0) throw new Error("COVERS has no closing `];`");
  const body = src.slice(open, close)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const out = [];
  const rest = body.replace(/(["'])([^"'\n]*)\1/g, (_m, _q, path) => {
    out.push(path);
    return "";
  });
  if (rest.replace(/[\s,]/g, "") !== "") {
    throw new Error(`COVERS holds something that is not a string literal: "${rest.replace(/\s+/g, " ").trim()}"`);
  }
  return out;
}

/** The ORDER rows that are real suites, each name once. */
export const suiteRows = (order = ORDER) => order.filter(r => !r.reset);

/** Where a battery entry's script lives. */
export const suiteFile = name => join(TOOLS, `${name}.mjs`);

/**
 * Every ORDER suite's claims, read off its source. ⚠ THROWS on a missing or unparseable COVERS;
 * the verify check calls `parseCovers` itself to collect findings.
 */
export function loadCoverageMap(order = ORDER, read = file => readFileSync(file, "utf8")) {
  const map = new Map();
  for (const { name } of suiteRows(order)) {
    let covers;
    try {
      covers = parseCovers(read(suiteFile(name)));
    } catch (err) {
      throw new Error(`coverage map: tools/${name}.mjs — ${err.message}`);
    }
    if (!covers) {
      throw new Error(`coverage map: tools/${name}.mjs declares no COVERS — every battery suite `
        + "says which machines it exercises (tools/README.md, the coverage map)");
    }
    map.set(name, covers);
  }
  return map;
}

/* --- the graph ----------------------------------------------------------------------------- */

/** Who imports each scripts file — check-layers.mjs's own edge reader, turned around. */
export function importerIndex() {
  const index = new Map();
  for (const path of jsFiles(SCRIPTS)) {
    for (const e of edgesOf(path)) {
      if (!index.has(e.to)) index.set(e.to, new Set());
      index.get(e.to).add(e.from);
    }
  }
  return index;
}

/** The real repo's context: the order, the claims, the tier map, the import graph. */
export function defaultContext() {
  const index = importerIndex();
  return {
    order: ORDER,
    covers: loadCoverageMap(),
    tierOf,
    importersOf: rel => [...(index.get(rel) ?? [])]
  };
}

/**
 * Walk UP from a walked-tier file to the machines that import it. Stops at a machine (its change is
 * its claimants) and reports every spine importer met — that makes it the full battery.
 */
function walkUp(start, ctx) {
  const machines = new Map();   // machine → the walked-tier files between it and the start
  const spine = [];
  const seen = new Set([start]);
  const queue = [[start, []]];
  while (queue.length) {
    const [file, via] = queue.shift();
    for (const imp of [...ctx.importersOf(file)].sort()) {
      if (seen.has(imp)) continue;
      seen.add(imp);
      const tier = ctx.tierOf(imp);
      if (tier === MACHINE_TIER) machines.set(imp, via);
      else if (WALKED_TIERS.has(tier)) queue.push([imp, [...via, imp]]);
      else spine.push({ file: imp, tier: tier ?? "undeclared" });
    }
  }
  return { machines, spine };
}

/** The tools whose change moves EVERY suite: the harness, the target, the battery and this map. */
const SELECTOR_TOOLS = new Set(["harness.mjs", "target.mjs", "battery.mjs", "coverage-map.mjs"]);

/**
 * Pull every selected row's needs, recursively: a need is the NEAREST row of that name above the
 * row that needs it. `picked` is Map<index, why[]>; it is extended in place and returned.
 */
export function withNeeds(order, picked) {
  const queue = [...picked.keys()];
  while (queue.length) {
    const at = queue.shift();
    for (const need of order[at].needs ?? []) {
      let j = at - 1;
      while ((j >= 0) && (order[j].name !== need)) j--;
      if (j < 0) throw new Error(`ORDER: ${order[at].name} needs ${need}, and no ${need} row stands above it`);
      const why = `pulled — ${order[at].name} needs it`;
      if (!picked.has(j)) {
        picked.set(j, [why]);
        queue.push(j);
      } else if (!picked.get(j).includes(why)) picked.get(j).push(why);
    }
  }
  return picked;
}

/** A picked index map as ORDER rows, canonical order, each carrying its reasons. */
const rowsOf = (order, picked) => [...picked.keys()].sort((a, b) => a - b)
  .map(at => ({ ...order[at], at, why: picked.get(at) }));

/**
 * The rows the named suites select, needs pulled — the positionals' and `--from`'s road.
 * Unknown names throw; a seed named directly runs alone (it is what was asked for).
 */
export function rowsFor(names, order = ORDER, why = "asked for") {
  const picked = new Map();
  for (const name of names) {
    const at = order.findIndex(r => r.name === name);
    if (at < 0) throw new Error(`no such suite: ${name}`);
    picked.set(at, [why]);
  }
  return rowsOf(order, withNeeds(order, picked));
}

/**
 * Every row from ORDER index `at` on, plus whatever those rows need from ABOVE the cut —
 * `--from`'s road. Rows are picked by INDEX, never by name: `fixture-suite` stands three times.
 */
export function rowsFrom(at, order = ORDER) {
  const picked = new Map(order.slice(at).map((_r, i) => [at + i, ["resumed"]]));
  return rowsOf(order, withNeeds(order, picked));
}

/**
 * What a set of changed files (repo-relative) has to re-run: `{ rows, full, inert }` — the ORDER rows
 * with `why`, the reasons for a full battery (empty when not), and the files that select nothing.
 *
 *   (a) a MACHINE under scripts/ selects every suite claiming it;
 *   (b) a decide/ or registry file selects the claimants of each machine importing it, walked
 *       upward — and the FULL battery if a spine file imports it on the way;
 *   (c) a core / spine / services / entry file, or one the tier map does not know: full battery;
 *   (d) a battery suite selects itself; a seed selects the suites needing it; the harness, target,
 *       battery and this map are the full battery; any other tool is inert;
 *   (e) everything else is inert, except module.json.
 */
export function planFor(changed, ctx = defaultContext()) {
  const { order, covers } = ctx;
  const picked = new Map();
  const full = [];
  const inert = [];
  const pick = (name, why) => {
    const at = order.findIndex(r => (r.name === name) && !r.reset);
    if (at < 0) return false;
    if (!picked.has(at)) picked.set(at, []);
    if (!picked.get(at).includes(why)) picked.get(at).push(why);
    return true;
  };
  const claimants = rel => [...covers].filter(([, list]) => list.includes(rel)).map(([name]) => name);

  for (const raw of [...new Set(changed.map(f => toPosix(String(f).trim())).filter(Boolean))].sort()) {
    const file = raw.replace(/^\.\//, "");
    if (file.startsWith("scripts/")) {
      const rel = file.slice("scripts/".length);
      const tier = ctx.tierOf(rel);
      if (tier === MACHINE_TIER) {
        const names = claimants(rel);
        if (!names.length) {
          full.push(`${file} is a machine no suite claims (npm run coverage fails on it) — the full battery until one does`);
        }
        for (const n of names) pick(n, `claims ${rel} (changed)`);
      } else if (WALKED_TIERS.has(tier)) {
        const { machines, spine } = walkUp(rel, ctx);
        if (spine.length) {
          full.push(`${file} is imported by the spine (${spine.map(s => `${s.file}, ${s.tier}`).join("; ")}) — a spine change is the full battery`);
          continue;
        }
        let any = false;
        for (const [machine, via] of machines) {
          const path = [machine, ...via.slice().reverse()].join(" ← ");
          for (const n of claimants(machine)) any = pick(n, `claims ${path} ← ${rel} (changed)`) || any;
        }
        if (!any) inert.push({ file, why: machines.size ? "its importers are claimed by no suite" : "imported by no machine — the unit tests are its tier" });
      } else if (tier === undefined) {
        full.push(`${file} has no tier in check-layers.mjs (npm run layers fails on it too) — the full battery until it is declared`);
      } else {
        full.push(`${file} is ${tier} — imported broadly, so a change there is the full battery`);
      }
    } else if (file.startsWith("tools/")) {
      const base = file.slice("tools/".length);
      const name = base.replace(/\.mjs$/, "");
      if (base.includes("/")) {
        inert.push({ file, why: "a tool, not a battery suite" });
      } else if (SELECTOR_TOOLS.has(base)) {
        full.push(`${file} moves every suite (or the choosing of them) — the full battery`);
      } else if (pick(name, "the suite itself changed")) {
        // (d) a battery suite
      } else if (order.some(r => r.reset && (r.name === name))) {
        const needers = order.filter(r => !r.reset && (r.needs ?? []).includes(name));
        for (const r of needers) pick(r.name, `needs ${name}, which changed`);
        if (!needers.length) inert.push({ file, why: "a seed no suite declares a need for" });
      } else {
        inert.push({ file, why: /^(smoke|probe)-/.test(name) ? "not in the battery's ORDER — run it by hand" : "a tool, not a battery suite" });
      }
    } else if (file === "module.json") {
      // ⚠ The platform LOADS the manifest (esmodules, RegionBehavior types, the dnd5e window), and a
      // version bump cannot be told from a type change.
      full.push("module.json is the manifest the platform loads — the full battery");
    } else {
      inert.push({ file, why: "outside scripts/ and tools/ — nothing live to run" });
    }
  }

  if (full.length) {
    const all = new Map(order.map((_r, at) => [at, ["full battery"]]));
    return { rows: rowsOf(order, all), full, inert };
  }
  return { rows: rowsOf(order, withNeeds(order, picked)), full, inert };
}

/** The ORDER rows a set of changed files selects, needs pulled, in canonical order. */
export const suitesFor = (changed, ctx = defaultContext()) => planFor(changed, ctx).rows;

/* --- the structural checks the verify gate runs --------------------------------------------- */

/** Every problem with ORDER's own shape: a need with nothing above it, a suite named twice. */
export function orderProblems(order = ORDER) {
  const out = [];
  const seen = new Set();
  for (const [at, r] of order.entries()) {
    if (!r.reset) {
      if (seen.has(r.name)) out.push(`ORDER lists the suite ${r.name} twice`);
      seen.add(r.name);
    }
    for (const need of r.needs ?? []) {
      if (!order.slice(0, at).some(x => x.name === need)) {
        out.push(`ORDER: ${r.name} needs ${need}, and no ${need} row stands above it`);
      }
    }
  }
  return out;
}

/** Every tools/ file that declares COVERS, by suite name — for the unrun-suite check. */
export function declaringTools() {
  return readdirSync(TOOLS)
    .filter(f => f.endsWith(".mjs"))
    .filter(f => /^(?:export\s+)?const\s+COVERS\s*=/m.test(readFileSync(join(TOOLS, f), "utf8")))
    .map(f => f.replace(/\.mjs$/, ""));
}

/** Every machine-tier file that exists under scripts/, scripts-relative. */
export function machineFiles() {
  return jsFiles(SCRIPTS).map(p => toPosix(relative(SCRIPTS, p)))
    .filter(rel => LAYER_OF[rel] === MACHINE_TIER).sort();
}

/** Whether a scripts-relative file exists. */
export const scriptExists = rel => existsSync(join(SCRIPTS, rel));
