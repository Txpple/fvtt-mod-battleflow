// THE EFFECT VIEW, live on the sandbox (branch effect-view, 2026-09-15): the bar above the hotbar
// for the controlled token, the hover card beside a token, the held key (Foundry's highlightObjects)
// over every creature. Puts Bless and Prone on Invictus for the run, then takes them off.
//
//   node tools/probe-effect-view.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-effect-view";
const f = await connectSuite({ tag: TAG, watchdogMs: 180_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while ( Date.now() < end ) { const v = fn(); if ( v ) return v; await sleep(120); } return fn(); };
  const report = { module: game.modules.get(MOD)?.version, checks: [], log: [] };
  const ok = (name, pass, detail = "") => report.checks.push({ name, pass: !!pass, detail });

  const scene = game.scenes.getName("Battle Flow Test Range");
  const invictus = game.actors.getName("Invictus");
  if ( !scene || !invictus ) return { fatal: "missing the range or Invictus" };
  const priorActiveScene = game.scenes.active?.id ?? null;
  const placed = [];
  const priorBar = game.settings.get(MOD, "effectBar"), priorHover = game.settings.get(MOD, "effectHover");
  let made = [];
  try {
    await game.settings.set(MOD, "effectBar", true); await game.settings.set(MOD, "effectHover", true);
    if ( game.scenes.active?.id !== scene.id ) { await scene.activate(); await sleep(1500); }
    if ( canvas.scene?.id !== scene.id ) { await scene.view(); await sleep(1500); }
    await until(() => canvas.ready);
    let doc = scene.tokens.find(t => t.actorId === invictus.id);
    if ( !doc ) {
      [doc] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(invictus.prototypeToken.toObject(), { x: 500, y: 1400, actorId: invictus.id, actorLink: true }, { inplace: false })]);
      placed.push(doc.id);
    }
    await sleep(300);
    const token = canvas.tokens.get(doc.id);

    // two effects the sheet lists: a status (Prone, paints an icon) and a timed buff (Bless, no icon)
    made = await invictus.createEmbeddedDocuments("ActiveEffect", [
      { name: "Bless", img: "icons/svg/upgrade.svg", duration: { seconds: 60 }, changes: [] },
      { name: "Prone", img: "icons/svg/falling.svg", statuses: ["prone"], changes: [] }
    ]);
    await sleep(300);
    report.facts = [...invictus.allApplicableEffects()].filter(e => e.isTemporary || e.statuses.size).map(e => ({ name: e.name, active: e.active, temporary: e.isTemporary, statuses: [...e.statuses], label: e.duration?.label ?? null }));

    // THE SHEET ROWS: temp HP and Heroic Inspiration are numbers on the sheet, not effects
    const priorSheet = { temp: invictus.system.attributes.hp.temp, insp: invictus.system.attributes.inspiration };
    await invictus.update({ "system.attributes.hp.temp": 7, "system.attributes.inspiration": true });
    report.priorSheet = priorSheet;

    // THE BAR: control the token, the strip draws for him
    token.control({ releaseOthers: true });
    const bar = await until(() => { const b = document.getElementById("bf-effect-view-bar"); return (b && !b.classList.contains("empty") && b.querySelector(".bf-ev-chip")) ? b : null; });
    const barNames = bar ? [...bar.querySelectorAll(".bf-ev-chip .nm")].map(n => n.textContent) : [];
    ok("1. the bar draws above the hotbar for the controlled token: Prone (debuff) first, Bless and the applied Death Armor listed, the worn Cloak not",
      !!bar && (barNames[0] === "Prone") && barNames.includes("Bless") && barNames.includes("Death Armor") && !barNames.some(n => n.startsWith("Bonus AC")), `chips=${JSON.stringify(barNames)}`);
    const tempChip = bar ? [...bar.querySelectorAll(".bf-ev-chip")].find(c => c.querySelector(".nm")?.textContent === "Temporary HP") : null;
    ok("1e. the sheet rows — Temporary HP 7 and Heroic Inspiration listed as buffs, after the effects, with no clock glyph",
      !!tempChip && (tempChip.querySelector(".dtl")?.textContent === "7") && !tempChip.querySelector(".clk") && barNames.includes("Heroic Inspiration")
        && (barNames.indexOf("Temporary HP") > barNames.indexOf("Bless")), `chips=${JSON.stringify(barNames)} detail=${tempChip?.querySelector(".dtl")?.textContent}`);
    const hot = document.getElementById("hotbar")?.getBoundingClientRect(), br = bar?.getBoundingClientRect();
    ok("1b. it sits above the hotbar", !!hot && !!br && (br.bottom <= hot.top), `bar.bottom=${br?.bottom} hotbar.top=${hot?.top}`);
    const tagged = bar ? [...bar.querySelectorAll(".bf-ev-chip")].filter(c => c.querySelector("em")).map(c => c.querySelector(".nm").textContent) : [];
    ok("1c. the clockless Death Armor is tagged as painting no icon; Bless (clocked) and Prone (a condition) are not",
      tagged.includes("Death Armor") && !tagged.includes("Bless") && !tagged.includes("Prone"), `tagged=${JSON.stringify(tagged)}`);
    ok("1d. a clockless row shows no clock at all — never the platform's \"None\"",
      !!bar && ![...bar.querySelectorAll(".bf-ev-chip .clk")].some(c => /none/i.test(c.textContent)), "");

    // THE HOVER CARD: the platform's hook, as a mouse-over would fire it
    Hooks.callAll("hoverToken", token, true);
    const card = await until(() => document.querySelector(`.bf-ev-card[data-token="${token.id}"]`), 3000);
    ok("2. the hover card appears for the token with the same list",
      !!card && (card.querySelectorAll(".bf-ev-chip").length === barNames.length), `chips=${card?.querySelectorAll(".bf-ev-chip").length}`);
    Hooks.callAll("hoverToken", token, false);
    await sleep(100);
    ok("2b. and leaves when the hover ends", !document.querySelector(`.bf-ev-card[data-token="${token.id}"]`), "");

    // THE HELD KEY: Foundry fires highlightObjects on Alt
    Hooks.callAll("highlightObjects", true);
    const overlay = await until(() => document.querySelectorAll(".bf-ev-card").length ? document.querySelectorAll(".bf-ev-card") : null, 3000);
    ok("3. the held key shows a card for every creature with effects (Invictus at least)",
      !!overlay && [...overlay].some(c => c.querySelector("h4")?.textContent.includes("Invictus")), `cards=${overlay?.length}`);
    Hooks.callAll("highlightObjects", false);
    await sleep(100);
    ok("3b. and clears on release", document.querySelectorAll(".bf-ev-card").length === 0, "");

    // THE BAR FOLLOWS THE SHEET: delete Bless, the chip leaves
    await invictus.deleteEmbeddedDocuments("ActiveEffect", [made[0].id]);
    const gone = await until(() => { const b = document.getElementById("bf-effect-view-bar"); const names = b ? [...b.querySelectorAll(".bf-ev-chip .nm")].map(n => n.textContent) : []; return names.includes("Bless") ? null : names; }, 3000);
    ok("4. the bar redraws when an effect is deleted", Array.isArray(gone) && !gone.includes("Bless") && gone.includes("Prone"), `chips=${JSON.stringify(gone)}`);

    // THE BAR'S ACTIONS (user ruling 2026-09-15): a chip opens a fold — Details, and Remove for an owner
    const barEl = () => document.getElementById("bf-effect-view-bar");
    const chipNamed = name => [...(barEl()?.querySelectorAll("button.bf-ev-chip") ?? [])].find(c => c.querySelector(".nm")?.textContent === name) ?? null;
    chipNamed("Prone")?.click();
    const fold = await until(() => barEl()?.querySelector(".bf-ev-fold"), 2000);
    const foldActions = fold ? [...fold.querySelectorAll("button")].map(b => b.dataset.action) : [];
    ok("6. a chip click opens a fold upward with Details and Remove (the GM owns every creature)",
      !!fold && foldActions.includes("details") && foldActions.includes("remove"), `actions=${JSON.stringify(foldActions)}`);
    fold?.querySelector('button[data-action="details"]')?.click();
    const details = await until(() => [...document.querySelectorAll(".application")].find(a => a.querySelector(".bf-ev-details")), 4000);
    ok("6b. Details opens a window with the effect's name, kind and description",
      !!details && details.querySelector(".bf-ev-details h3")?.textContent === "Prone" && /debuff/.test(details.querySelector(".meta")?.textContent ?? ""), `open=${!!details}`);
    for ( const a of foundry.applications.instances.values() ) { if ( a.element?.querySelector?.(".bf-ev-details") ) await a.close().catch(() => {}); }
    chipNamed("Prone")?.click();
    const fold2 = await until(() => barEl()?.querySelector(".bf-ev-fold"), 2000);
    fold2?.querySelector('button[data-action="remove"]')?.click();
    const proneGone = await until(() => invictus.effects.get(made[1].id) ? null : true, 4000);
    ok("6c. Remove deletes the effect, and the bar redraws without it",
      proneGone === true && !!(await until(() => chipNamed("Prone") ? null : true, 3000)), "");
    chipNamed("Temporary HP")?.click();
    const fold3 = await until(() => barEl()?.querySelector(".bf-ev-fold"), 2000);
    const clearLabel = fold3?.querySelector('button[data-action="clear"]')?.textContent ?? null;
    fold3?.querySelector('button[data-action="clear"]')?.click();
    const cleared = await until(() => (invictus.system.attributes.hp.temp ?? 0) === 0 ? true : null, 4000);
    ok("6d. a sheet row's fold says Clear, and Clear zeroes the temp HP", clearLabel === "Clear" && cleared === true, `label=${clearLabel} temp=${invictus.system.attributes.hp.temp}`);
    barEl()?.querySelector("button.who")?.click();
    const panel = await until(() => barEl()?.querySelector(".bf-ev-panel"), 2000);
    const panelNames = panel ? [...panel.querySelectorAll(".bf-ev-chip .nm")].map(n => n.textContent) : [];
    ok("6e. the name opens the full list upward, one chip per row, each clickable",
      !!panel && panelNames.includes("Death Armor") && panelNames.includes("Heroic Inspiration") && !!panel.querySelector("button.bf-ev-chip"), `rows=${JSON.stringify(panelNames)}`);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(100);
    ok("6f. Escape closes it", !barEl()?.querySelector(".bf-ev-panel"), "");

    // THE SWITCH: off, the bar leaves
    await game.settings.set(MOD, "effectBar", false);
    const off = await until(() => document.getElementById("bf-effect-view-bar") ? null : true, 3000);
    ok("5. the client switch off removes the bar", off === true, "");
  } catch(err) {
    report.fatal = `${err?.message ?? err}\n${err?.stack ?? ""}`;
  } finally {
    try { for ( const c of document.querySelectorAll(".bf-ev-card") ) c.remove(); } catch { /* fine */ }
    try { const ids = made.map(e => e.id).filter(id => invictus.effects.get(id)); if ( ids.length ) await invictus.deleteEmbeddedDocuments("ActiveEffect", ids); } catch(err) { report.log.push(`cleanup effects: ${err?.message}`); }
    try { if ( report.priorSheet ) await invictus.update({ "system.attributes.hp.temp": report.priorSheet.temp ?? 0, "system.attributes.inspiration": report.priorSheet.insp ?? false }); } catch(err) { report.log.push(`cleanup sheet: ${err?.message}`); }
    try { canvas.tokens?.releaseAll?.(); } catch { /* fine */ }
    try { if ( placed.length ) await scene.deleteEmbeddedDocuments("Token", placed); } catch(err) { report.log.push(`cleanup tokens: ${err?.message}`); }
    try { await game.settings.set(MOD, "effectBar", priorBar); await game.settings.set(MOD, "effectHover", priorHover); } catch { /* fine */ }
    try { const back = priorActiveScene ? game.scenes.get(priorActiveScene) : null; if ( back && (game.scenes.active?.id !== back.id) ) { await back.activate(); await sleep(800); } } catch { /* fine */ }
  }
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(out?.fatal || out?.checks?.some(c => !c.pass) ? 1 : 0);
