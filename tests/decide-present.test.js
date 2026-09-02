import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * DECISION-layer presentation (ARCHITECTURE.md §2). No Foundry stub on purpose — §2's layer
 * table names formatting as DECISION work, and none of this needs a document or the DOM.
 *
 * ⚠ The bar reads the wall clock, so the clock is faked here rather than the API. That is the
 * only impurity in the module and it is an input, not a dependency.
 */
/** @type {typeof import("../scripts/decide/present.js")} */
let p;
beforeAll(async () => {
  p = await import("../scripts/decide/present.js");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("popupKey — one decision, one key", () => {
  it("joins the message and the target", () => {
    expect(p.popupKey("msg1", "Actor.a")).toBe("msg1|Actor.a");
  });

  it("keeps two targets on one message apart, and one target across two messages", () => {
    expect(p.popupKey("m", "a")).not.toBe(p.popupKey("m", "b"));
    expect(p.popupKey("m1", "a")).not.toBe(p.popupKey("m2", "a"));
  });
});

describe("bfCard — the house card", () => {
  it("wears the tone's accent, and falls back to neutral for one it does not know", () => {
    expect(p.bfCard({ title: "T", tone: "good" })).toContain(p.TONE.good);
    expect(p.bfCard({ title: "T", tone: "nonsense" })).toContain(p.TONE.neutral);
    expect(p.bfCard({ title: "T" })).toContain(p.TONE.neutral);
  });

  it("renders no portrait at all when there is no image", () => {
    expect(p.bfCard({ title: "T" })).not.toContain("<img");
    expect(p.bfCard({ title: "T", img: "icons/a.webp" })).toContain('src="icons/a.webp"');
  });

  it("names the icon by the eyebrow, then the title — walk-5 (aa)", () => {
    expect(p.bfCard({ title: "T", eyebrow: "REACTION", img: "i.webp" })).toContain(
      'data-tooltip="REACTION"'
    );
    expect(p.bfCard({ title: "Shield", img: "i.webp" })).toContain('data-tooltip="Shield"');
  });

  it("strips tags and escapes quotes out of the TOOLTIP — that string lands in an attribute", () => {
    const html = p.bfCard({ title: '<b>Say "hi"</b>', img: "i.webp" });
    expect(html).toContain('data-tooltip="Say &quot;hi&quot;"');
    expect(html).toContain('alt="Say &quot;hi&quot;"');
  });

  it("but renders the TITLE as markup — the card body trusts its caller, the attribute does not", () => {
    // Deliberate asymmetry, and the reason the tooltip has its own scrub: titles and lines are
    // already-safe HTML fragments the machines compose, while an attribute cannot carry them.
    expect(p.bfCard({ title: "<b>Bold</b>", img: "i.webp" })).toContain("<b>Bold</b>");
  });

  it("drops empty body lines instead of rendering blank rows", () => {
    const html = p.bfCard({ title: "T", lines: ["one", "", null, "two"] });
    expect(html.match(/margin-top:0\.2rem;/g)).toHaveLength(2);
  });

  it("omits the eyebrow and subtitle blocks entirely when unset", () => {
    const bare = p.bfCard({ title: "T" });
    expect(bare).not.toContain("text-transform:uppercase");
    expect(p.bfCard({ title: "T", eyebrow: "E" })).toContain("text-transform:uppercase");
  });
});

describe("ruleLine — the verbatim quote's dress", () => {
  it("wraps the caller's words in curly quotes and italics, and adds nothing else", () => {
    expect(p.ruleLine("You can use your reaction")).toBe("<em>“You can use your reaction”</em>");
  });
});

describe("momentBarHTML — the countdown", () => {
  const at = ms => vi.setSystemTime(new Date(ms));

  it("draws nothing without both a deadline and a window — no hidden contract", () => {
    vi.useFakeTimers();
    at(1000);
    expect(p.momentBarHTML({ window: 20 })).toBe("");
    expect(p.momentBarHTML({ deadline: 21_000 })).toBe("");
    expect(p.momentBarHTML(undefined)).toBe("");
    expect(p.momentBarHTML({})).toBe("");
  });

  it("draws nothing once the deadline has passed, including exactly ON it", () => {
    vi.useFakeTimers();
    at(21_000);
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 })).toBe("");
    at(21_001);
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 })).toBe("");
  });

  it("writes the deadline and window onto the element, for the DOM half to snap to", () => {
    vi.useFakeTimers();
    at(1000);
    const html = p.momentBarHTML({ deadline: 21_000, window: 20 });
    expect(html).toContain('data-bf-deadline="21000"');
    expect(html).toContain('data-bf-window="20"');
  });

  it("names the action the buzzer will take, defaulting to answering", () => {
    vi.useFakeTimers();
    at(1000);
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 })).toContain("20s to answer");
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 }, "to roll")).toContain("20s to roll");
  });
});

