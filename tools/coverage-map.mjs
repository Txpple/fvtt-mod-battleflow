/**
 * THE COVERAGE MAP — which live suite exercises which machine, and what a change has to re-run.
 *
 *   loadCoverageMap()          Map<suite, covers[]>, read statically off every ORDER suite
 *   isSpine(file) / tierOf()   the tier map's answer (tools/check-layers.mjs holds the map)
 *   suitesFor(changed)         the ORDER rows a change selects, needs pulled, canonical order
 *   planFor(changed)           the same, with the reason per row and the files that ran nothing
 *
 * ⚠ WHY THIS EXISTS (user ruling 2026-09-23, change-scoped live testing). A two-file change ran
 * the whole battery — 29 entries, 51 minutes — because nothing in the tree could say which
 * suites a file's behaviour lives in. Now each suite DECLARES it (`const COVERS = [...]` beside
 * its `SECTIONS`/`DEPENDS` head), `tools/check-coverage-map.mjs` checks the declaration BOTH
 * WAYS in the verify gate (every machine claimed by some suite, every claim naming a machine
 * that exists), and `battery.mjs --changed` runs what the claims select.
 *
 * WHAT A CLAIM MEANS: "this suite drives that file's behaviour — a change there should re-run
 * me". It is judgment, written from the suite's own header and sections, and deliberately
 * generous. Only MACHINE-tier files are claimed. ⚠ **A SPINE CHANGE IS THE FULL BATTERY,
 * HONESTLY**: the core, spine, services and entry tiers are imported by nearly every machine,
 * so there is no smaller set that tests them, and pretending otherwise is the cheap cut.
 *
 * ⚠ THE SUITES EXECUTE ON IMPORT (they connect to a live world at module evaluation), so the
 * map is PARSED out of their source text, never imported. The parse is strict and fails loudly:
 * a suite with no COVERS is a suite whose change-scope nobody decided.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { edgesOf, jsFiles, LAYER_OF, SCRIPTS, toPosix } from "./check-layers.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));

/**
 * The canonical order. ⚠ `smoke-battleflow` then `smoke-hold` are ADJACENT ON PURPOSE and
 * nothing may be inserted between them. A `reset` row is not a suite — it is a seed or a sweep
 * some suite needs, and it asserts nothing.
 *
 * `needs` names the rows a suite cannot run without. A need resolves to the NEAREST row of that
 * name ABOVE the suite — which is how the three `fixture-suite` seeds each serve the suites below
 * them — and asking for the suite (a positional, `--from`, `--changed`) pulls it and says why.
 * It replaced the hard-coded "smoke-hold rides smoke-battleflow — ask for both" refusal
 * (2026-09-23): the battery knows the dependency, so it runs it rather than naming it.
 */
