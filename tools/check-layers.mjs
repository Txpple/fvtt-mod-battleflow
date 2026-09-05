// STATIC LAYER-INTEGRITY CHECK — no Foundry, no world, milliseconds.
//
// ARCHITECTURE.md §7's dependency rule, made mechanical: **depend downward only**, and every
// edge that does not is PINNED HERE with a reason.
//
// WHY (the 2026-08-23 architecture review): the dependency rule was the module's central
// structural discipline and the ONLY major rule enforced by prose alone. `check-imports.mjs`
// proves every named binding resolves; nothing proved DIRECTION. The review counted the rule as
// written ("a machine may not import another machine") violated on the order of seventeen edges,
// every one of them individually reasonable and none of them counted anywhere.
//
// This is the R4 tripwire's shape applied to the import graph, and for the same reason: the rule
// is not "no cross-layer edges" — it is **"no UNNOTICED cross-layer edges"**. A new one fails the
// gate until somebody writes down why it exists. Adding a line here is cheap; adding it without
// noticing is what this file makes impossible.
//
// ⚠ IT ALSO FAILS ON A STALE PIN. An allowlist row whose edge no longer exists is a lie about
// the shape of the tree, and this repo has been bitten by exactly that: debt row D2's evidence
// went stale in place and nobody re-measured it for weeks (ARCHITECTURE §10 D2). A pin that
// cannot go stale silently is worth more than a pin that merely permits.
//
// ⚠ SAME-LAYER EDGES ARE NOT FREE. `machines` is the layer with twelve files in it, and the
// original rule was specifically about them: a machine importing another machine is how a feature
// becomes a service without anybody deciding it should be one. Same-layer is treated exactly like
// upward — legal only when pinned.
//
//   node tools/check-layers.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, relative, sep } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

/* ---------------------------------------------------------------------------------------------
 * THE LAYER MAP — ARCHITECTURE.md §2 and §7, declared once, in code.
 *
 * The DEPTH is what the rule tests: an edge is legal when it points at a STRICTLY SMALLER number.
 *
 * ⚠ `services` IS THE TIER THE REVIEW FOUND MISSING FROM THE DOCS. The four-layer model
 * (EDGE/MOMENT/DECISION/REGISTRY) describes what KIND of code a file holds and stands unchanged —
 * services are EDGE by §2's own test, since they touch Foundry. But `auto-apply`, `effect-riders`
 * and `auto-damage` are not machines: they own no moment and no feature. They are the CHOKEPOINTS
 * every machine routes its consequences through — apply damage with a receipt, apply effects with
 * a receipt, offer and roll damage. Calling them machines is what made the dependency rule read as
 * violated far more often than it morally was: nine of the edges the review counted are a machine
 * calling a service, which is downward and always was.
 * ------------------------------------------------------------------------------------------- */

const DEPTH = { core: 0, decision: 1, registry: 2, spine: 3, services: 4, machines: 5, entry: 6 };

const LAYER_OF = {
  // the one esmodules entry — imports its siblings in a deliberate order (§7)
  "battleflow.js": "entry",

  // MACHINES — one feature each: a trigger, its views, its resolver
  "hold.js": "machines",
  "saves.js": "machines",
  "mastery.js": "machines",
  "maneuvers.js": "machines",
  "concentration.js": "machines",
  "volleys.js": "machines",
  "cast.js": "machines",
  "hit-riders.js": "machines",
  "d20-folds.js": "machines",
  "receipts.js": "machines",
  "reminders.js": "machines",
  "sneak.js": "machines",
  "clock-riders.js": "machines",
  "use-chips.js": "machines",
  "emanations.js": "machines",
  "hit-menu.js": "machines",
  "damage-shields.js": "machines",
  "damage-casts.js": "machines",
  "superiority-uses.js": "machines",
  "polish.js": "machines",
  "resources.js": "machines",
  "stats.js": "machines",

  // SERVICES — the consequence chokepoints every machine routes through
  "auto-apply.js": "services",
  "effect-riders.js": "services",
  "auto-damage.js": "services",

  // SPINE — how a moment is presented, and the shared EDGE readers
  "ui.js": "spine",
  "shared.js": "spine",
  "geometry.js": "spine",
  "settings.js": "spine",
  "lookup.js": "spine",      // the sheet and document readers (the machine-tier pass, Stage 1)

  // REGISTRY — which content participates, in what way
  "volley-registry.js": "registry",

  // DECISION — pure functions over plain data. ZERO imports, asserted below.
  "decide/geometry.js": "decision",
  "decide/registry.js": "decision",
  "decide/verdict.js": "decision",
  "decide/eligible.js": "decision",
  "decide/receipt.js": "decision",
  "decide/present.js": "decision",
  "decide/chips.js": "decision",
  "decide/reminders.js": "decision",
  "decide/sneak.js": "decision",
  "decide/clock.js": "decision",
  "decide/emanations.js": "decision",
  "decide/hit-menu.js": "decision",
  "decide/shields.js": "decision",
  "decide/choices.js": "decision",
  "decide/demand.js": "decision",

  // CORE — the leaf: ids, settings accessor, the elect, the flag serializer
  "core.js": "core"
};

