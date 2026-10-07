// THE EFFECT VIEW, live: the bar above the hotbar for the controlled token, the hover card beside
// a token, the held key (Foundry's highlightObjects) over every creature. A battery entry (it is
// the only suite driving effect-view.js's hooks); `fixture-suite` seeds it.
// Fixtures: the Battle Flow Test Range and BF Test Vanguard (fixture-suite) wearing an attuned Cloak
// of Protection. Bless, Prone and an applied clockless effect are written for the run; its token is
// placed if missing. Switches, effects, sheet numbers, token and active scene are all restored.
//
//   node tools/probe-effect-view.mjs              the whole probe
//   node tools/probe-effect-view.mjs --section 2  just §2; `--list` for the table
// Setup and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from "./harness.mjs";

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = ["effect-view.js"];

const SECTIONS = {
  1: "the bar: drawn above the hotbar for the controlled token — debuffs first, the sheet rows after the effects, the clockless tagged, never \"None\"",
  2: "the hover card: none for a controlled token; for a released one the same list, gone when the hover ends",
  3: "the held key (highlightObjects): a card for every creature with effects, cleared on release",
  4: "the bar follows the sheet: an effect deleted, its chip leaves",
  5: "the client switch off removes the bar (effectViewChanged)",
  6: "the bar's actions: the fold with Remove, Remove deletes, Clear zeroes temp HP, the name's full panel, Escape closes"
};
const DEPENDS = {};