export const ORDER = [
  // ⚠ FIRST, before anything measures a distance: a killed run's linked strays are swept
  // (2026-09-24 — a battery killed inside smoke-hitmenu poisoned the next two).
  { name: "reset-fixture-state", note: "not a suite — sweeps a killed run's linked strays before anything measures distance", reset: true },
  { name: "smoke-battleflow", note: "the Phase 1 chain + the player-damage offer (§5d)" },
  {
    name: "smoke-hold", note: "⚠ MUST follow smoke-battleflow immediately — it rides its tokens",
    needs: ["smoke-battleflow"]
  },
  { name: "smoke-saves", note: "the save machine + the save-path damage offer (§18)" },
  { name: "smoke-volleys", note: "the volley folds — darts aimed by hand, rays as real attacks, the gate at the aim" },
  { name: "smoke-maneuvers", note: "the slowest — nine fold groups" },
  // ⚠ Immediately after smoke-maneuvers because it is the same family (post-roll folds), and
  // its section 2 SPENDS the fixtures it asserts on — it re-seeds nothing, so anything that
  // wanted a Fighter with two Second Wind uses must run before it or re-run the fixture script.
  //
  // ⚠ WHICH IS WHY THE SEED IS A BATTERY STEP NOW (2026-08-23). It was prose in the note below
  // and the battery did not act on it, so a battery run inherited whatever the LAST run left:
  // `heroic` alone would be offered, section 5's "every eligible fold is offered" would go red,
  // and the summary would report a FAILED suite for an empty resource pool. Measured this way
  // once — 20/21, and 21/21 on the same code the moment the fixture was re-seeded, with the
  // assertion flipping from `offers=[heroic]` to `offers=[heroic, tactical]` and Second Wind
  // reading `2 → 1` instead of `1 → 0`. **A front door that reports a red for a missing seed
  // is a broken gauge**, and the diagnosis cost a full battery to reach.
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
  // ⚠ Directly after smoke-effects — the same family (the mastery chips), and the one suite that
  // steps a real Combat through rounds to watch Foundry's own clock expire them (2026-09-01).
  { name: "smoke-expiry", note: "the platform's clock on the chips, the spend, the cleave chit" },
  { name: "smoke-reminders", note: "the gate before the roll — every source, the net, the press" },
  { name: "smoke-sneak", note: "Sneak Attack as drawn — the tick, the menu, the dice, the crit, the chit, the effects" },
  { name: "smoke-clock", note: "the clock riders — Dreadful Strike once per turn with its uses, Assassinate on round one, the list as the switch" },
  // Beside smoke-sneak and smoke-clock: the same seam (the offer's contributions, preRollDamageV2) on the CLONED fighter fixture (2026-09-04).
  { name: "smoke-hitmenu", note: "the hit menu — the Battle Master's maneuvers on the damage offer: one pick, the die rides, the pool spent, the save through the machine, the sweep at a second creature" },
  // The overnight commissions (2026-09-04): the same seam again — the attack's damage landing —
  // read from the DEFENDER's side (the shields), and a bare damage cast's dice (Heat Metal).
  { name: "smoke-shields", note: "the damage shields — Fire Shield's type by its effect, Death Armor walked to its caster and once per turn, Armor of Agathys marked at the cast and ended with its pool, the reach, the list" },
  { name: "smoke-heatmetal", note: "the damage casts — Heat Metal's dice roll at the use and land, the save follows through the machine, Heated Metal read by both gates, the reheat, the list" },
  { name: "smoke-superiority", note: "the rest of the Battle Master's maneuvers — Parry's reduction on the hold, the four Bonus Action uses, Ambush and Tactical Assessment as scoped folds, Commander's Strike as a driven attack, Rally natively" },
  // ⚠ Before smoke-surfaces for the same reason smoke-surfaces is last: it places a real template
  // (Spirit Guardians) and creates Regions on the range, all deleted in its `finally` (2026-09-03).
  // The same lesson as smoke-nogm's seed below: the Victim token smoke-emanations needs is swept
  // off by smoke-effects, and the suite reports a red for a missing fixture (2026-09-04).
  { name: "fixture-suite", note: "not a suite — re-places the tokens smoke-metamagic and smoke-emanations need", reset: true },
  // The metamagic pass (2026-09-09): it needs every fixture token standing (the Sorcerer, the goblins, the
  // Ranger under a Fireball), so it runs on the fresh placement above — placed before it, it died at its
  // own fixture check (the battery of 2026-09-09) once the earlier suites had swept a token.
  {
    name: "smoke-metamagic", note: "metamagic — the group in the casting window, the spend by hand, Careful's protected leaving the demand, Heightened's mark on the save gate, Distant / Extended / Transmuted / Twinned, Empowered on the dice, Seeking on the miss",
    needs: ["fixture-suite"]
  },
  {
    name: "smoke-emanations", note: "the emanations — the Paladin's aura stands with its token, applies to allies inside, lifts on exit; Spirit Guardians adopted, its saves on enter and turn end",
    needs: ["fixture-suite"]
  },
  // Slice A, tier 3 (2026-09-24): both ride BF Test Halfling (Lucky, Savage Attacker), a fixture the
  // tier 1+2 build added to fixture-suite — the nearest seed above is theirs.
  {
    name: "smoke-rescue", note: "the `roll` interrupt — Lucky, Warding Flare, Shadowy Dodge bend the hit: the popup's rows, the second d20, the crit undone, all-spent skips",
    needs: ["fixture-suite"]
  },
  {
    name: "smoke-savage", note: "Savage Attacker — the popup on a weapon hit, the set rolled again, the higher standing, the damage waiting, once per turn, the hold first",
    needs: ["fixture-suite"]
  },
  // The Aasimar walk (2026-09-25): BF Test Halfling is lent Celestial Revelation, Light and Sacred
  // Flame for the run, beside the Victim and the Ranger — the same seed as the two above.
  {
    name: "smoke-aasimar", note: "Celestial Revelation and the token lights — a self area placed on the token, an enemy area asking no ally, the `while` ring and its turn-end pulse, the form's rider on a hit and on a spell's one target, Light on a targeted token",
    needs: ["fixture-suite"]
  },
  // The Goliath walk (2026-09-25): BF Test Goliath is lent Storm's Thunder and Large Form for the
  // run, beside the Victim — the same seed as the two above.
  {
    name: "smoke-goliath", note: "the Goliath walk's pass 2 — Large Form's token size, the rebuke offered within its reach and driven at the damager (none out of reach), Stone's Endurance holding a non-attack damage at the applier",
    needs: ["fixture-suite"]
  },
  // The Human walk (2026-09-25): BF Test Halfling is lent the PHB's Resourceful for the run.
  {
    name: "smoke-rest", note: "the rest grants — Resourceful's Heroic Inspiration on a Long Rest (the box ticked, the rest card's line), nothing on a Short Rest, nothing when unlisted",
    needs: ["fixture-suite"]
  },
  // The Halfling walk (2026-09-25): BF Test Halfling's own Lucky feat — the gate's buy box and the
  // `advantage` fold on an initiative rolled with no dialog; the same seed as the two above.
  {
    name: "smoke-lucky", note: "Lucky's Advantage half — the buy box in an attack, save, check and initiative dialog (the tick in the net, the spend, the record, none left greyed) and the no-dialog initiative fold (the higher d20 stands)",
    needs: ["fixture-suite"]
  },
  // The effect view's probe joined the battery on 2026-09-23 (change-scoped live testing): it was
  // the one machine no battery suite drove, and an unrun probe rots exactly like an unrun suite.
  // ⚠ ITS OWN SEED, the smoke-metamagic lesson again: it reads the fixture tokens on the range,
  // and smoke-metamagic and smoke-emanations above both move tokens and sweep effects. A seed is
  // cheaper than a red for a missing fixture — and it runs only when the probe is selected.
  { name: "fixture-suite", note: "not a suite — re-places the tokens probe-effect-view needs", reset: true },
  {
    name: "probe-effect-view", note: "the effect view — the bar, the hover card, the held key, the fold",
    needs: ["fixture-suite"]
  },
  { name: "smoke-resources", note: "the resource notices — the flash, the card line, the silences, the spend stamp" },
  // ⚠ LAST, and it is the only entry whose position is about what it CREATES rather than what
  // it needs. It places a real MeasuredTemplate on the active scene, and a template standing
  // while smoke-saves is mid-run would join its containment arithmetic (§8 re-derives target
  // sets from whatever areas exist). It deletes its own in a `finally`; running it last means
  // a crash between the two cannot reach a suite that would care.
  { name: "smoke-surfaces", note: "the three surfaces nothing else opens — settings, usage dialog, templates" },
  // ⚠ LAST, AFTER smoke-surfaces, and for a reason no other entry has: it is the one suite that
  // must find NO ACTIVE GM. It opens no GM session of its own until its rejoin section, and it
  // REFUSES to run if it sees one — a stray GM silently turns it into a weaker copy of
  // smoke-effects that passes for the wrong reason. Running it at the end means every other
  // suite has already hung up. ⚠ If it fails its preflight here, the cause is almost always a
  // previous suite's session lingering rather than anything about the module; re-run it alone.
  //
  // It is in the battery at all because an unrun suite rots — the 15-second reminder survived
  // six weeks behind an assertion that nobody re-read, and a no-GM suite that only ever ran on
  // the day it was written would be the same bet.
  // ⚠ THE SEED IS A BATTERY STEP, the smoke-d20-folds lesson applied again: smoke-nogm needs
  // the victim TOKEN on the range, earlier suites sweep it off (smoke-effects says so in its
  // own log), and a player client cannot place one — it only observes the scene. Without this
  // the battery reported a red for a missing fixture, which is a broken gauge.
  { name: "fixture-suite", note: "not a suite — re-places the tokens smoke-nogm needs", reset: true },
  {
    name: "smoke-nogm", note: "⚠ NO GM — the flow elect; must run with every other client hung up",
    needs: ["fixture-suite"]
  }
];