/* ---------------------------------------------------------------------------------------------
 * THE ALLOWLIST — every edge that is not strictly downward, and why it is allowed to exist.
 *
 * ⚠ A row here is a DECISION, not an exemption. Three dispositions appear, and they are
 * deliberately different words:
 *
 *   PERMANENT — ruled permanent (PLAN.md, the Tier 2 box). Do not "fix" these.
 *   OPEN      — real debt, recorded as ARCHITECTURE §10 D9, waiting on a decision or a feature.
 *   BY DESIGN — the edge is correct at this layering and needs no repayment.
 * ------------------------------------------------------------------------------------------- */

const ALLOW = [
  {
    from: "auto-damage.js", to: "hold.js", disposition: "PERMANENT",
    why: "hold's own feature API (stampHoldIfInterrupted) on the deliberate order-pinning edge; "
      + "the paired bare `import \"./auto-damage.js\"` in hold.js is what fixes evaluation order "
      + "(§7, D6) — breaking it drops the damage-offer bar below the hold row"
  },
  {
    from: "auto-apply.js", to: "mastery.js", disposition: "PERMANENT",
    why: "resolveHitMastery, routed from the damage chokepoint. Breaking it means moving "
      + "applyDamagesWithReceipt — the single chokepoint every machine routes through — into a "
      + "third module (PLAN.md Tier 2: low value, real risk)"
  },
  {
    from: "auto-apply.js", to: "effect-riders.js", disposition: "BY DESIGN",
    why: "service → service: applying damage and applying effects are one consequence pass, and "
      + "the receipt merge disciplines are shared. The services tier is where this belongs"
  },
  // ⚠ THREE MORE ROWS WENT ON 2026-09-04: `auto-damage -> mastery / sneak / clock-riders`, the
  // damage OFFER's lazy edges to the machines whose content it painted (the Cleave line, the
  // Cunning Strike menu, the clock riders). The third instance proved the seam BACKLOG named:
  // `registerOfferPart` in auto-damage.js — each machine declares its contribution INTO the
  // service at module evaluation (the relay's idiom), so the edge points downward and the
  // hit menu joined without a fourth pin.
  // ⚠ THREE ROWS WERE DELETED FROM HERE ON 2026-08-23, and the deletion is the point: this list
  // shrinks when debt is repaid, and the GATE is what forced the shrink. `mastery -> concentration`
  // and `saves -> concentration` (dramaticVerdictPause → ui.js, the spine) and `maneuvers ->
  // mastery` (combatStamp → core.js) all stopped existing, and the stale-pin rule failed the build
  // until these rows came out. A pin that only ever permits would have sat here forever.
  {
    from: "volleys.js", to: "reminders.js", disposition: "BY DESIGN",
    why: "judgeRoll (2026-09-02): the volley's aim popup is the gate's SECOND SURFACE — the rays "
      + "roll with the dialog suppressed, so the gate meets them at the aim, ray by ray, with "
      + "the gate's own judge. The judge reads the world (chips, tokens, the lists), so it "
      + "cannot live in decide/; a third surface reading it is the argument for a spine home"
  },
  {
    from: "saves.js", to: "maneuvers.js", disposition: "OPEN (D9)",
    why: "interpose: foldEntryFor/equippedShield at the choice spec, RULE_TEXT at its popup. "
      + "Genuinely cross-feature — a save's verdict opens a maneuver's choice. The principled fix "
      + "is a save-choice registry beside SAVE_FOLDS, which is feature-shaped work; the seam "
      + "arrives when the third choice kind does"
  },
  {
    from: "saves.js", to: "receipts.js", disposition: "OPEN (D9)",
    why: "revertTarget, lazy on purpose — a static import would evaluate receipts.js first and "
      + "register its render row above the verdict row (the ESM order trap, saves.js:1206). "
      + "receipts.js is classed a machine because revertTarget has exactly one importer; a "
      + "second one makes it a service"
  },
  // ⚠ TWO ROWS WENT ON 2026-09-05 (the machine-tier pass, Stage 3b — ruling 2): `saves ->
  // d20-folds` (offerFoldOnSave) and `d20-folds -> saves` (foldSaveAnswer), the two-way
  // withhold-and-resume cycle this check found on its first run. The spine owns the protocol now
  // (ui.js registerWithhold / registerWithheld / withholds / resumeWithheld); neither machine
  // imports the other, and the stale-pin rule forced the rows out. D9(d) is repaid.
];

