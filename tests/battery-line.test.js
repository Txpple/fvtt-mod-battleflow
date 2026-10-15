import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkTagBody,
  FORMS,
  lineOf,
  NONE_LINE,
  parseLine,
  readRun
} from "../tools/battery-line.mjs";

/*
 * THE BATTERY LINE (tools/battery-line.mjs) — one run in one line, and the release rule over a tag
 * body. The runs here are small fake run directories in the shape battery.mjs writes: a plan.json
 * of rows and one <row>.txt per finished row, its verdict on its last summary line.
 */

const ROOT = mkdtempSync(join(tmpdir(), "battery-line-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

/** A run directory: `files` maps a row to its output; a row in `plan` without one is unfinished. */
function fakeRun(id, plan, files) {
  const dir = join(ROOT, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.json"), `${JSON.stringify(plan)}\n`);
  for (const [row, body] of Object.entries(files)) writeFileSync(join(dir, `${row}.txt`), body);
  return dir;
}

const PLAN = ["setup-fixtures", "smoke-alert", "smoke-hold", "check-popup-routing"];
const GREEN_FILES = {
  "setup-fixtures": "[fixtures] built 22 actors\n",
  "smoke-alert": "[alert] swept the downed leftovers\n  PASS a\n[alert] 10/10 passed\n",
  "smoke-hold": "[hold] 51/51 passed\n",
  "check-popup-routing": "  PASS one\n  PASS two\n[topo] ALL PASS\n"
};
const GREEN_ID = "2026-10-15T13-55-32";
const RED_ID = "2026-10-15T13-35-41";
const PARTIAL_ID = "2026-10-15T14-00-00";
const greenDir = fakeRun(GREEN_ID, PLAN, GREEN_FILES);
const redDir = fakeRun(RED_ID, PLAN, { ...GREEN_FILES, "smoke-hold": "[hold] 50/51 passed\n" });
const partialDir = fakeRun(PARTIAL_ID, PLAN, {
  "setup-fixtures": GREEN_FILES["setup-fixtures"],
  "smoke-alert": GREEN_FILES["smoke-alert"]
});
const GREEN_LINE = `Battery: ${GREEN_ID} — 4/4 suites, 63/63 checks, GREEN`;
const runs = { [GREEN_ID]: greenDir, [RED_ID]: redDir, [PARTIAL_ID]: partialDir };
const runOf = id => (runs[id] ? readRun(runs[id]) : null);

/** A tag body in the shape of a release's notes, with `line` among them. */
const notes = (...lines) =>
  ["- **A fix.** What it does now.", "", ...lines, "", "- **Another.** And this."].join("\n");

describe("readRun and lineOf — the run in one line", () => {
  it("a finished green run: every entry green, the checks summed, GREEN", () => {
    const run = readRun(greenDir);
    expect(run.id).toBe(GREEN_ID);
    expect(run.total).toBe(4);
    expect(run.green).toBe(4);
    expect(run.checks).toEqual({ pass: 63, all: 63 });
    expect(lineOf(run)).toBe(GREEN_LINE);
  });

  it("a finished entry red is a RED run, its suite and its check short", () => {
    expect(lineOf(readRun(redDir))).toBe(`Battery: ${RED_ID} — 3/4 suites, 62/63 checks, RED`);
  });

  it("an entry with no output is a PARTIAL run, counted over the whole plan", () => {
    expect(lineOf(readRun(partialDir))).toBe(
      `Battery: ${PARTIAL_ID} — 2/4 suites, 10/10 checks, PARTIAL`
    );
  });

  it("a red entry outranks an unfinished one: the run is RED", () => {
    const dir = fakeRun("2026-10-15T15-00-00", PLAN, {
      "setup-fixtures": GREEN_FILES["setup-fixtures"],
      "smoke-alert": "[alert] 9/10 passed\n"
    });
    expect(readRun(dir).verdict).toBe("RED");
  });

  it("a run without a plan.json reads the battery's order", () => {
    const dir = join(ROOT, "2026-10-15T16-00-00");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "smoke-hold.txt"), "[hold] 51/51 passed\n");
    const run = readRun(dir, () => ["smoke-hold"]);
    expect(lineOf(run)).toBe("Battery: 2026-10-15T16-00-00 — 1/1 suites, 51/51 checks, GREEN");
  });

  it("the line it prints is the line the parser reads back", () => {
    for (const dir of [greenDir, redDir, partialDir]) {
      const run = readRun(dir);
      expect(parseLine(lineOf(run))).toEqual({
        run: {
          id: run.id,
          green: run.green,
          total: run.total,
          pass: run.checks.pass,
          all: run.checks.all,
          verdict: run.verdict
        }
      });
    }
  });
});

describe("checkTagBody — the forms", () => {
  it("accepts a GREEN run line among the notes: a release, the form alone without the run here", () => {
    const r = checkTagBody(notes(GREEN_LINE));
    expect(r).toMatchObject({ ok: true, prerelease: false, line: GREEN_LINE });
    expect(r.note).toMatch(/form alone/);
  });

  it("accepts an ASCII hyphen for the dash", () => {
    const ascii = GREEN_LINE.replace(" — ", " - ");
    expect(checkTagBody(notes(ascii))).toMatchObject({ ok: true, prerelease: false, line: ascii });
  });

  it("accepts a CRLF body", () => {
    expect(checkTagBody(notes(GREEN_LINE).replace(/\n/g, "\r\n")).ok).toBe(true);
  });

  it("accepts the no-run line as a pre-release", () => {
    const r = checkTagBody(notes(NONE_LINE));
    expect(r).toMatchObject({ ok: true, prerelease: true, line: NONE_LINE });
    expect(r.note).toMatch(/pre-release/);
  });

  it("refuses a body with no Battery line, quoting both forms", () => {
    const r = checkTagBody(
      notes("The first full battery since the last release ran before this one.")
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no Battery line/);
    for (const form of FORMS) expect(r.error).toContain(form);
  });

  it("refuses an empty body", () => {
    expect(checkTagBody("").ok).toBe(false);
  });

  it("refuses a RED line and a PARTIAL line, quoting both forms", () => {
    for (const line of [
      `Battery: ${RED_ID} — 3/4 suites, 62/63 checks, RED`,
      `Battery: ${PARTIAL_ID} — 2/4 suites, 10/10 checks, PARTIAL`
    ]) {
      const r = checkTagBody(notes(line));
      expect(r.ok, line).toBe(false);
      expect(r.error).toMatch(/only a GREEN run releases/);
      for (const form of FORMS) expect(r.error).toContain(form);
    }
  });

  it("refuses a malformed line, quoting both forms", () => {
    for (const line of [
      "Battery: none",
      "Battery: none (prerelease)",
      "battery: none (pre-release)",
      "- Battery: none (pre-release)",
      "**Battery:** none (pre-release)",
      `Battery: ${GREEN_ID} 4/4 suites, 63/63 checks, GREEN`,
      `Battery: ${GREEN_ID} — 4/4 suites, 63/63 checks, green`,
      `Battery: ${GREEN_ID} — 4/4 suites, 63/63 checks`,
      "Battery: latest — 4/4 suites, 63/63 checks, GREEN",
      "Battery: ../../etc — 4/4 suites, 63/63 checks, GREEN",
      `Battery: ${GREEN_ID} — 3/4 suites, 63/63 checks, GREEN`,
      `Battery: ${GREEN_ID} — 4/4 suites, 62/63 checks, GREEN`,
      `Battery: ${GREEN_ID} — 0/0 suites, 0/0 checks, GREEN`,
      `Battery: ${GREEN_ID} — 4/4 suites, 0/0 checks, GREEN`,
      `Battery: ${GREEN_ID} — 5/4 suites, 63/63 checks, RED`,
      `Battery: ${GREEN_ID} — 4/4 suites, 62/63 checks, RED`,
      `Battery: ${GREEN_ID} â€” 4/4 suites, 63/63 checks, GREEN`
    ]) {
      const r = checkTagBody(notes(line));
      expect(r.ok, line).toBe(false);
      expect(r.error, line).toMatch(/is not a Battery line/);
      for (const form of FORMS) expect(r.error).toContain(form);
    }
  });

  it("refuses a body with two Battery lines, even two alike", () => {
    for (const pair of [
      [GREEN_LINE, NONE_LINE],
      [GREEN_LINE, GREEN_LINE]
    ]) {
      const r = checkTagBody(notes(pair[0], "", pair[1]));
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/2 Battery lines/);
      for (const form of FORMS) expect(r.error).toContain(form);
    }
  });
});

