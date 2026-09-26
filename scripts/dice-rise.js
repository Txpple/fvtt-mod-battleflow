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
  canvas.interface.addChild(root);
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