/* --- the graph ---------------------------------------------------------------------------- */

const toPosix = p => p.split(sep).join("/");

/** Every .js file under scripts/, recursively, as a scripts-relative posix path. */
function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

/**
 * Every scripts-internal edge, all four forms. The lazy form is not an afterthought — it is where
 * the interesting edges live, because `await import()` is this module's cycle-breaking and
 * order-pinning idiom (six of the eleven allowlisted edges below are lazy).
 */
function edgesOf(file) {
  const src = readFileSync(file, "utf8");
  const from = toPosix(relative(SCRIPTS, file));
  const out = [];
  const add = (kind, spec) => {
    if (!spec.startsWith(".")) return;                 // no bare specifiers ship (DESIGN R3)
    out.push({ from, to: toPosix(relative(SCRIPTS, normalize(join(dirname(file), spec)))), kind });
  };
  for (const m of src.matchAll(/import\s*\{[\s\S]*?\}\s*from\s*["']([^"']+)["']/g)) add("static", m[1]);
  for (const m of src.matchAll(/^import\s+["']([^"']+)["']/gm)) add("bare", m[1]);
  for (const m of src.matchAll(/import\s+\*\s+as\s+\w+\s+from\s*["']([^"']+)["']/g)) add("star", m[1]);
  for (const m of src.matchAll(/=\s*await\s+import\(\s*["']([^"']+)["']\s*\)/g)) add("lazy", m[1]);
  return out;
}

const files = jsFiles(SCRIPTS).map(f => ({ path: f, rel: toPosix(relative(SCRIPTS, f)) }))
  .sort((a, b) => a.rel.localeCompare(b.rel));
const edges = files.flatMap(f => edgesOf(f.path));

/* --- the assertions ----------------------------------------------------------------------- */

const failures = [];
const fail = (rule, msg) => failures.push(`${rule}: ${msg}`);

// (1) every file declares a layer. An undeclared file is a NEW file whose layer nobody chose.
for (const f of files) {
  if (!LAYER_OF[f.rel]) {
    fail("layer map", `scripts/${f.rel} has no layer — declare it in LAYER_OF in this file `
      + "(ARCHITECTURE §11, \"Adding a file\": declare its layer in its header comment too)");
  }
}
// ...and every declared layer names a file that exists, so the map cannot rot either.
for (const rel of Object.keys(LAYER_OF)) {
  if (!files.some(f => f.rel === rel)) {
    fail("layer map", `LAYER_OF names scripts/${rel}, which does not exist — remove the row`);
  }
}

