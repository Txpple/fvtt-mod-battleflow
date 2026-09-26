/**
 * Battle Flow — SPINE (ARCHITECTURE.md §2): THE DICE THAT RISE. One renderer for every rule that changes dice the table
 * should see (the user, 2026-09-26: "rebuild the shape"; first drawn for the fighting styles, F7).
 * A caller hands it a token and the chips — the dice as decide/ builds them — and the chips pop up
 * over that token, a turned die flipping from its old face to its new one with a gold flash, a
 * dropped die dimming under a strike (red when it takes a critical with it), and they rise and
 * fade, about a second and a half. Drawn on the canvas interface like core's scrolling text, and
 * off with core's scrollingStatusText setting like it. Every client draws its own; nothing is
 * stored, so a reload replays nothing.
 *
 * A chip: `{label, was?, up?, flat?, drop?, lost?}` — `label` what it shows at rest; `was` the face
 * it turns over FROM; `up` the gold edge (a die that counts, or a bonus); `flat` a bonus, not a die;
 * `drop` a die that no longer counts; `lost` a dropped die that was a critical.
 */

import { MODULE_ID, TITLE } from "./core.js";

/** The canvas token for an actor uuid (geometry.js's reader, one line, kept here: same layer). */
const tokenForUuid = uuid => canvas.tokens?.placeables?.find(t => t.actor?.uuid === uuid) ?? null;

/** Above the tokens, where core's own scrolling text sits (the walk, 2026-09-26: "the floating text
 * appears behind other objects, like tokens, it should be the top most"). */
function onTop(container) {
  container.zIndex = (CONFIG.Canvas?.groups?.interface?.zIndexScrollingText ?? 1100) + 1;
  canvas.interface.addChild(container);
  canvas.interface.sortableChildren = true;
  canvas.interface.sortDirty = true;
}

const GOLD = 0xf3dc9a;
const RED = 0xe06a5a;
const Text = () => foundry.canvas.containers.PreciseText;

/**
 * Raise the chips over a token. A token not visible to this client, or no chips, draws nothing.
 * @param {Token|null} token
 * @param {{label: string, was?: string, up?: boolean, flat?: boolean, drop?: boolean, lost?: boolean}[]} chips
 */
export function riseDice(token, chips) {
  if ( !token?.visible || !chips?.length || !canvas?.interface || !canvas?.app?.ticker ) return;
  if ( game.settings.get("core", "scrollingStatusText") === false ) return;
  const s = canvas.dimensions?.uiScale ?? 1;
  const size = 30, gap = 6, root = new PIXI.Container();
  const turns = [], drops = [];
  chips.forEach((c, i) => {
    const chip = new PIXI.Container();
    chip.position.set(i * (size + gap) + size / 2, size / 2);
    const glow = new PIXI.Graphics().lineStyle(7, c.lost ? RED : GOLD, 0.55).drawRoundedRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4, 7);
    glow.alpha = 0;
    const box = new PIXI.Graphics().lineStyle(c.up ? 2.5 : 1.5, c.up ? GOLD : 0xffffff, c.up ? 1 : 0.8)
      .beginFill(0x14120e, 0.82).drawRoundedRect(-size / 2, -size / 2, size, size, 5).endFill();
    const style = Text().getTextStyle({ fontSize: c.flat ? 15 : 17, fill: "#ffffff", fontWeight: "bold", stroke: 0x000000, strokeThickness: 3 });
    const text = new (Text())(c.was ?? c.label, style);
    text.anchor.set(0.5, 0.5);
    chip.addChild(glow, box, text);
    if ( c.drop ) {
      const strike = new PIXI.Graphics().lineStyle(2.5, c.lost ? RED : 0xffffff, 0.95).moveTo(-size / 2 + 4, size / 2 - 4).lineTo(size / 2 - 4, -size / 2 + 4);
      strike.alpha = 0;
      chip.addChild(strike);
      drops.push({ chip, glow, strike, lost: !!c.lost });
    }
    root.addChild(chip);
    if ( c.up ) turns.push({ chip, glow, text, to: c.label, flips: !!c.was, turned: false });
  });
  const width = (chips.length * size) + ((chips.length - 1) * gap);
  root.pivot.set(width / 2, size);
  const y0 = token.document.y - 8;
  root.position.set(token.center.x, y0);
  root.alpha = 0;
  onTop(root);
  const start = performance.now(), total = 1900;
  const tick = () => {
    const t = performance.now() - start;
    if ( (t >= total) || root.destroyed ) {
      canvas.app.ticker.remove(tick);
      if ( !root.destroyed ) root.destroy({ children: true });
      return;
    }
    // in: 0–250 fade and grow; out: 1200–1900 rise and fade
    const pop = Math.min(1, t / 250);
    root.alpha = t < 1200 ? pop : Math.max(0, 1 - ((t - 1200) / 700));
    root.scale.set(s * (0.6 + (0.4 * pop)));
    root.position.y = y0 - (t > 1200 ? ((t - 1200) / 700) * 40 * s : 0);
    for ( const u of turns ) {
      // 400–600 the turn: the chip folds shut, shows its new face, opens; the flash peaks at 550.
      // A chip with nothing to turn (a kept die, a bonus) only flashes.
      const k = (t - 400) / 200;
      if ( u.flips ) {
        if ( (k >= 0.5) && !u.turned ) { u.text.text = u.to; u.turned = true; }
        u.chip.scale.y = ((k > 0) && (k < 1)) ? Math.max(0.05, Math.abs(1 - (2 * k))) : 1;
      }
      u.glow.alpha = (t < 400) ? 0 : Math.max(0, 1 - (Math.abs(t - 550) / 350));
    }
    for ( const d of drops ) {
      // 450–650 the drop: the strike draws in, the chip dims; a lost critical flashes red first
      const k = Math.min(1, Math.max(0, (t - 450) / 200));
      d.strike.alpha = k;
      d.chip.alpha = 1 - (0.6 * k);
      if ( d.lost ) d.glow.alpha = (t < 350) ? 0 : Math.max(0, 1 - (Math.abs(t - 500) / 300));
    }
  };
  canvas.app.ticker.add(tick);
}

