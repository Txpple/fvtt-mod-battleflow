// Probe (2026-09-03): what does the PLATFORM already apply for each 2024 condition? BACKLOG's
// "measure before building" row: for every status the glossary hangs an outcome off, press it
// on a fixture and READ — the effect's changes as dnd5e ships them, the derived traits (damage
// resistance/immunity, condition immunity), the movement block, any sibling statuses it drags
// in (Unconscious → Prone?), the d20 arithmetic (Exhaustion's −2 × level), and what the system's
// own damage calculation makes of a 10-point hit (the receipt reads that calculation, so this
// IS the receipt's answer). Read-only in effect: every status pressed is removed in `finally`.
//
//   node tools/probe-conditions.mjs [--actor "BF Test Victim"]
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const env = loadEnv();
const actorName = (() => { const i = process.argv.indexOf("--actor"); return i > 0 ? process.argv[i + 1] : "BF Test Victim"; })();
const f = await connectSuite({ tag: "probe-conditions", watchdogMs: 240_000, requireElect: false, env });

const out = await f.evaluate(async ({ actorName }) => {
  const actor = game.actors.getName(actorName);
  if ( !actor ) return { error: `no actor named ${actorName}` };
  const STATUSES = ["blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible",
    "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const snapshot = a => ({
    statuses: [...a.statuses].sort(),
    dr: { value: [...(a.system.traits?.dr?.value ?? [])], custom: a.system.traits?.dr?.custom ?? "", bypasses: [...(a.system.traits?.dr?.bypasses ?? [])] },
    di: { value: [...(a.system.traits?.di?.value ?? [])], custom: a.system.traits?.di?.custom ?? "" },
    ci: { value: [...(a.system.traits?.ci?.value ?? [])], custom: a.system.traits?.ci?.custom ?? "" },
    movement: Object.fromEntries(Object.entries(a.system.attributes?.movement ?? {}).filter(([k, v]) => (typeof v === "number") || (k === "units"))),
    exhaustion: a.system.attributes?.exhaustion ?? null,
    hp: a.system.attributes?.hp?.value ?? null
  });
  const damageOf = a => {
    // The system's own calculation — the receipt's source (decide/receipt.js reads it).
    try {
      const r = a.calculateDamage([{ value: 10, type: "slashing" }, { value: 10, type: "poison" }, { value: 10, type: "fire" }], {});
      return r.map(d => ({ type: d.type, value: d.value, final: d.value }));
    } catch (e) { return { error: String(e?.message ?? e) }; }
  };
  const d20Formula = async a => {
    try {
      const rolls = await a.rollAbilityCheck({ ability: "str" }, { configure: false }, { create: false });
      const roll = Array.isArray(rolls) ? rolls[0] : rolls;
      return roll ? { formula: roll.formula, terms: roll.terms.map(t => t.expression ?? t.formula ?? String(t.total)) } : null;
    } catch (e) { return { error: String(e?.message ?? e) }; }
  };
  const baseline = snapshot(actor);
  const baselineDamage = damageOf(actor);
  const baselineD20 = await d20Formula(actor);
  const rows = [];
  const cleanup = async () => {
    for ( const s of [...STATUSES, "exhaustion"] ) { try { await actor.toggleStatusEffect(s, { active: false }); } catch {} }
    try { await actor.update({ "system.attributes.exhaustion": 0 }); } catch {}
    await sleep(150);
  };
  try {
    await cleanup();
    for ( const status of STATUSES ) {
      await actor.toggleStatusEffect(status, { active: true });
      await sleep(250);
      const eff = actor.effects.find(e => e.statuses.has(status));
      const after = snapshot(actor);
      rows.push({
        status,
        effectName: eff?.name ?? null,
        changes: eff?.changes?.map(c => `${c.key} ${["custom","multiply","add","downgrade","upgrade","override"][c.mode] ?? c.mode} ${c.value}`) ?? [],
        siblingStatuses: after.statuses.filter(s => s !== status && !baseline.statuses.includes(s)),
        dr: after.dr, di: after.di, ci: after.ci,
        movement: after.movement,
        damage: damageOf(actor),
        d20: await d20Formula(actor)
      });
      await actor.toggleStatusEffect(status, { active: false });
      await sleep(200);
    }
    // Exhaustion is a LEVEL, not a toggle: the 2024 rule is −2 × level on every D20 Test, and
    // Speed −5 ft × level; level 6 is death.
    for ( const level of [1, 3] ) {
      await actor.update({ "system.attributes.exhaustion": level });
      await sleep(250);
      const eff = actor.effects.find(e => e.statuses.has("exhaustion"));
      const after = snapshot(actor);
      rows.push({ status: `exhaustion ${level}`, effectName: eff?.name ?? null,
        changes: eff?.changes?.map(c => `${c.key} ${c.mode} ${c.value}`) ?? [],
        siblingStatuses: after.statuses.filter(s => !baseline.statuses.includes(s)),
        movement: after.movement, exhaustion: after.exhaustion, damage: damageOf(actor), d20: await d20Formula(actor) });
    }
  } finally {
    await cleanup();
  }
  const conditionTypes = Object.fromEntries(Object.entries(CONFIG.DND5E.conditionTypes ?? {}).map(([k, v]) => [k, { label: game.i18n.localize(v.label ?? ""), statuses: v.statuses ?? null, riders: v.riders ?? null, reduction: v.reduction ?? null, levels: v.levels ?? null }]));
  return { actor: actor.name, system: game.system.version, baseline, baselineDamage, baselineD20, rows, conditionTypes, restored: snapshot(actor) };
}, { actorName });

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, "probe-conditions");
process.exit(0);