describe("holdBarHTML — the status gate for WHOLE flags", () => {
  it("draws for a pending flag whose deadline is still ahead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    expect(p.holdBarHTML({ status: "pending", deadline: 21_000, window: 20 })).not.toBe("");
  });

  it("draws NOTHING for a resolved flag, even with time left on its clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    expect(p.holdBarHTML({ status: "done", deadline: 21_000, window: 20 })).toBe("");
    expect(p.holdBarHTML({ deadline: 21_000, window: 20 })).toBe("");
    expect(p.holdBarHTML(undefined)).toBe("");
  });
});

describe("the staircase — finding (s)", () => {
  it("starts at the top-left slot for an empty pile", () => {
    expect(p.nextCascadeSlot([])).toBe(0);
  });

  it("takes the SMALLEST FREE slot, not the depth count — a closed popup's slot is free", () => {
    // The depth-count hole: with slots 0 and 2 live, counting popups gives 2 and lands the
    // newcomer exactly on top of a survivor.
    expect(p.nextCascadeSlot([0, 2])).toBe(1);
    expect(p.nextCascadeSlot([1, 2])).toBe(0);
    expect(p.nextCascadeSlot([0, 1, 2])).toBe(3);
  });

  it("steps one header down-right per slot, from the pile's anchor", () => {
    const anchor = { left: 100, top: 50 };
    expect(p.cascadePosition(anchor, 0)).toEqual({ left: 100, top: 50 });
    expect(p.cascadePosition(anchor, 1)).toEqual({
      left: 100 + p.CASCADE_STEP,
      top: 50 + p.CASCADE_STEP
    });
  });

  it("wraps a pathological pile back to the anchor rather than marching it off-screen", () => {
    const anchor = { left: 100, top: 50 };
    expect(p.cascadePosition(anchor, 8)).toEqual({ left: 100, top: 50 });
    expect(p.cascadePosition(anchor, 9)).toEqual(p.cascadePosition(anchor, 1));
  });

  it("fronts the elders DEEPEST FIRST, so slot 0 ends on top — z-order is causal order", () => {
    const slots = new Map([
      ["first", 0],
      ["second", 1],
      ["third", 2]
    ]);
    expect(p.eldersDeepestFirst(slots, "third")).toEqual(["second", "first"]);
  });

  it("never fronts the newcomer itself — it belongs at the BACK of the pile", () => {
    const slots = new Map([
      ["a", 0],
      ["b", 1]
    ]);
    expect(p.eldersDeepestFirst(slots, "b")).toEqual(["a"]);
    expect(p.eldersDeepestFirst(slots, "a")).toEqual(["b"]);
  });
});

/**
 * THE RESCUE VIEW — the merged window's row model.
 *
 * ⚠ These are plain objects on purpose and that IS the design: the whole point of putting the
 * row model in the DECISION layer is that every branch the merged window can be in — both
 * sources pending, one already spent, a fumble that keeps precision out, the reveal gate, a
 * check with no DC to fail — is decidable without a document, a dialog or a live Foundry. The
 * live suite then only has to prove that the real flags reach it.
 */