// (2) the pure layer imports NOTHING. §7's "⚠ keep it that way", made mechanical.
for (const e of edges) {
  if (LAYER_OF[e.from] === "decision") {
    fail("decide/ is pure", `scripts/${e.from} imports "${e.to}" — the DECISION layer has zero `
      + "imports by design (§7). If it needs game/canvas/a document it is EDGE: move it up a layer");
  }
}

// (3) core.js is a leaf.
for (const e of edges.filter(e => e.from === "core.js")) {
  fail("core is a leaf", `core.js imports "${e.to}" — core.js imports nothing (§7)`);
}

// (4) every edge is strictly downward, or pinned with a reason.
const key = e => `${e.from} -> ${e.to}`;
const allowed = new Map(ALLOW.map(a => [`${a.from} -> ${a.to}`, a]));
const used = new Set();
const violations = [];
for (const e of edges) {
  const fromDepth = DEPTH[LAYER_OF[e.from]];
  const toDepth = DEPTH[LAYER_OF[e.to]];
  if ((fromDepth === undefined) || (toDepth === undefined)) continue;   // reported by (1)
  if (toDepth < fromDepth) continue;                                    // downward: always legal
  if (allowed.has(key(e))) { used.add(key(e)); violations.push(e); continue; }
  const direction = (toDepth === fromDepth) ? "SAME-LAYER" : "UPWARD";
  fail("depend downward", `scripts/${e.from} (${LAYER_OF[e.from]}) imports "${e.to}" `
    + `(${LAYER_OF[e.to]}) — ${direction}, and not in the allowlist. Either invert the `
    + "dependency (the service usually belongs in the lower layer — that is D1's whole lesson), "
    + "or add a row to ALLOW in this file saying why it must exist");
}

// (5) no stale pins. A row for an edge that no longer exists misreports the shape of the tree.
for (const a of ALLOW) {
  if (!used.has(`${a.from} -> ${a.to}`)) {
    fail("stale pin", `ALLOW lists ${a.from} -> ${a.to}, and that edge no longer exists — `
      + "delete the row. (D2's evidence row went stale in place for weeks; a pin that cannot go "
      + "stale silently is the point of this check)");
  }
}

/* --- the report --------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} layering failure(s).`);
  process.exit(1);
}

const byLayer = Object.keys(DEPTH).sort((a, b) => DEPTH[b] - DEPTH[a]);
const counts = Object.fromEntries(byLayer.map(l =>
  [l, files.filter(f => LAYER_OF[f.rel] === l).length]));

console.log("LAYERS AND THE EDGES THAT CROSS THEM (ARCHITECTURE.md §7 — the dependency rule)");
for (const l of byLayer) {
  console.log(`  ${String(DEPTH[l]).padStart(2)}  ${l.padEnd(9)} ${String(counts[l]).padStart(2)} `
    + `file${counts[l] === 1 ? "" : "s"}`);
}
const kinds = ["static", "bare", "star", "lazy"];
const tally = kinds.map(k => `${k} ${edges.filter(e => e.kind === k).length}`).join(" · ");
console.log(`\n  ${edges.length} internal edges: ${tally}`);

// ⚠ SITES vs PAIRS, said precisely: `saves.js -> maneuvers.js` is one pinned pair holding two
// call sites. A count that quietly means one when it reads like the other is how this repo's
// hand-carried numbers went stale twice (PLAN.md, the commit count).
console.log(`\n  ${ALLOW.length} pinned pair(s), ${violations.length} call site(s) — `
  + "not downward, each with a reason:");
const w = Math.max(...ALLOW.map(a => `${a.from} -> ${a.to}`.length));
for (const a of ALLOW) {
  const sites = violations.filter(e => (e.from === a.from) && (e.to === a.to));
  const forms = [...new Set(sites.map(e => e.kind))].join("/");
  console.log(`    ${`${a.from} -> ${a.to}`.padEnd(w)}  ${a.disposition.padEnd(11)} `
    + `${sites.length}× ${forms}`);
}
const open = ALLOW.filter(a => a.disposition.startsWith("OPEN")).length;
console.log(`\nPASS every edge is downward or pinned (${files.length} files, ${edges.length} edges, `
  + `${ALLOW.length} pinned pairs, ${open} of them OPEN debt — ARCHITECTURE §10 D9).`);
