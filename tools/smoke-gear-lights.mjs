// Live suite: GEAR LIGHTS (issue #7) — using a Candle, Torch, Lamp or Lantern opens only the light
// toggle (no activity, no usage card, nothing consumed), and its presses light, put out and switch the
// hood on the bearer's token through one effect; one gear light at a time; a Long Rest puts it out.
//
// Fixtures: BTB Test PC Attacker (tools/fixture-suite.mjs; player-owned, a token on the range) is lent
// the five PHB items and two copies under the 2014 names; every lent item, effect and card is torn down.
// The suite presses the popup's own buttons: §1–§10 on the GM's client, §11 on the owning player's
// (FOUNDRY_PLAYER_USER) — the seam is the client that used the item.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, disposeSafely, finish, loadEnv, sectionArg, sectionPlan } from './harness.mjs';
import { installPrelude } from './prelude.mjs';
import { playerConfig } from './target.mjs';
import { Foundry } from 'fvtt-mcp-dnd5e/client';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'gear-lights.js'    // §1 the seam, §2–§5 the presses, §6 the Torch's attack, §7 the hotbar, §8 the rests, §9 the item gone, §10 the picker
];

const SECTIONS = {
  1: 'THE SEAM: each of the five items and the two 2014 names, used from the sheet\'s path (item.use), opens the toggle and posts no card; no quantity moves',
  2: 'LIGHT AND OUT: the Torch\'s Light lands one effect lighting the token 20/40, orange and flickering, with a card; Put out deletes it and the token\'s own light is back',
  3: 'THE HOOD: the Hooded Lantern lit hood up (30/60), lowered (0/5) and raised (30/60) on ONE effect',
  4: 'THE BULLSEYE: its light carries the 53.13° cone',
  5: 'ONE LIGHT: lighting the Candle puts out the lit Torch, and the card says so',
  6: 'THE TORCH\'S ATTACK: its Attack activity used directly opens the toggle, and no attack card is posted',
  7: 'THE HOTBAR: dnd5e\'s item macro (rollItem) on the Lamp opens the toggle',
  8: 'THE RESTS: a Short Rest leaves the Torch lit; a Long Rest puts it out with ONE card, and a Token Lights light (Light) survives',
  9: 'THE ITEM GONE: deleting a lit item takes its light with it',
  10: 'THE PICKER: a world copy with a second activity opens the toggle, the picker dismissed unseen',
  11: "THE PLAYER: on the owning player's own client the Torch opens the toggle, Light lights the token, Put out puts it out, and the player's Long Rest puts it out with one card"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'gearlights', watchdogMs: 240_000 });