describe("rescueView — two machines, one window", () => {
  const read = flags => key => flags[key] ?? null;

  /** The §6 band, as flags: an attack of 10 that missed AC 18, offering both rescues. */
  const bothPending = {
    d20fold: {
      status: "pending",
      testKind: "attack",
      baseTotal: 10,
      deadline: 5000,
      window: 15,
      offers: [
        { kind: "bardic", name: "Inspired", label: "Bardic Inspiration", dieFormula: "1d8" }
      ],
      targets: [{ uuid: "a", name: "Practice Dummy", ac: 18, margin: 8 }]
    },
    precision: {
      status: "pending",
      attackTotal: 10,
      deadline: 4000,
      window: 15,
      itemName: "Precision Attack",
      itemImg: "icons/skills/targeting/target.webp",
      dieFormula: "@scale.battle-master.superiority.die",
      targets: [{ uuid: "a", name: "Practice Dummy", ac: 18, margin: 8 }]
    }
  };

  it("both pending — one row per rescue, each carrying the machine's own answer token", () => {
    const view = p.rescueView(read(bothPending), { reveal: true });
    expect(view.rows.map(r => r.key)).toEqual(["d20fold:bardic", "precision:precision"]);
    expect(view.rows.map(r => r.action)).toEqual(["bardic", "use"]);
    expect(view.rows.every(r => r.spent === false)).toBe(true);
    // The label announces the FEATURE, never the lookup key the settings list finds it by.
    expect(view.rows[0].label).toBe("Bardic Inspiration");
    expect(view.rows[0].label).not.toBe("Inspired");
  });

  it("every row carries a glyph, and a document's art when the flag knows one", () => {
    const view = p.rescueView(read(bothPending), { reveal: true });
    expect(view.rows.every(r => typeof r.icon === "string" && r.icon.length)).toBe(true);
    // ⚠ heroic and bardic have no document ON THE FLAG — the art is an actor read, which is
    // EDGE work — so the row exposes the slot and the glyph carries the row until it is filled.
    expect(view.rows[0].img).toBe(null);
    expect(view.rows[1].img).toBe("icons/skills/targeting/target.webp");
  });

  it("the cost rides each row, because the three kinds do NOT agree about it", () => {
    const view = p.rescueView(read(bothPending), { reveal: true });
    expect(view.rows[0].cost).toMatch(/expended when rolled/);
    expect(view.rows[1].cost).toMatch(/spent either way/);
    expect(p.RESCUE_KINDS.tactical.cost).toMatch(/not expended/);
  });

  it("⚠ BOTH SOURCES DERIVE THE SAME HEADER — string-identical, and printed once", () => {
    const composed = { total: 10, added: 0, replaced: false };
    const fromFold = p.rescueHeaderLines(
      p.RESCUE_SOURCES[0].premise(bothPending.d20fold),
      composed,
      { reveal: true }
    );
    const fromPrecision = p.rescueHeaderLines(
      p.RESCUE_SOURCES[1].premise(bothPending.precision),
      composed,
      { reveal: true }
    );
    expect(fromFold).toEqual(fromPrecision);
    // …which is exactly what lets the view dedupe them without comparing numbers.
    expect(p.rescueView(read(bothPending), { composed, reveal: true }).headerLines).toEqual(
      fromFold
    );
  });

  it("the header states the COMPOSED sum and the margin left to close", () => {
    const view = p.rescueView(read(bothPending), {
      composed: { total: 13, added: 3 },
      reveal: true
    });
    expect(view.headerLines).toEqual(["10 + 3 = 13 vs AC 18 — misses Practice Dummy by 5"]);
  });

  it("a reroll reads with an arrow, because it REPLACED the d20 rather than adding to it", () => {
    const view = p.rescueView(read(bothPending), {
      composed: { total: 24, added: 0, replaced: true },
      reveal: true
    });
    expect(view.headerLines).toEqual(["10 → 24 vs AC 18 — hits Practice Dummy"]);
  });

  it("reveal OFF hides what the roll must beat, never what the roll now totals", () => {
    const view = p.rescueView(read(bothPending), {
      composed: { total: 13, added: 3 },
      reveal: false
    });
    expect(view.headerLines).toEqual(["10 + 3 = 13"]);
    expect(view.headerLines.join(" ")).not.toMatch(/AC|misses/);
    // The rows are untouched by the gate — the player may always see what is theirs to spend.
    expect(view.rows).toHaveLength(2);
  });

  it("one spent — the spend greys in place, carrying the number it rolled", () => {
    const view = p.rescueView(
      read({
        d20fold: {
          ...bothPending.d20fold,
          status: "resolved",
          offers: [],
          spends: [{ kind: "bardic", name: "Inspired", label: "Bardic Inspiration", die: 3 }]
        },
        precision: bothPending.precision
      }),
      { composed: { total: 13, added: 3 }, reveal: true }
    );
    expect(view.rows.map(r => [r.key, r.spent, r.result])).toEqual([
      ["d20fold:bardic", true, 3],
      ["precision:precision", false, null]
    ]);
    // The survivor is still pressable, which is the whole reason the spend stays on screen.
    expect(view.rows[1].action).toBe("use");
  });

  it("a heroic spend records the total that REPLACED the roll, and says so", () => {
    const view = p.rescueView(
      read({
        d20fold: {
          ...bothPending.d20fold,
          status: "resolved",
          offers: [],
          spends: [{ kind: "heroic", label: "Heroic Inspiration", reroll: { total: 24 } }]
        }
      }),
      { reveal: true }
    );
    expect(view.rows[0]).toMatchObject({ spent: true, result: 24, replaced: true });
  });

  it("an OFFER is never rendered as a spend — the two lists mean different things", () => {
    const view = p.rescueView(
      read({
        d20fold: { ...bothPending.d20fold, spends: [] }
      }),
      { reveal: true }
    );
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].spent).toBe(false);
    expect(view.rows[0].die).toBe("1d8");
  });

  it("⚠ the fumble case — precision never stamps on a natural 1, so only the fold has rows", () => {
    // maneuvers.js bails outright on `roll.isFumble` ("a natural 1 stands"), so the message
    // carries no precision flag at all. An absent source contributes nothing, silently.
    const view = p.rescueView(read({ d20fold: bothPending.d20fold }), { reveal: true });
    expect(view.rows.map(r => r.flag)).toEqual(["d20fold"]);
    expect(view.headerLines).toHaveLength(1);
  });

  it("a PASSED or expired precision leaves no row — there is nothing left to press", () => {
    for (const gone of [
      { status: "resolved", outcome: "passed" },
      { status: "resolved", outcome: "gone" },
      { status: "resolved", outcome: "passed (timer)", timedOut: true }
    ]) {
      const view = p.rescueView(read({ precision: { ...bothPending.precision, ...gone } }), {
        reveal: true
      });
      expect(view.rows).toEqual([]);
    }
  });

  it("a USED precision greys in place with the die it rolled", () => {
    const view = p.rescueView(
      read({
        precision: { ...bothPending.precision, status: "resolved", outcome: "used", die: 6 }
      }),
      { reveal: true }
    );
    expect(view.rows[0]).toMatchObject({ spent: true, result: 6, die: null });
  });

  it("⚠ the no-DC check — the arithmetic is stated and nothing is called a failure", () => {
    // The DC finding: dnd5e records no DC for a raw ability check, so there is no number to
    // test against and inventing one would be the module deciding a thing it cannot know.
    const view = p.rescueView(
      read({
        d20fold: {
          status: "pending",
          testKind: "check",
          baseTotal: 9,
          targets: [],
          offers: [{ kind: "tactical", label: "Tactical Mind", dieFormula: "1d10" }]
        }
      }),
      { composed: { total: 14, added: 5 }, reveal: true }
    );
    expect(view.headerLines).toEqual(["9 + 5 = 14 — ask your DM whether that lands."]);
    expect(view.headerLines.join(" ")).not.toMatch(/DC \d|fail|short/);
    expect(view.rows[0].action).toBe("tactical");
    // ⚠ And the window must not CALL it short either — nothing here knows that it is.
    expect(view.verdictKnown).toBe(false);
  });

  it("the check's hand-off to the DM is NOT gated by reveal — there is no number to hide", () => {
    const check = {
      d20fold: {
        status: "pending",
        testKind: "check",
        baseTotal: 9,
        targets: [],
        offers: [{ kind: "tactical", label: "Tactical Mind", dieFormula: "1d10" }]
      }
    };
    for (const reveal of [true, false]) {
      const view = p.rescueView(read(check), { composed: { total: 14, added: 5 }, reveal });
      expect(view.headerLines).toEqual(["9 + 5 = 14 — ask your DM whether that lands."]);
    }
  });

  it("an attack DOES know, so it keeps its verdict language", () => {
    expect(
      p.rescueView(read(bothPending), { composed: { total: 13, added: 3 }, reveal: true })
        .verdictKnown
    ).toBe(true);
  });

  it("a save DOES have a DC to name, because the ask owns it", () => {
    const view = p.rescueView(
      read({
        d20fold: {
          status: "pending",
          testKind: "save",
          baseTotal: 9,
          dc: 15,
          targets: [],
          offers: [{ kind: "bardic", label: "Bardic Inspiration", dieFormula: "1d8" }]
        }
      }),
      { composed: { total: 12, added: 3 }, reveal: true }
    );
    expect(view.headerLines).toEqual(["9 + 3 = 12 vs DC 15 — short by 3"]);
  });

  it("⚠ the EARLIEST clock wins — one bar may only promise the soonest loss", () => {
    expect(p.rescueView(read(bothPending), {}).earliestDeadline).toBe(4000);
    // A resolved source keeps its deadline field, and must not be allowed to set the bar.
    expect(
      p.rescueView(
        read({
          d20fold: bothPending.d20fold,
          precision: { ...bothPending.precision, status: "resolved", outcome: "used", die: 6 }
        }),
        {}
      ).earliestDeadline
    ).toBe(5000);
    expect(p.rescueView(read({}), {}).earliestDeadline).toBe(null);
  });

  it("one quote per row, the first is the default, and none of them is invented", () => {
    const view = p.rescueView(read(bothPending), { reveal: true });
    expect(view.quotes.map(q => q.key)).toEqual(["d20fold:bardic", "precision:precision"]);
    expect(view.quotes[0].text).toBe(p.RESCUE_KINDS.bardic.rule);
    expect(view.quotes[1].text).toBe(p.RESCUE_KINDS.precision.rule);
    expect(view.quotes.every(q => q.label && q.text)).toBe(true);
  });

  it('an offer from an older build degrades to the right WORDS, not to "undefined"', () => {
    // A deploy does not rewrite flags already in the chat log, and a v1.23.0 offer carries no
    // `label`. This printed "undefined — reroll the d20" on a real card once.
    expect(p.rescueLabel({ kind: "heroic" })).toBe("Heroic Inspiration");
    expect(p.rescueLabel({ name: "Some Homebrew Thing" })).toBe("Some Homebrew Thing");
    expect(p.rescueLabel(null)).toBe("a fold");
    expect(p.rescueLabel({ kind: "heroic", label: "House Rule Name" })).toBe("House Rule Name");
  });

  it("no rescue flags at all is an empty view, not a crash", () => {
    expect(p.rescueView(read({}), {})).toEqual({
      headerLines: [],
      rows: [],
      quotes: [],
      earliestDeadline: null,
      clockWindow: null,
      // ⚠ No sources means no PREMISE, so there is nothing left failing — which is the safe
      // answer either way: the still-short line is gated on a spend, and a view with no
      // sources has no spends to report.
      stillFailing: false,
      // ⚠ …and no PREMISE means no verdict to know either. Both flags answer "nothing to say"
      // on an absence, which is what keeps the window silent rather than guessing.
      verdictKnown: false
    });
  });
});