/**
 * One chip that travels: it pops over `from`, glides to `to` and pops there, then fades — the
 * reduction a guard gave landing on the ally (group 2). The same token both ends pops it in place.
 * @param {Token|null} from
 * @param {Token|null} to
 * @param {string} label
 */
export function driftChip(from, to, label) {
  const end = to?.visible ? to : null;
  const start = from?.visible ? from : end;
  if ( !start || !end || !label || !canvas?.interface || !canvas?.app?.ticker ) return;
  if ( game.settings.get("core", "scrollingStatusText") === false ) return;
  const s = canvas.dimensions?.uiScale ?? 1;
  const w = Math.max(38, 12 + (label.length * 11)), h = 30;
  const chip = new PIXI.Container();
  const glow = new PIXI.Graphics().lineStyle(7, GOLD, 0.55).drawRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 7);
  const box = new PIXI.Graphics().lineStyle(2.5, GOLD, 1).beginFill(0x14120e, 0.85).drawRoundedRect(-w / 2, -h / 2, w, h, 5).endFill();
  const text = new (Text())(label, Text().getTextStyle({ fontSize: 17, fill: "#ffffff", fontWeight: "bold", stroke: 0x000000, strokeThickness: 3 }));
  text.anchor.set(0.5, 0.5);
  chip.addChild(glow, box, text);
  const p0 = { x: start.center.x, y: start.document.y - 8 - (h / 2) };
  const p1 = { x: end.center.x, y: end.document.y - 8 - (h / 2) };
  chip.position.set(p0.x, p0.y);
  chip.alpha = 0;
  onTop(chip);
  const moves = (p0.x !== p1.x) || (p0.y !== p1.y);
  const t0 = performance.now(), total = moves ? 1700 : 1300;
  const ease = k => 0.5 - (Math.cos(Math.PI * k) / 2);
  const tick = () => {
    const t = performance.now() - t0;
    if ( (t >= total) || chip.destroyed ) {
      canvas.app.ticker.remove(tick);
      if ( !chip.destroyed ) chip.destroy({ children: true });
      return;
    }
    const pop = Math.min(1, t / 200);
    chip.scale.set(s * (0.6 + (0.4 * pop)));
    if ( moves ) {
      // 200–900 the glide, an arc over the table; then the landing flash
      const k = ease(Math.min(1, Math.max(0, (t - 200) / 700)));
      chip.position.set(p0.x + ((p1.x - p0.x) * k), p0.y + ((p1.y - p0.y) * k) - (Math.sin(Math.PI * k) * 40 * s));
    }
    const land = moves ? 900 : 300;
    glow.alpha = Math.max(0, 1 - (Math.abs(t - land) / 300));
    const out = total - 600;
    chip.alpha = t < out ? pop : Math.max(0, 1 - ((t - out) / 600));
    if ( t > out ) chip.position.y -= 0.6 * s;
  };
  canvas.app.ticker.add(tick);
}

/**
 * THE RECORD ON A ROLL MESSAGE (`flags.<module>.diceRise`, decide/dice-chips.js): a machine that
 * rolls in the open tags its message, and every client plays it once as the message arrives — the
 * chips over `on`, then the drift. A reload replays nothing (createChatMessage fires live only).
 */
Hooks.on("createChatMessage", message => {
  const rise = message.getFlag?.(MODULE_ID, "diceRise");
  if ( !rise?.on ) return;
  try {
    const from = tokenForUuid(rise.on);
    riseDice(from, rise.chips ?? []);
    if ( rise.drift?.label ) setTimeout(() => driftChip(from, tokenForUuid(rise.drift.to ?? rise.on), rise.drift.label), 900);
  } catch(err) {
    console.warn(`${TITLE} | the dice could not draw.`, err);
  }
});
