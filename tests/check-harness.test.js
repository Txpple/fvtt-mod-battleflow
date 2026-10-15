import { describe, expect, it } from "vitest";
import { readSuite } from "../tools/check-harness.mjs";

/*
 * THE HARNESS CHECK (tools/check-harness.mjs) — what it reads in a suite's text: the bare waits and
 * whether each names a module clock, and the helpers a suite on the prelude must not define.
 */

const kinds = text => readSuite(text).helpers.map(h => h.kind);

describe("readSuite — the bare waits", () => {
  it("counts sleep calls and timeout promises, with their literal ms, and not a sleep's own definition", () => {
    const { waits } = readSuite(`
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      await sleep(800);
      await window.__btb.sleep(1_200);
      await new Promise(r => setTimeout(r, 500));
    `);
    expect(waits.map(w => w.ms)).toEqual([800, 1200, 500]);
  });

  it("a wait is marked by a clock: comment on its line or the line above", () => {
    const { waits } = readSuite(`
      await sleep(300);   // clock: the hold's settle window
      // clock: the Decision Timer's buzzer
      await sleep(4000);
      await sleep(200);
    `);
    expect(waits.map(w => w.marked)).toEqual([true, true, false]);
  });
});

describe("readSuite — the private helpers", () => {
  it("finds the copied sleep, poll, ok, want, settings snapshot and dice rigging", () => {
    expect(
      kinds(`
      const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
      const want = id => !sections || sections.includes(String(id));
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const waitFor = async (test, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return true; await sleep(200); } return false; };
      const prior = Object.fromEntries(KEYS.map(k => [k, game.settings.get(MOD, k)]));
      CONFIG.Dice.randomUniform = () => 0.5;
    `)
    ).toEqual(["ok", "want", "sleep", "poll", "settings snapshot", "dice rigging"]);
  });

  it("an inline loop that awaits a sleep is a wait loop; a function looping on one is a poll", () => {
    expect(
      kinds(`
      for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
      const placeToken = async id => { for (let i = 0; i < 40 && !canvas.tokens.get(id); i++) await sleep(250); };
    `)
    ).toEqual(["wait loop", "poll"]);
  });

  it("a loop whose wait names its clock is a paced loop, not a wait loop; a value named ok is not a helper", () => {
    expect(
      kinds(`
      for (const k of keys) { click(k); await sleep(60); }   // clock: the debounce on the tick rows
      const ok = await until(() => card());
      const settings = { a: game.settings.get(MOD, 'a') };
    `)
    ).toEqual([]);
  });

  it("an object of two or more settings reads is a snapshot", () => {
    expect(
      kinds(`const restore = { a: game.settings.get(MOD, 'a'), b: game.settings.get(MOD, 'b') };`)
    ).toEqual(["settings snapshot"]);
  });
});