announcePlan('gearlights', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-bythebooks';
  const { until, watch, viewScene } = window.__btb;
  const { results, log, skips, ok, want, section } = window.__btb.begin({ sections, titles });

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const pc = game.actors.getName('BTB Test PC Attacker');
  if (!pc) return { fatal: 'missing fixture: BTB Test PC Attacker — run tools/fixture-suite.mjs' };
  const range = game.scenes.getName('By the Books Test Range');
  if (!range) return { fatal: 'missing fixture: scene By the Books Test Range — run tools/fixture-suite.mjs' };
  // Soft: the fatal below names a range that never readied (a throw out here would end the run with no report).
  await viewScene(range).catch(() => null);
  if (canvas.scene?.id !== range.id) return { fatal: 'the canvas never readied on the test range' };
  // The fixtures place no token for the player's PC: the suite places one, torn down with it.
  let placedToken = null;
  let tokenDoc = canvas.scene.tokens.find(t => t.actor?.id === pc.id) ?? null;
  if (!tokenDoc) {
    const grid = canvas.scene.grid.size;
    const data = (await pc.getTokenDocument({ x: grid * 2, y: grid * 2 })).toObject();
    [tokenDoc] = await canvas.scene.createEmbeddedDocuments('Token', [data]);
    placedToken = tokenDoc?.id ?? null;
  }
  if (!tokenDoc) return { fatal: "could not place the PC's token on the range" };
  const pack = game.packs.get('dnd-players-handbook.equipment');
  if (!pack) return { fatal: "the Player's Handbook equipment pack is not on this box" };

  const own = { bright: tokenDoc._source.light?.bright ?? 0, dim: tokenDoc._source.light?.dim ?? 0, angle: tokenDoc._source.light?.angle ?? 360 };
  const lightNow = () => {
    const t = canvas.scene.tokens.get(tokenDoc.id);
    return { bright: t?.light?.bright ?? null, dim: t?.light?.dim ?? null, angle: t?.light?.angle ?? null };
  };
  const gearFx = () => pc.effects.filter(e => e.getFlag(MOD, 'gearLight'));
  const fxOf = item => gearFx().find(e => e.getFlag(MOD, 'gearLight')?.itemId === item.id) ?? null;
  const lent = [];
  const madeEffects = [];
  const startedAt = Date.now();
  const newMessages = since => game.messages.filter(m => (m.timestamp >= since) && (m.speaker?.actor === pc.id));
  const cardText = m => (m?.content ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const toggles = () => [...foundry.applications.instances.values()]
    .filter(a => (a instanceof foundry.applications.api.DialogV2) && a.rendered && /Gear light/.test(a.element?.textContent ?? ''));
  const toggleFor = item => toggles().find(a => a.title === item.name) ?? null;
  const closeToggles = async () => { for (const a of toggles()) { try { await a.close(); } catch { /* gone */ } } };
  const pressOn = async (item, action) => {
    const dlg = await until(() => toggleFor(item), { timeout: 5000, label: `${item.name}'s toggle` });
    const button = dlg?.element?.querySelector(`button[data-action="${action}"]`);
    if (!button) throw new Error(`no "${action}" on ${item.name}'s toggle: ${[...(dlg?.element?.querySelectorAll('button[data-action]') ?? [])].map(b => b.dataset.action).join(', ')}`);
    button.click();
  };
  const useIt = async (item, how = () => item.use({ legacy: false })) => {
    await closeToggles();
    const since = Date.now();
    const result = await how();
    const dlg = await until(() => toggleFor(item), { timeout: 5000, label: `${item.name}'s toggle` });
    // ⚠ A window: a card the seam failed to stop shows within it.
    const cards = (await watch(() => { const c = newMessages(since); return c.length ? c : null; }, { ms: 300 })) ?? [];
    return { result, dlg, cards };
  };

  const teardown = async () => {
    try {
      await closeToggles();
      for (const e of [...gearFx(), ...madeEffects.map(id => pc.effects.get(id)).filter(Boolean)]) { try { await e.delete(); } catch { /* gone */ } }
      const live = lent.filter(id => pc.items.get(id));
      if (live.length) await pc.deleteEmbeddedDocuments('Item', live);
      if (placedToken && canvas.scene.tokens.get(placedToken)) await canvas.scene.deleteEmbeddedDocuments('Token', [placedToken]);
      const cards = newMessages(startedAt).map(m => m.id);
      if (cards.length) await ChatMessage.deleteDocuments(cards);
    } catch (err) { log.push(`TEARDOWN ERROR: ${err?.message}`); }
  };

  const lend = async (id, patch = {}) => {
    const src = (await pack.getDocument(id))?.toObject();
    if (!src) throw new Error(`the PHB ships no ${id} on this box`);
    foundry.utils.mergeObject(src, patch);
    const [item] = await pc.createEmbeddedDocuments('Item', [src]);
    lent.push(item.id);
    return item;
  };

  try {
    for (const e of gearFx()) await e.delete();   // a killed run's leftovers
    const candle = await lend('phbagCandle00000', { system: { quantity: 3 } });
    const torch = await lend('phbagTorch000000', { system: { quantity: 2 } });
    const lamp = await lend('phbagLamp0000000');
    const hooded = await lend('phbagLanternHood');
    const bullseye = await lend('phbagLanternBull');
    const hooded14 = await lend('phbagLanternHood', { name: 'Hooded Lantern', system: { identifier: 'hooded-lantern' } });
    const bullseye14 = await lend('phbagLanternBull', { name: 'Bullseye Lantern', system: { identifier: 'bullseye-lantern' } });
    const all = [candle, torch, lamp, hooded, bullseye, hooded14, bullseye14];

    if (want(1)) await section(1, async () => {
      for (const item of all) {
        const qty = item.system.quantity;
        const { dlg, cards } = await useIt(item);
        ok(`§1 ${item.name}: the toggle opens and no card is posted`, !!dlg && !cards.length,
          `toggle=${!!dlg} cards=${cards.map(m => cardText(m).slice(0, 60)).join(' | ')}`);
        ok(`§1 ${item.name}: nothing used up`, pc.items.get(item.id)?.system.quantity === qty, `quantity ${qty} → ${pc.items.get(item.id)?.system.quantity}`);
      }
      await closeToggles();
    });

    if (want(2)) await section(2, async () => {
      await useIt(torch);
      const since = Date.now();
      await pressOn(torch, 'light-lit');
      const fx = await until(() => fxOf(torch), { timeout: 6000 });
      const lit = await until(() => (lightNow().bright === 20) ? lightNow() : null, { timeout: 5000 });
      ok('§2 Light lands one effect lighting the token 20/40', !!fx && (gearFx().length === 1) && (lit?.dim === 40),
        `effect=${fx?.name} light=${JSON.stringify(lightNow())} duration=${JSON.stringify(fx?._source?.duration ?? null)}`);
      ok('§2 the effect has no clock and names the item', !!fx && (fx._source.duration?.value == null) && !Number.isFinite(fx.duration?.seconds ?? Infinity) && (fx.origin === torch.uuid) && (fx.name === 'Torch (lit)'),
        `name=${fx?.name} origin=${fx?.origin} item=${torch.uuid} duration=${JSON.stringify(fx?.duration ?? null)}`);
      const shone = canvas.scene.tokens.get(tokenDoc.id)?.light;
      const look = { color: shone?.color ? String(shone.color) : null, attenuation: shone?.attenuation, animation: shone?.animation?.type, intensity: shone?.animation?.intensity };
      ok('§2 the torch shines orange and flickers, soft at the edge (GEAR_LOOKS.torch)',
        (look.color === '#ff8a33') && (look.animation === 'torch') && (look.intensity === 7) && (look.attenuation >= 0.8), JSON.stringify(look));
      const card = await until(() => newMessages(since).find(m => /lights the Torch/.test(cardText(m))), { timeout: 5000 });
      ok('§2 the card says it and carries the effect receipt', /lights the Torch: 20 ft Bright, 20 ft more Dim/.test(cardText(card))
        && (card?.getFlag(MOD, 'effectReceipt')?.targets?.[0]?.effects?.[0]?.id === fx?.id), cardText(card).slice(0, 160));
      await useIt(torch);
      const since2 = Date.now();
      await pressOn(torch, 'out');
      const gone = await until(() => !fxOf(torch), { timeout: 6000 });
      const back = await until(() => (lightNow().bright === own.bright) && (lightNow().dim === own.dim), { timeout: 5000 });
      const card2 = await until(() => newMessages(since2).find(m => /puts out the Torch/.test(cardText(m))), { timeout: 5000 });
      ok('§2 Put out deletes it and the token\'s own light is back', gone && back && !!card2, `light=${JSON.stringify(lightNow())} own=${JSON.stringify(own)} card=${!!card2}`);
    });

    if (want(3)) await section(3, async () => {
      await useIt(hooded);
      const labels = [...(toggleFor(hooded)?.element?.querySelectorAll('button[data-action]') ?? [])].map(b => b.textContent.trim());
      ok('§3 unlit, the toggle offers hood up and hood down', labels.some(l => /hood up/.test(l)) && labels.some(l => /hood down/.test(l)), labels.join(' | '));
      await pressOn(hooded, 'light-lit');
      const fx = await until(() => fxOf(hooded), { timeout: 6000 });
      const up = await until(() => (lightNow().bright === 30 && lightNow().dim === 60) ? true : null, { timeout: 5000 });
      await useIt(hooded);
      await pressOn(hooded, 'switch-hoodDown');
      const down = await until(() => (lightNow().bright === 0 && lightNow().dim === 5) ? true : null, { timeout: 5000 });
      const sameDown = fxOf(hooded)?.id === fx?.id;
      await useIt(hooded);
      await pressOn(hooded, 'switch-lit');
      const upAgain = await until(() => (lightNow().bright === 30 && lightNow().dim === 60) ? true : null, { timeout: 5000 });
      ok('§3 hood up 30/60 → down 0/5 → up 30/60 on one effect', !!up && !!down && !!upAgain && sameDown && (fxOf(hooded)?.id === fx?.id),
        `up=${!!up} down=${!!down} upAgain=${!!upAgain} sameEffect=${sameDown && (fxOf(hooded)?.id === fx?.id)} light=${JSON.stringify(lightNow())}`);
      await useIt(hooded);
      await pressOn(hooded, 'out');
      await until(() => !fxOf(hooded), { timeout: 5000 });
    });

    if (want(4)) await section(4, async () => {
      await useIt(bullseye);
      await pressOn(bullseye, 'light-lit');
      const lit = await until(() => (lightNow().bright === 60) ? lightNow() : null, { timeout: 6000 });
      ok('§4 the bullseye lights 60/120 in a 53.13° cone', (lit?.dim === 120) && (Math.abs((lit?.angle ?? 0) - 53.13) < 0.01), JSON.stringify(lightNow()));
      await useIt(bullseye);
      await pressOn(bullseye, 'out');
      const back = await until(() => (lightNow().angle === own.angle) ? true : null, { timeout: 5000 });
      ok('§4 put out, the token\'s own cone is back', !!back, JSON.stringify(lightNow()));
    });

    if (want(5)) await section(5, async () => {
      await useIt(torch);
      await pressOn(torch, 'light-lit');
      await until(() => fxOf(torch), { timeout: 6000 });
      const since = Date.now();
      await useIt(candle);
      await pressOn(candle, 'light-lit');
      const swapped = await until(() => (fxOf(candle) && !fxOf(torch)) ? true : null, { timeout: 6000 });
      const lit = await until(() => (lightNow().bright === 5) ? lightNow() : null, { timeout: 5000 });
      const card = await until(() => newMessages(since).find(m => /lights the Candle/.test(cardText(m))), { timeout: 5000 });
      ok('§5 the Candle lit puts the Torch out: one gear light', !!swapped && (gearFx().length === 1) && (lit?.dim === 10),
        `effects=${gearFx().map(e => e.name).join(', ')} light=${JSON.stringify(lightNow())}`);
      ok('§5 the card says the Torch went out first', /Torch put out first/.test(cardText(card)), cardText(card).slice(0, 200));
      await useIt(candle);
      await pressOn(candle, 'out');
      await until(() => !gearFx().length, { timeout: 5000 });
    });

    if (want(6)) await section(6, async () => {
      const attack = [...torch.system.activities].find(a => a.type === 'attack') ?? null;
      if (!attack) log.push('§6: this box\'s Torch has no Attack activity');
      const { dlg, cards } = await useIt(torch, () => attack?.use({}, { configure: false }, {}));
      ok('§6 the Torch\'s attack opens the toggle and posts no attack card', !!attack && !!dlg && !cards.length,
        `attack=${!!attack} toggle=${!!dlg} cards=${cards.map(m => cardText(m).slice(0, 60)).join(' | ')}`);
      await closeToggles();
    });

    if (want(7)) await section(7, async () => {
      const pcToken = canvas.tokens.get(tokenDoc.id);
      pcToken?.control({ releaseOthers: true });   // synchronous: the macro reads the controlled token at once
      const { dlg, cards } = await useIt(lamp, () => dnd5e.documents.macro.rollItem('Lamp'));
      ok('§7 the hotbar\'s item macro opens the toggle and posts no card', !!dlg && !cards.length, `toggle=${!!dlg} cards=${cards.length}`);
      await closeToggles();
      pcToken?.release();
    });

    if (want(8)) await section(8, async () => {
      // A Token Lights light the Long Rest must not touch: the Light cantrip's fingerprint, by hand.
      const [spellLight] = await pc.createEmbeddedDocuments('ActiveEffect', [{ name: 'Light', type: 'base', img: 'icons/magic/light/explosion-star-glow-silhouette.webp',
        flags: { [MOD]: { tokenLight: { key: 'Light', sourceUuid: pc.uuid } } } }]);
      madeEffects.push(spellLight.id);
      await useIt(torch);
      await pressOn(torch, 'light-lit');
      await until(() => fxOf(torch), { timeout: 6000 });
      await pc.shortRest({ dialog: false, chat: false });
      // ⚠ A window: a wrong put-out lands within it.
      const putOut = await watch(() => !fxOf(torch), { ms: 800 });
      ok('§8 a Short Rest leaves the Torch lit', !putOut && !!fxOf(torch), `put out=${!!putOut} effects=${gearFx().map(e => e.name).join(', ')}`);
      const since = Date.now();
      const restCards = () => newMessages(since).filter(m => /goes out \(Long Rest\)/.test(cardText(m)));
      await pc.longRest({ dialog: false, chat: false, newDay: false });
      const out = await until(() => !fxOf(torch), { timeout: 6000 });
      // ⚠ A window: a second card shows within it.
      const second = await watch(() => restCards().length > 1, { ms: 800 });
      const cards = restCards();
      ok('§8 a Long Rest puts it out with one card', !!out && (cards.length === 1) && !second, `out=${!!out} cards=${cards.length}: ${cards.map(cardText).join(' | ').slice(0, 200)}`);
      ok('§8 the Light cantrip\'s light survives the Long Rest', !!pc.effects.get(spellLight.id), `standing=${!!pc.effects.get(spellLight.id)}`);
    });

    if (want(9)) await section(9, async () => {
      const spare = await lend('phbagTorch000000', { name: 'Torch' });
      await useIt(spare);
      await pressOn(spare, 'light-lit');
      await until(() => fxOf(spare), { timeout: 6000 });
      const id = spare.id;
      await spare.delete();
      const gone = await until(() => !gearFx().some(e => e.getFlag(MOD, 'gearLight')?.itemId === id), { timeout: 6000 });
      ok('§9 deleting a lit item takes its light with it', !!gone, `effects=${gearFx().map(e => e.name).join(', ')}`);
    });

    if (want(10)) await section(10, async () => {
      const copy = await lend('phbagTorch000000', { name: 'Torch' });
      await copy.update({ "system.activities.lightUseZz000001": { _id: 'lightUseZz000001', type: 'utility', name: 'Light' } });
      const count = [...pc.items.get(copy.id).system.activities].filter(a => a.canUse).length;
      const { dlg, cards } = await useIt(pc.items.get(copy.id));
      const picker = [...foundry.applications.instances.values()].some(a => (a.constructor?.name === 'ActivityChoiceDialog') && a.rendered);
      ok('§10 a two-activity copy opens the toggle; the picker is gone and no card is posted', (count === 2) && !!dlg && !picker && !cards.length,
        `activities=${count} toggle=${!!dlg} picker=${picker} cards=${cards.length}`);
      await closeToggles();
    });
  } catch (err) {
    results.push({ name: 'suite threw', pass: false, detail: `${err?.message}\n${err?.stack}` });
  } finally {
    await teardown();
  }
  return { results, log, skips };
}, sectionArg(plan, SECTIONS));