describe("checkTagBody — the line against its run", () => {
  it("a GREEN line its run on this machine agrees with", () => {
    const r = checkTagBody(notes(GREEN_LINE), { runOf });
    expect(r).toMatchObject({ ok: true, prerelease: false });
    expect(r.note).toMatch(/reads the same/);
  });

  it("a GREEN line over a RED run is refused, with the run's own line", () => {
    const claim = `Battery: ${RED_ID} — 4/4 suites, 63/63 checks, GREEN`;
    const r = checkTagBody(notes(claim), { runOf });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/disagrees with the run on this machine/);
    expect(r.error).toContain(`Battery: ${RED_ID} — 3/4 suites, 62/63 checks, RED`);
  });

  it("a GREEN line over an unfinished run is refused", () => {
    const claim = `Battery: ${PARTIAL_ID} — 4/4 suites, 10/10 checks, GREEN`;
    expect(checkTagBody(notes(claim), { runOf }).ok).toBe(false);
  });

  it("a GREEN line whose counts are not its run's is refused", () => {
    const claim = `Battery: ${GREEN_ID} — 4/4 suites, 64/64 checks, GREEN`;
    const r = checkTagBody(notes(claim), { runOf });
    expect(r.ok).toBe(false);
    expect(r.error).toContain(GREEN_LINE);
  });

  it("a run not on this machine checks the form alone, and says so", () => {
    const elsewhere = "Battery: 2026-10-01T00-00-00 — 45/45 suites, 1691/1691 checks, GREEN";
    const r = checkTagBody(notes(elsewhere), { runOf });
    expect(r).toMatchObject({ ok: true, prerelease: false });
    expect(r.note).toMatch(/not under dist\/battery\/ on this machine.*form alone/);
  });
});