describe("situationalBonusHTML / modeButtons — one shape for a popup that stands in for a roll dialog", () => {
  it("the bonus row carries the name the caller reads back", async () => {
    const m = await import("../scripts/decide/present.js");
    const html = m.situationalBonusHTML("bf-x-bonus");
    expect(html).toContain('name="bf-x-bonus"');
    expect(html).toContain("Situational Bonus");
  });
  it("the three mode buttons press the caller's answer, and only the default is marked", async () => {
    const m = await import("../scripts/decide/present.js");
    const pressed = [];
    const buttons = m.modeButtons(mode => pressed.push(mode), "normal");
    expect(buttons.map(b => b.action)).toEqual(["advantage", "normal", "disadvantage"]);
    expect(buttons.map(b => b.default)).toEqual([false, true, false]);
    buttons[0].callback();
    buttons[2].callback();
    expect(pressed).toEqual(["advantage", "disadvantage"]);
  });
  it("no default flagged when none is asked for — and the gate passes its NET, because DialogV2 defaults the first button otherwise", async () => {
    const m = await import("../scripts/decide/present.js");
    expect(m.modeButtons(() => {}).every(b => b.default === false)).toBe(true);
    expect(m.modeButtons(() => {}, "disadvantage").map(b => b.default)).toEqual([
      false,
      false,
      true
    ]);
  });
});