/* --- the tiers ----------------------------------------------------------------------------- */

/** The one tier a suite claims. */
const MACHINE_TIER = "machines";
/**
 * The tiers a change is WALKED up from — the pure layer and the registry have few importers, so
 * the machines that import them name the suites. Every other tier is spine.
 */
const WALKED_TIERS = new Set(["decision", "registry"]);
/**
 * The tiers whose change is the FULL battery — core, spine, services, entry: derived as "every
 * tier in check-layers.mjs's DEPTH that is neither claimed nor walked", so a tier added there
 * lands here by default, and the default is the honest one (run everything).
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
 * The `[export] const COVERS = [ ... ]` literal out of a suite's SOURCE TEXT: an array of strings, or null
 * when the file declares none. ⚠ Strict on purpose — string literals, commas and comments only.
 * Anything else (a spread, a variable, a computed path) throws, because a claim this reader
 * cannot see is a claim the gate cannot check, and a loose parse would quietly read it as empty.
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
 * Every ORDER suite's claims, read off its source. ⚠ THROWS on a suite with no COVERS or with one
 * this reader cannot parse — a caller that wants the findings instead (the verify check) reads
 * each file through `parseCovers` itself.
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
 * Walk UP from a walked-tier file to the machines that import it, through any walked-tier file
 * between (decide/registry.js → volley-registry.js → volleys.js). The walk STOPS at a machine —
 * a machine's change is its claimants (rule a), so a dependency's change is the same claim, no
 * wider — and it reports every spine-tier importer it meets, because a dependency the spine
 * imports changes the spine's behaviour, and that is the full battery.
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
 * What a set of changed files (repo-relative paths, as git prints them) has to re-run.
 *
 * Returns `{ rows, full, inert }`: `rows` the ORDER rows to run in canonical order, each with
 * `why` (the file that claimed it, or the suite that needed it); `full` the reasons the whole
 * battery was selected (empty when it was not); `inert` the files that select nothing live, each
 * with why. The rules, in the order they are tried per file:
 *
 *   (a) a MACHINE under scripts/ selects every suite claiming it;
 *   (b) a decide/ or registry file selects the suites claiming each machine that imports it,
 *       walked upward (walkUp) — and the FULL battery if a spine file imports it on the way;
 *   (c) a core / spine / services / entry file, or one the tier map does not know, is the full
 *       battery;
 *   (d) a battery suite under tools/ selects itself; a seed selects the suites that need it;
 *       the harness, the target, the battery and this map are the full battery; any other tool
 *       is inert;
 *   (e) everything else is inert — docs, tests/, package.json — except module.json (below).
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
      // ⚠ The one file outside scripts/ that the platform LOADS: the esmodules entry, the
      // RegionBehavior type the emanations register, the dnd5e compatibility window. A bare
      // version bump is harmless, but this reader cannot tell a bump from a type change.
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