const TAG = "probe-effect-view";
const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: TAG, watchdogMs: 180_000 });
announcePlan(TAG, plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = "fvtt-mod-battleflow";
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = "") => results.push({ name, pass: !!pass, detail });
  const want = id => {
    if ( !sections || sections.includes(String(id)) ) return true;
    skips.push(`§${id} ${titles?.[id] ?? ""}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while ( Date.now() < end ) { const v = fn(); if ( v ) return v; await sleep(120); } return fn(); };

  // ---- preflight
  const mod = game.modules.get(MOD);
  if ( !mod?.active ) return { fatal: `module active=${mod?.active}` };
  if ( !game.settings.settings.has(`${MOD}.effectBar`) ) return { fatal: "effectBar not registered — OLD code (deploy --local, reload)" };
  const scene = game.scenes.getName("Battle Flow Test Range");
  const vanguard = game.actors.getName("BF Test Vanguard");
  if ( !scene || !vanguard ) return { fatal: `missing fixture: ${!scene ? "the Battle Flow Test Range (run tools/fixture-suite.mjs)" : "BF Test Vanguard (run tools/fixture-suite.mjs)"}` };
  // §1 and §6e read the Cloak of Protection fixture-suite gives the Vanguard: refuse up front if it is missing.
  const standing = [...vanguard.allApplicableEffects()].map(e => e.name);
  if ( !standing.some(n => n.startsWith("Bonus AC")) ) return { fatal: "BF Test Vanguard lacks the Cloak's \"Bonus AC\" passive — run tools/fixture-suite.mjs" };
  log.push(`module ${mod.version}`);

  const priorActiveScene = game.scenes.active?.id ?? null;
  const placed = [];
  const priorBar = game.settings.get(MOD, "effectBar"), priorHover = game.settings.get(MOD, "effectHover");
  let made = [];
  let seeded = [];
  const CLOCKLESS = "Death Armor (probe)";
  let priorSheet = null;
  try {
    // ---- setup (always runs)
    await game.settings.set(MOD, "effectBar", true); await game.settings.set(MOD, "effectHover", true);
    if ( game.scenes.active?.id !== scene.id ) { await scene.activate(); await sleep(1500); }
    if ( canvas.scene?.id !== scene.id ) { await scene.view(); await sleep(1500); }
    await until(() => canvas.ready);
    let doc = scene.tokens.find(t => t.actorId === vanguard.id);
    if ( !doc ) {
      [doc] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(vanguard.prototypeToken.toObject(), { x: 500, y: 1400, actorId: vanguard.id, actorLink: true }, { inplace: false })]);
      placed.push(doc.id);
    }
    await sleep(300);
    const token = canvas.tokens.get(doc.id);
    if ( !token ) return { fatal: `the Vanguard's token ${doc.id} is not on the canvas`, results, log, skips };

    // two effects the sheet lists: a status (Prone, paints an icon) and a timed buff (Bless, no icon)
    made = await vanguard.createEmbeddedDocuments("ActiveEffect", [
      { name: "Bless", img: "icons/svg/upgrade.svg", duration: { seconds: 60 }, changes: [] },
      { name: "Prone", img: "icons/svg/falling.svg", statuses: ["prone"], changes: [] }
    ]);
    // An applied, clockless effect, always the run's own: a real cast at the table is clocked (an
    // empty clock takes the spell's), so reusing his would test play state, not the class.
    seeded = await vanguard.createEmbeddedDocuments("ActiveEffect", [
      { name: CLOCKLESS, img: "icons/svg/skull.svg", changes: [] }
    ]);
    log.push(`seeded an applied, clockless "${CLOCKLESS}" for the run`);
    await sleep(300);
    const facts = [...vanguard.allApplicableEffects()].filter(e => e.isTemporary || e.statuses.size).map(e => ({ name: e.name, active: e.active, temporary: e.isTemporary, statuses: [...e.statuses], label: e.duration?.label ?? null }));
    log.push(`facts: ${JSON.stringify(facts)}`);

    // THE SHEET ROWS: temp HP and Heroic Inspiration are numbers on the sheet, not effects
    priorSheet = { temp: vanguard.system.attributes.hp.temp, insp: vanguard.system.attributes.inspiration };
    await vanguard.update({ "system.attributes.hp.temp": 7, "system.attributes.inspiration": true });

    // Control the token so the bar draws; read in setup because §2's card is held to the same list.
    token.control({ releaseOthers: true });
    const bar = await until(() => { const b = document.getElementById("bf-effect-view-bar"); return (b && !b.classList.contains("empty") && b.querySelector(".bf-ev-chip")) ? b : null; });
    const barNames = bar ? [...bar.querySelectorAll(".bf-ev-chip .nm")].map(n => n.textContent) : [];

    // ---- 1. the bar
    if ( want(1) ) {
      ok("1. the bar draws above the hotbar for the controlled token: Prone (debuff) first, Bless and the applied Death Armor listed, the worn Cloak not",
        !!bar && (barNames[0] === "Prone") && barNames.includes("Bless") && barNames.includes(CLOCKLESS) && !barNames.some(n => n.startsWith("Bonus AC")), `chips=${JSON.stringify(barNames)}`);
      const tempChip = bar ? [...bar.querySelectorAll(".bf-ev-chip")].find(c => c.querySelector(".nm")?.textContent === "Temporary HP") : null;
      ok("1e. the sheet rows — Temporary HP 7 and Heroic Inspiration listed as buffs, after the effects, with no clock glyph",
        !!tempChip && (tempChip.querySelector(".dtl")?.textContent === "7") && !tempChip.querySelector(".clk") && barNames.includes("Heroic Inspiration")
          && (barNames.indexOf("Temporary HP") > barNames.indexOf("Bless")), `chips=${JSON.stringify(barNames)} detail=${tempChip?.querySelector(".dtl")?.textContent}`);
      const hot = document.getElementById("hotbar")?.getBoundingClientRect(), br = bar?.getBoundingClientRect();
      ok("1b. it sits above the hotbar", !!hot && !!br && (br.bottom <= hot.top), `bar.bottom=${br?.bottom} hotbar.top=${hot?.top}`);
      const tagged = bar ? [...bar.querySelectorAll(".bf-ev-chip")].filter(c => c.querySelector("em")).map(c => c.querySelector(".nm").textContent) : [];
      ok("1c. the clockless Death Armor is tagged as painting no icon; Bless (clocked) and Prone (a condition) are not",
        tagged.includes(CLOCKLESS) && !tagged.includes("Bless") && !tagged.includes("Prone"), `tagged=${JSON.stringify(tagged)}`);
      ok("1d. a clockless row shows no clock at all — never the platform's \"None\"",
        !!bar && ![...bar.querySelectorAll(".bf-ev-chip .clk")].some(c => /none/i.test(c.textContent)), "");
    }

    // ---- 2. the hover card
    // The platform's hook, as a mouse-over fires it. Never for a CONTROLLED token (the bar is its
    // list), so the card is proved on the token released.
    if ( want(2) ) {
      Hooks.callAll("hoverToken", token, true);
      await sleep(150);
      ok("2c. a controlled token gets no hover card — the bar is its list (2026-09-18)", !document.querySelector(`.bf-ev-card[data-token="${token.id}"]`), "");
      token.release();
      await sleep(150);
      Hooks.callAll("hoverToken", token, true);
      const card = await until(() => document.querySelector(`.bf-ev-card[data-token="${token.id}"]`), 3000);
      ok("2. the hover card appears for the token with the same list",
        !!card && (card.querySelectorAll(".bf-ev-chip").length === barNames.length), `chips=${card?.querySelectorAll(".bf-ev-chip").length}`);
      Hooks.callAll("hoverToken", token, false);
      await sleep(100);
      ok("2b. and leaves when the hover ends", !document.querySelector(`.bf-ev-card[data-token="${token.id}"]`), "");
      token.control({ releaseOthers: true });
      await sleep(150);
    }

    // ---- 3. the held key
    // Foundry fires highlightObjects on Alt.
    if ( want(3) ) {
      Hooks.callAll("highlightObjects", true);
      const overlay = await until(() => document.querySelectorAll(".bf-ev-card").length ? document.querySelectorAll(".bf-ev-card") : null, 3000);
      ok("3. the held key shows a card for every creature with effects (the Vanguard at least)",
        !!overlay && [...overlay].some(c => c.querySelector("h4")?.textContent.includes("BF Test Vanguard")), `cards=${overlay?.length}`);
      Hooks.callAll("highlightObjects", false);
      await sleep(100);
      ok("3b. and clears on release", document.querySelectorAll(".bf-ev-card").length === 0, "");
    }

    // ⚠ Re-take the token before each bar section: a scene redraw can drop control and stale the
    // cached token object.
    const hold = async section => {
      const live = canvas.tokens.get(doc.id);
      if ( live && !live.controlled ) live.control({ releaseOthers: true });
      const held = await until(() => (canvas.tokens.controlled[0]?.actor === vanguard)
        && (document.getElementById("bf-effect-view-bar")?.dataset.actor === vanguard.uuid), 3000);
      if ( !held ) log.push(`§${section}: could not hold the Vanguard — controlled=${canvas.tokens.controlled.map(t => t.name).join(",") || "none"} `
        + `bar.actor=${document.getElementById("bf-effect-view-bar")?.dataset.actor ?? null} token=${!!live}`);
      return !!held;
    };

    // ---- 4. the bar follows the sheet
    // Delete Bless, the chip leaves.
    if ( want(4) ) {
      await hold(4);
      await vanguard.deleteEmbeddedDocuments("ActiveEffect", [made[0].id]);
      const gone = await until(() => { const b = document.getElementById("bf-effect-view-bar"); const names = b ? [...b.querySelectorAll(".bf-ev-chip .nm")].map(n => n.textContent) : []; return names.includes("Bless") ? null : names; }, 3000);
      ok("4. the bar redraws when an effect is deleted", Array.isArray(gone) && !gone.includes("Bless") && gone.includes("Prone"), `chips=${JSON.stringify(gone)}`);
    }

    // ---- 6. the bar's actions
    // A chip opens a fold with Remove, for an owner. Runs before §5, whose switch takes the bar away.
    if ( want(6) ) {
      await hold(6);
      const barEl = () => document.getElementById("bf-effect-view-bar");
      const chipNamed = name => [...(barEl()?.querySelectorAll("button.bf-ev-chip") ?? [])].find(c => c.querySelector(".nm")?.textContent === name) ?? null;
      const proneChip = chipNamed("Prone");
      proneChip?.click();
      const fold = await until(() => barEl()?.querySelector(".bf-ev-fold"), 2000);
      const foldActions = fold ? [...fold.querySelectorAll("button")].map(b => b.dataset.action) : [];
      ok("6. a chip click opens a fold upward with Remove and nothing else (the GM owns every creature)",
        !!fold && foldActions.length === 1 && foldActions[0] === "remove",
        `actions=${JSON.stringify(foldActions)} proneChip=${!!proneChip} chips=${JSON.stringify([...(barEl()?.querySelectorAll(".bf-ev-chip .nm") ?? [])].map(n => n.textContent))}`);
      fold?.querySelector('button[data-action="remove"]')?.click();
      const proneGone = await until(() => vanguard.effects.get(made[1].id) ? null : true, 4000);
      ok("6c. Remove deletes the effect, and the bar redraws without it",
        proneGone === true && !!(await until(() => chipNamed("Prone") ? null : true, 3000)), "");
      chipNamed("Temporary HP")?.click();
      const fold3 = await until(() => barEl()?.querySelector(".bf-ev-fold"), 2000);
      const clearLabel = fold3?.querySelector('button[data-action="clear"]')?.textContent ?? null;
      fold3?.querySelector('button[data-action="clear"]')?.click();
      const cleared = await until(() => (vanguard.system.attributes.hp.temp ?? 0) === 0 ? true : null, 4000);
      ok("6d. a sheet row's fold says Clear, and Clear zeroes the temp HP", clearLabel === "Clear" && cleared === true, `label=${clearLabel} temp=${vanguard.system.attributes.hp.temp}`);
      barEl()?.querySelector("button.who")?.click();
      const panel = await until(() => barEl()?.querySelector(".bf-ev-panel"), 2000);
      const panelNames = panel ? [...panel.querySelectorAll(".bf-ev-chip .nm")].map(n => n.textContent) : [];
      const panelLabels = panel ? [...panel.querySelectorAll(".bf-ev-lbl")].map(l => l.textContent) : [];
      ok("6e. the name opens the full list upward — ALL of it, grouped as the sheet groups it: the passives (the worn Cloak) join the temporaries, each row clickable",
        !!panel && panelNames.includes(CLOCKLESS) && panelNames.includes("Heroic Inspiration") && panelNames.some(n => n.startsWith("Bonus AC"))
          && panelLabels.includes("Temporary") && panelLabels.includes("Passive") && !!panel.querySelector("button.bf-ev-chip"),
        `groups=${JSON.stringify(panelLabels)} rows=${JSON.stringify(panelNames)}`);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(100);
      ok("6f. Escape closes it", !barEl()?.querySelector(".bf-ev-panel"), "");
    }

    // ---- 5. the switch
    // Off, the bar leaves — the setting's onChange publishes effectViewChanged, the bar's redraw hears it.
    if ( want(5) ) {
      await game.settings.set(MOD, "effectBar", false);
      const off = await until(() => document.getElementById("bf-effect-view-bar") ? null : true, 3000);
      ok("5. the client switch off removes the bar", off === true, "");
    }

    return { results, log, skips };
  } catch(err) {
    return { fatal: `${err?.message ?? err}\n${err?.stack ?? ""}`, results, log, skips };
  } finally {
    try { for ( const c of document.querySelectorAll(".bf-ev-card") ) c.remove(); } catch { /* fine */ }
    try { const ids = [...made, ...seeded].map(e => e.id).filter(id => vanguard.effects.get(id)); if ( ids.length ) await vanguard.deleteEmbeddedDocuments("ActiveEffect", ids); } catch(err) { log.push(`cleanup effects: ${err?.message}`); }
    try { if ( priorSheet ) await vanguard.update({ "system.attributes.hp.temp": priorSheet.temp ?? 0, "system.attributes.inspiration": priorSheet.insp ?? false }); } catch(err) { log.push(`cleanup sheet: ${err?.message}`); }
    try { canvas.tokens?.releaseAll?.(); } catch { /* fine */ }
    try { if ( placed.length ) await scene.deleteEmbeddedDocuments("Token", placed); } catch(err) { log.push(`cleanup tokens: ${err?.message}`); }
    try { await game.settings.set(MOD, "effectBar", priorBar); await game.settings.set(MOD, "effectHover", priorHover); } catch { /* fine */ }
    try { const back = priorActiveScene ? game.scenes.get(priorActiveScene) : null; if ( back && (game.scenes.active?.id !== back.id) ) { await back.activate(); await sleep(800); } } catch { /* fine */ }
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: TAG, out, plan, f });