describe("modeTagHTML and the palette — one meaning per hue (user ruling 2026-09-02)", () => {
  it("Advantage is green, Disadvantage red with white text, Normal grey, Listed the grey outline", () => {
    expect(p.modeTagHTML("advantage")).toContain(`background:${p.TONE.good}`);
    expect(p.modeTagHTML("disadvantage")).toContain(`background:${p.TONE.bad}`);
    expect(p.modeTagHTML("disadvantage")).toContain("color:#fff");
    expect(p.modeTagHTML("normal")).toContain(`background:${p.TONE.neutral}`);
    expect(p.modeTagHTML("listed")).toContain("background:transparent");
    expect(p.modeTagHTML("listed")).toContain(`border:1px solid ${p.TONE.neutral}`);
    for (const m of ["advantage", "disadvantage", "normal", "listed"]) {
      expect(p.modeTagHTML(m)).toContain(`data-bf-mode="${m}"`);
    }
    expect(p.modeTagHTML("listed")).toContain(">Listed</span>");
  });
  it("the tones are five and distinct — pending is orange, crit is yellow, and they no longer match", () => {
    expect(Object.keys(p.TONE).sort()).toEqual(["bad", "crit", "good", "neutral", "pending"]);
    expect(new Set(Object.values(p.TONE)).size).toBe(5);
    expect(p.TONE.pending).not.toBe(p.TONE.crit);
    expect(p.modeTone("advantage")).toBe(p.TONE.good);
    expect(p.modeTone("disadvantage")).toBe(p.TONE.bad);
    expect(p.modeTone("normal")).toBe(p.TONE.neutral);
    expect(p.modeTone(null)).toBe(p.TONE.neutral);
  });
});