/* --- §11 THE PLAYER: the same presses on the owning player's own client ------------------------------ */

const wants11 = !plan || plan.map(String).includes('11');
if (!out?.fatal && wants11) {
  const setup = await f.evaluate(async () => {
    const pc = game.actors.getName('BTB Test PC Attacker');
    const range = game.scenes.getName('By the Books Test Range');
    const src = (await game.packs.get('dnd-players-handbook.equipment').getDocument('phbagTorch000000')).toObject();
    const [torch] = await pc.createEmbeddedDocuments('Item', [src]);
    let token = range.tokens.find(t => t.actor?.id === pc.id) ?? null;
    let placed = null;
    if (!token) {
      const data = (await pc.getTokenDocument({ x: range.grid.size * 2, y: range.grid.size * 2 })).toObject();
      [token] = await range.createEmbeddedDocuments('Token', [data]);
      placed = token.id;
    }
    return { torchId: torch.id, tokenId: token.id, placed, owners: Object.entries(pc.ownership).filter(([, v]) => v >= 3).map(([k]) => k) };
  }, null);
  let player = null;
  try {
    player = new Foundry(playerConfig(loadEnv()));
    await player.connect();
    await installPrelude(player);
    const got = await player.evaluate(async ({ torchId, tokenId }) => {
      const MOD = 'fvtt-mod-bythebooks';
      const { until, watch, viewScene } = window.__btb;
      const { results, ok, section } = window.__btb.begin();
      const pc = game.actors.getName('BTB Test PC Attacker');
      const torch = pc?.items.get(torchId);
      if (!pc?.isOwner || !torch) return { results: [{ name: '§11 the player owns the PC and its Torch', pass: false, detail: `owner=${pc?.isOwner} torch=${!!torch} user=${game.user.name}` }] };
      const range = game.scenes.getName('By the Books Test Range');
      // Soft: the toggle and the lights read dialogs and documents; the view is the player's own.
      if (range) await viewScene(range).catch(() => null);
      const light = () => { const t = range?.tokens.get(tokenId); return { bright: t?.light?.bright ?? null, dim: t?.light?.dim ?? null }; };
      const fx = () => pc.effects.find(e => e.getFlag(MOD, 'gearLight')?.itemId === torch.id) ?? null;
      const toggle = () => [...foundry.applications.instances.values()]
        .find(a => (a instanceof foundry.applications.api.DialogV2) && a.rendered && (a.title === torch.name) && /Gear light/.test(a.element?.textContent ?? '')) ?? null;
      const press = async action => { (await until(toggle, { timeout: 5000, label: "the Torch's toggle" }))?.element?.querySelector(`button[data-action="${action}"]`)?.click(); };
      const since = Date.now();
      const mine = () => game.messages.filter(m => (m.timestamp >= since) && (m.speaker?.actor === pc.id));
      // The section runner: a wait that throws fails §11 by name, and the oks made before it are still returned.
      await section(11, async () => {
        await torch.use({ legacy: false });
        const dlg = await until(toggle, { timeout: 5000, label: "the Torch's toggle" });
        // ⚠ A window: a card the seam failed to stop shows within it.
        const stray = await watch(() => mine().length > 0, { ms: 300 });
        ok("§11 on the player's client the Torch opens the toggle and posts no card", !!dlg && !stray && !mine().length, `toggle=${!!dlg} cards=${mine().length} user=${game.user.name}`);
        await press('light-lit');
        const lit = await until(() => (fx() && (light().bright === 20)) ? light() : null, { timeout: 8000 });
        ok("§11 the player's Light lights the token 20/40", lit?.dim === 40, JSON.stringify(light()));
        await torch.use({ legacy: false });
        await press('out');
        const out = await until(() => !fx(), { timeout: 8000 });
        ok("§11 the player's Put out deletes it", !!out, `effect=${!!fx()}`);
        await torch.use({ legacy: false });
        await press('light-lit');
        await until(fx, { timeout: 8000 });
        const restSince = Date.now();
        const restCards = () => game.messages.filter(m => (m.timestamp >= restSince) && /goes out \(Long Rest\)/.test(m.content ?? ''));
        await pc.longRest({ dialog: false, chat: false, newDay: false });
        const gone = await until(() => !fx(), { timeout: 8000 });
        // ⚠ A window: a second client's card shows within it.
        const second = await watch(() => restCards().length > 1, { ms: 1500 });
        const cards = restCards();
        ok("§11 the player's Long Rest puts it out with one card", !!gone && (cards.length === 1) && !second, `gone=${!!gone} cards=${cards.length}`);
      });
      return { results };
    }, setup);
    for (const r of got?.results ?? []) out.results.push(r);
  } catch (err) {
    out.results.push({ name: '§11 the player client', pass: false, detail: `${err?.message}` });
  } finally {
    if (player) await disposeSafely(player, 'gearlights');
    await f.evaluate(async ({ torchId, placed }) => {
      const pc = game.actors.getName('BTB Test PC Attacker');
      for (const e of pc.effects.filter(e => e.getFlag('fvtt-mod-bythebooks', 'gearLight'))) { try { await e.delete(); } catch { /* gone */ } }
      if (pc.items.get(torchId)) await pc.items.get(torchId).delete();
      const range = game.scenes.getName('By the Books Test Range');
      if (placed && range?.tokens.get(placed)) await range.deleteEmbeddedDocuments('Token', [placed]);
      const cards = game.messages.filter(m => (m.speaker?.actor === pc.id) && /Gear light/.test(m.content ?? '')).map(m => m.id);
      if (cards.length) await ChatMessage.deleteDocuments(cards);
    }, setup);
  }
}

await finish({ tag: 'gearlights', out, plan, f });
