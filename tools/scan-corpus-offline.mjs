// OFFLINE corpus scan of premium modules — scan-corpus.mjs's row shape without a running Foundry,
// a bridge or a sole-GM preflight. Each LevelDB pack is COPIED out of the Foundry data folder
// (minus its LOCK) and the copy is read with classic-level, so a world that is open, a battery
// that is running and a user who is in the sandbox are never touched. Where scan-corpus reads
// Item packs only, this also flattens Actor packs into one row per embedded feature (the splat
// bestiaries ship as actors, not as a features pack).
//
//   node tools/scan-corpus-offline.mjs <out.json> <module-id> [<module-id> ...] [--data <Foundry Data dir>]
//   node tools/scan-corpus-offline.mjs dist/splat.json dnd-arcana-unleashed dnd-heroes-faerun dnd-ravenloft-horrors-within
//
// The data folder: --data, else FOUNDRY_DATA_DIR from the mcp repo's .env, else the Windows default.
// classic-level is resolved from the sibling fvtt-mcp-dnd5e checkout (the only place the house has it).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const MCP = resolve(here, "..", "..", "fvtt-mcp-dnd5e");
const { ClassicLevel } = createRequire(join(MCP, "package.json"))("classic-level");

const argv = process.argv.slice(2);
const dataFlag = argv.indexOf("--data");
const DATA = dataFlag >= 0 ? argv.splice(dataFlag, 2)[1]
  : readEnv(join(MCP, ".env")).FOUNDRY_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? "", "FoundryVTT", "Data");
const [out, ...mods] = argv;
if (!out || !mods.length) { console.error("usage: node tools/scan-corpus-offline.mjs <out.json> <module-id> [...] [--data <dir>]"); process.exit(2); }
const COPIES = join(tmpdir(), "battleflow-offline-packs");