describe("reminderSectionHTML / reminderFieldsetHTML — the header line and the boxes", () => {
  const view = {
    head: { title: "3 Modifiers — Net", net: "normal", why: "they cancel" },
    boxes: [
      { label: "Gruk — Sapped", bend: "disadvantage", rule: "sap rule" },
      { label: "Gruk Vexed Thomas", bend: "advantage", rule: "vex rule" },
      { label: "Prone — distance unknown", bend: null, rule: "" }
    ]
  };
  it("is ONE fieldset the dialog can find, with the same legend shape as the dialog's own", () => {
    const html = p.reminderFieldsetHTML(view);
    expect(html.trim().startsWith("<fieldset data-bf-reminder>")).toBe(true);
    expect(html).toContain("<legend>Before you roll</legend>");
    expect(html.match(/<fieldset/g)).toHaveLength(1);
  });
  it("opens with the header line — the count and the net as a tag, the arithmetic as its tooltip — and NO net block", () => {
    const html = p.reminderSectionHTML(view);
    expect(html).toContain("<span>3 Modifiers — Net</span>");
    expect(html).toContain("data-bf-reminder-head");
    expect(html).toContain('data-tooltip="they cancel"');
    expect(html).toContain(p.modeTagHTML("normal"));
    expect(html).not.toContain("Net:");
    expect(html.indexOf("3 Modifiers")).toBeLessThan(html.indexOf("Gruk — Sapped"));
  });
  it("draws a box per source, wearing the bend's tone and its tag, and the rule as the verbatim quote", () => {
    const html = p.reminderSectionHTML(view);
    expect(html).toContain(`border-left:3px solid ${p.TONE.bad}`);
    expect(html).toContain(`border-left:3px solid ${p.TONE.good}`);
    expect(html).toContain(`border-left:3px solid ${p.TONE.neutral}`);
    expect(html).toContain(p.modeTagHTML("disadvantage"));
    expect(html).toContain(p.modeTagHTML("advantage"));
    expect(html).toContain(p.modeTagHTML("listed"));
    expect(html).toContain(p.ruleLine("sap rule"));
    expect(html).not.toContain(p.ruleLine(""));
  });
  it("escapes the header and the legend — they land in markup from the table's own words", () => {
    const html = p.reminderFieldsetHTML({
      head: { title: "1 <Modifier> — Net", net: "normal", why: 'a "why"' },
      boxes: [{ label: "x", bend: null, rule: "" }],
      legend: "A & B"
    });
    expect(html).toContain("1 &lt;Modifier&gt; — Net");
    expect(html).toContain("A &amp; B");
    expect(html).toContain('data-tooltip="a &quot;why&quot;"');
  });
});