function readEnv(path) {
  try {
    return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
  } catch { return {}; }
}
const strip = html => (html ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
const KEEP_FEAT = new Set(["race", "class", "feat", "origin", "supernaturalGift", "monster"]);
const valuesOf = x => Array.isArray(x) ? x : Object.values(x ?? {});
const activityOf = a => ({
  type: a?.type, name: a?.name || "",
  activation: a?.activation?.type ?? null, activationOverride: !!a?.activation?.override, actCondition: a?.activation?.condition || "",
  range: a?.range?.value ?? null, targetType: a?.target?.affects?.type || a?.target?.template?.type || "",
  save: a?.save ? { ability: Array.from(a.save.ability ?? []), dc: a.save.dc?.calculation || "", onSave: a?.damage?.onSave || "" } : null,
  attack: a?.attack ? { type: a.attack.type?.value || "", classification: a.attack.type?.classification || "" } : null,
  damageParts: (a?.damage?.parts ?? []).map(p => p?.custom?.enabled ? (p.custom.formula || "") : `${p?.number ?? ""}d${p?.denomination ?? ""}${p?.types?.length ? " " + Array.from(p.types).join("/") : ""}`),
  healing: a?.healing ? `${a.healing.number ?? ""}d${a.healing.denomination ?? ""}` : null,
  effects: (a?.effects ?? []).map(e => e?._id ?? e?.id ?? "").filter(Boolean),
  uses: a?.uses?.max ? { max: a.uses.max, recovery: (a.uses.recovery ?? []).map(r => r.period) } : null,
  consumption: (a?.consumption?.targets ?? []).map(t => t.type),
});
const effectOf = e => ({
  name: e.name, transfer: e.transfer, disabled: e.disabled, statuses: Array.from(e.statuses ?? []),
  changes: (e.changes ?? []).map(c => `${c.key}=${c.value}`),
  duration: { seconds: e.duration?.seconds ?? null, rounds: e.duration?.rounds ?? null, turns: e.duration?.turns ?? null },
  flags: Object.keys(e.flags ?? {}),
});

async function readPack(dir) {
  const db = new ClassicLevel(dir, { valueEncoding: "json" });
  await db.open();
  const docs = {};
  for await (const [k, v] of db.iterator()) {
    const [, coll, id] = k.split("!");
    (docs[coll] ??= []).push({ key: id, doc: v });
  }
  await db.close();
  return docs;
}

const rows = [], owners = [], errors = [], packStats = [];
mkdirSync(COPIES, { recursive: true });
for (const mod of mods) {
  const manifest = JSON.parse(readFileSync(join(DATA, "modules", mod, "module.json"), "utf8"));
  for (const p of manifest.packs) {
    if (p.type !== "Item" && p.type !== "Actor") continue;
    const packId = `${mod}.${p.name}`;
    const src = join(DATA, "modules", mod, p.path), dst = join(COPIES, `${mod}__${p.name}`);
    rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true, filter: s => !s.endsWith("LOCK") });
    let docs;
    try { docs = await readPack(dst); } catch (err) { errors.push({ pack: packId, error: String(err?.message || err) }); continue; }
    let kept = 0;
    const pushRow = (item, effects, extra = {}) => {
      const sys = item.system ?? {};
      rows.push({
        pack: packId, uuid: `Compendium.${packId}.Item.${item._id}`, name: item.name, itemType: item.type,
        featType: sys.type?.value ?? null, featSubtype: sys.type?.subtype ?? null, identifier: sys.identifier ?? null,
        level: sys.level ?? null, school: sys.school ?? null, method: sys.method ?? null, properties: Array.from(sys.properties ?? []),
        activation: sys.activation?.type ?? null, activationCondition: sys.activation?.condition ?? "",
        prereqLevel: sys.prerequisites?.level ?? null, requirements: sys.requirements ?? "",
        uses: sys.uses?.max ? { max: sys.uses.max, recovery: (sys.uses.recovery ?? []).map(r => r.period) } : null,
        duration: sys.duration ? `${sys.duration.value ?? ""} ${sys.duration.units ?? ""}`.trim() : "",
        activities: valuesOf(sys.activities).map(activityOf), effects: effects.map(effectOf), text: strip(sys.description?.value).slice(0, 1500), ...extra,
      });
      kept++;
    };
    if (p.type === "Item") {
      const fx = {};
      for (const { key, doc } of docs["items.effects"] ?? []) (fx[key.split(".")[0]] ??= []).push(doc);
      // a book's magic-item pack is kept whole, the way the DMG's equipment is
      const keepAll = p.name === "items";
      for (const { doc } of docs.items ?? []) {
        const t = doc.type, sys = doc.system ?? {};
        if (t === "class" || t === "subclass" || t === "race") {
          const grants = [];
          for (const adv of valuesOf(sys.advancement)) {
            if (adv.type !== "ItemGrant" && adv.type !== "ItemChoice") continue;
            for (const it of valuesOf(adv.configuration?.items)) grants.push({ uuid: it.uuid ?? it, level: adv.level ?? null, choice: adv.type === "ItemChoice" });
          }
          owners.push({ pack: packId, uuid: `Compendium.${packId}.Item.${doc._id}`, name: doc.name, type: t, identifier: sys.identifier ?? null, classIdentifier: sys.classIdentifier ?? null, grants });
          kept++;
          continue;
        }
        if (!keepAll && t !== "feat" && t !== "spell") continue;
        if (!keepAll && t === "feat" && !KEEP_FEAT.has(sys.type?.value ?? "")) continue;
        pushRow(doc, fx[doc._id] ?? []);
      }
    } else {
      // the bestiary: one row per (actor, feature or natural weapon), the actor and its CR carried
      const items = {}, fx = {};
      for (const { key, doc } of docs["actors.items"] ?? []) (items[key.split(".")[0]] ??= []).push(doc);
      for (const { key, doc } of docs["actors.items.effects"] ?? []) (fx[key.split(".").slice(0, 2).join(".")] ??= []).push(doc);
      for (const { doc: actor } of docs.actors ?? []) {
        for (const it of items[actor._id] ?? []) {
          if (it.type !== "feat" && it.type !== "weapon") continue;
          pushRow(it, fx[`${actor._id}.${it._id}`] ?? [], { actor: actor.name, cr: actor.system?.details?.cr ?? null, featType: it.system?.type?.value || "monster" });
        }
      }
    }
    packStats.push({ pack: packId, docs: (docs.items ?? docs.actors ?? []).length, kept });
  }
}
writeFileSync(out, JSON.stringify({ rows, owners, errors, packStats, offline: true, data: DATA }, null, 2));
console.log(packStats.map(s => `${s.pack}: ${s.docs} docs, ${s.kept} rows`).join("\n"));
if (errors.length) console.log("errors", errors);
console.log(`[scan-corpus-offline] → ${out}`);
