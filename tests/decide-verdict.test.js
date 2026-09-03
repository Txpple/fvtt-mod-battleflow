import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer verdicts (ARCHITECTURE.md §2). No Foundry stub on purpose.
 *
 * ⚠ This is the module's most consequential arithmetic: `hitsAmong` decides whether an attack
 * landed, and `saveMultiplier` decides how much damage a save lets through. Both moved here
 * verbatim from code that had no unit coverage at all and could only be exercised by the slow
 * live suites.
 */
/** @type {typeof import("../scripts/decide/verdict.js")} */
let v;
beforeAll(async () => {
  v = await import("../scripts/decide/verdict.js");
});

const roll = (total, { isCritical = false, isFumble = false } = {}) => ({
  total,
  isCritical,
  isFumble
});
const uuids = list => list.map(t => t.uuid);

describe("hitsAmong — the hit test", () => {
  const targets = [
    { uuid: "a", ac: 15 },
    { uuid: "b", ac: 20 }
  ];

  it("hits what the total reaches and misses what it does not", () => {
    expect(uuids(v.hitsAmong({ targets, roll: roll(17) }))).toEqual(["a"]);
  });

  it("counts an exact tie as a hit — total >= ac", () => {
    expect(uuids(v.hitsAmong({ targets, roll: roll(15) }))).toEqual(["a"]);
  });

  it("a critical hits EVERYTHING, whatever the AC", () => {
    expect(uuids(v.hitsAmong({ targets, roll: roll(3, { isCritical: true }) }))).toEqual([
      "a",
      "b"
    ]);
  });

  it("a fumble hits nothing, even against a low AC", () => {
    expect(v.hitsAmong({ targets, roll: roll(99, { isFumble: true }) })).toEqual([]);
  });

  it("LEAVES a null-AC target to the humans rather than counting it a hit", () => {
    // The system's own tray classes these as hits because `total < null` is false. We do not:
    // the outcome is not determined by data we trust (DESIGN.md R1).
    const cover = [{ uuid: "c", ac: null }, { uuid: "d" }];
    expect(v.hitsAmong({ targets: cover, roll: roll(99) })).toEqual([]);
    expect(v.hitsAmong({ targets: cover, roll: roll(99, { isCritical: true }) })).toEqual([]);
  });

  it("survives an empty or missing target list", () => {
    expect(v.hitsAmong({ targets: [], roll: roll(10) })).toEqual([]);
    expect(v.hitsAmong({ targets: undefined, roll: roll(10) })).toEqual([]);
  });

  /* --- the folds, re-asserted against the composed shape (D8) ------------------------------
   *
   * ⚠ Every behaviour below shipped before the fold registry existed and must still hold. The
   * one that DELIBERATELY changed is the last pair: "the hold always wins" is the precedence
   * the 2026-08-23 ruling replaced with composition.
   */

  it("a hold's live AC turns a HIT into a miss — the stale-AC trap, now as arithmetic", () => {
    // After a Shield the snapshot AC is stale; auto-apply must not damage a target the module
    // already announced as missed. The hold contributes the AC it judged against, so the test
    // is re-run rather than overridden.
    const folds = [{ uuid: "a", ac: 20 }];
    expect(v.hitsAmong({ targets, folds, roll: roll(17) })).toEqual([]);
  });

  it("a hold from BEFORE acAtVerdict existed still overrides, by its baked verdict", () => {
    const folds = [{ uuid: "a", verdict: "miss" }];
    expect(v.hitsAmong({ targets, folds, roll: roll(17) })).toEqual([]);
  });

  it("an added die turns a MISS into a hit — precision, as a delta rather than a verdict", () => {
    const folds = [{ uuid: "b", add: 4 }];
    expect(uuids(v.hitsAmong({ targets, folds, roll: roll(17) }))).toEqual(["a", "b"]);
  });

  it("a die that is not enough leaves the miss standing", () => {
    expect(uuids(v.hitsAmong({ targets, folds: [{ uuid: "b", add: 2 }], roll: roll(17) }))).toEqual(
      ["a"]
    );
  });

  it("a FORCED verdict beats a fumble and a null AC alike — it is a ruling, not a modifier", () => {
    // The negate hold's shape: there is no AC story to tell, so the answer IS the verdict.
    const folds = [{ uuid: "e", verdict: "hit" }];
    expect(
      uuids(
        v.hitsAmong({
          targets: [{ uuid: "e", ac: null }],
          folds,
          roll: roll(1, { isFumble: true })
        })
      )
    ).toEqual(["e"]);
  });

  it("a negated target is not a hit, whatever the numbers say — and its neighbour is untouched", () => {
    const folds = [{ uuid: "a", verdict: "negated" }];
    expect(uuids(v.hitsAmong({ targets, folds, roll: roll(99) }))).toEqual(["b"]);
  });

  it("an ADDED die does NOT rescue a fumble — a natural 1 stands", () => {
    // ⚠ Unreachable from precision, whose stamp refuses a natural 1 outright — asserted so a
    // future fold that CAN fire on a fumble inherits the right answer instead of the old
    // verdict channel's accidental one.
    expect(
      v.hitsAmong({ targets, folds: [{ uuid: "a", add: 40 }], roll: roll(1, { isFumble: true }) })
    ).toEqual([]);
  });

  it("a REPLACE carries its own crit — a rerolled natural 20 crits", () => {
    const folds = [{ uuid: "b", replace: { total: 3, isCritical: true, isFumble: false } }];
    expect(uuids(v.hitsAmong({ targets, folds, roll: roll(19) }))).toEqual(["a", "b"]);
  });

  it("a REPLACE can take a hit AWAY — 'you must use the new roll'", () => {
    const folds = [{ uuid: "a", replace: { total: 4, isCritical: false, isFumble: false } }];
    expect(v.hitsAmong({ targets, folds, roll: roll(19) })).toEqual([]);
  });

  /* --- the ruling: compose, do not order ------------------------------------------------- */

  it("the defender's AC and the attacker's die COMPOSE — the die is tested against the SHIELDED number", () => {
    // 17 hit AC 15; Shield made it 20; a +4 die reaches 21. Under the old precedence the hold's
    // baked "miss" won and the die was wasted. Under the ruling the arithmetic decides.
    const folds = [
      { uuid: "a", ac: 20 },
      { uuid: "a", add: 4 }
    ];
    expect(uuids(v.hitsAmong({ targets, folds, roll: roll(17) }))).toEqual(["a"]);
  });

  it("…and a die that cannot reach the shielded number still misses", () => {
    const folds = [
      { uuid: "a", ac: 20 },
      { uuid: "a", add: 2 }
    ];
    expect(v.hitsAmong({ targets, folds, roll: roll(17) })).toEqual([]);
  });

  it("order does not matter — that is the whole point of composing", () => {
    const forward = [
      { uuid: "a", ac: 20 },
      { uuid: "a", add: 4 }
    ];
    const backward = [
      { uuid: "a", add: 4 },
      { uuid: "a", ac: 20 }
    ];
    expect(uuids(v.hitsAmong({ targets, folds: forward, roll: roll(17) }))).toEqual(
      uuids(v.hitsAmong({ targets, folds: backward, roll: roll(17) }))
    );
  });

  it("a fold naming another target leaves this one alone", () => {
    const folds = [{ uuid: "b", ac: 5 }];
    expect(uuids(v.hitsAmong({ targets, folds, roll: roll(17) }))).toEqual(["a", "b"]);
  });
});

describe("foldedRoll — the composed number", () => {
  it("adds every delta and keeps the base roll's crit and fumble", () => {
    expect(v.foldedRoll(roll(10, { isCritical: true }), [{ add: 3 }, { add: 4 }])).toMatchObject({
      total: 17,
      isCritical: true,
      isFumble: false,
      added: 7,
      replaced: false
    });
  });

  it("a replace supersedes the base roll, crit and fumble included", () => {
    expect(v.foldedRoll(roll(19), [{ replace: { total: 2, isFumble: true } }])).toMatchObject({
      total: 2,
      isFumble: true,
      replaced: true
    });
  });

  it("the LAST replace wins, and adds still apply on top of it", () => {
    const out = v.foldedRoll(roll(19), [
      { replace: { total: 5 } },
      { replace: { total: 8 } },
      { add: 2 }
    ]);
    expect(out).toMatchObject({ total: 10, replaced: true });
  });

  it("ignores a non-numeric add rather than turning the total into NaN", () => {
    expect(v.foldedRoll(roll(10), [{ add: undefined }, { add: "3" }]).total).toBe(10);
  });

  it("survives no folds and no roll at all", () => {
    expect(v.foldedRoll(roll(12)).total).toBe(12);
    expect(v.foldedRoll(undefined, []).total).toBe(0);
  });
});

describe("foldedVerdict — one target, every fold that names it", () => {
  const t = { uuid: "a", ac: 15 };

  it("reports unresolved for a null AC rather than guessing", () => {
    expect(v.foldedVerdict({ uuid: "a", ac: null }, roll(99), [])).toBe("unresolved");
    expect(v.foldedVerdict({ uuid: "a" }, roll(99), [])).toBe("unresolved");
  });

  it("a forced verdict short-circuits the arithmetic entirely", () => {
    expect(v.foldedVerdict(t, roll(99), [{ uuid: "a", verdict: "miss" }])).toBe("miss");
    expect(v.foldedVerdict(t, roll(1, { isFumble: true }), [{ uuid: "a", verdict: "hit" }])).toBe(
      "hit"
    );
  });

  it("the LAST ac fold is the one tested against", () => {
    expect(
      v.foldedVerdict(t, roll(17), [
        { uuid: "a", ac: 20 },
        { uuid: "a", ac: 12 }
      ])
    ).toBe("hit");
  });
});

describe("foldsFrom + ATTACK_FOLDS — the registry that replaced the named parameters", () => {
  const read = flags => key => flags[key] ?? null;

  it("a resolved AC hold contributes the AC it judged against", () => {
    const folds = v.foldsFrom(
      read({
        hold: { targets: [{ uuid: "a", kind: "ac", verdict: "miss", acAtVerdict: 20 }] }
      })
    );
    expect(folds).toEqual([{ uuid: "a", ac: 20, from: "hold" }]);
  });

  it("an UNANSWERED hold target contributes nothing — no opinion yet", () => {
    expect(v.foldsFrom(read({ hold: { targets: [{ uuid: "a", verdict: null }] } }))).toEqual([]);
  });

  it("a negate hold contributes its verdict, because it has no AC story", () => {
    const folds = v.foldsFrom(
      read({
        hold: { targets: [{ uuid: "a", kind: "negate", verdict: "negated" }] }
      })
    );
    expect(folds).toEqual([{ uuid: "a", verdict: "negated", from: "hold" }]);
  });

  it("a hold with no acAtVerdict falls back to its baked verdict", () => {
    const folds = v.foldsFrom(read({ hold: { targets: [{ uuid: "a", verdict: "miss" }] } }));
    expect(folds).toEqual([{ uuid: "a", verdict: "miss", from: "hold" }]);
  });

  it("a USED add-kind d20 fold contributes its die to every target it names", () => {
    const folds = v.foldsFrom(
      read({
        d20fold: {
          spends: [{ kind: "tactical", die: 7 }],
          targets: [{ uuid: "a" }, { uuid: "b" }]
        }
      })
    );
    expect(folds).toEqual([
      { uuid: "a", add: 7, from: "d20fold" },
      { uuid: "b", add: 7, from: "d20fold" }
    ]);
  });

  // ⚠ The module's first shipped `replace`. A reroll cannot be modelled as an `add` because it
  // carries its OWN crit and fumble — which is the whole reason the shape exists.
  it("a USED heroic fold contributes a replace, crit and fumble included", () => {
    const folds = v.foldsFrom(
      read({
        d20fold: {
          spends: [{ kind: "heroic", reroll: { total: 20, isCritical: true, isFumble: false } }],
          targets: [{ uuid: "a" }]
        }
      })
    );
    expect(folds).toEqual([
      { uuid: "a", replace: { total: 20, isCritical: true, isFumble: false }, from: "d20fold" }
    ]);
    // A rerolled natural 20 crits — it hits an AC nothing else could have reached.
    expect(v.foldedVerdict({ uuid: "a", ac: 99 }, { total: 3 }, folds)).toBe("hit");
  });

  it("a rerolled natural 1 fumbles, and misses an AC the total would have cleared", () => {
    const folds = v.foldsFrom(
      read({
        d20fold: {
          spends: [{ kind: "heroic", reroll: { total: 1, isCritical: false, isFumble: true } }],
          targets: [{ uuid: "a" }]
        }
      })
    );
    expect(v.foldedVerdict({ uuid: "a", ac: 1 }, { total: 30 }, folds)).toBe("miss");
  });

  it("a heroic fold with no reroll recorded contributes nothing", () => {
    expect(
      v.foldsFrom(
        read({
          d20fold: { spends: [{ kind: "heroic" }], targets: [{ uuid: "a" }] }
        })
      )
    ).toEqual([]);
  });

  // ⚠ An OFFER is what a player could burn; a SPEND is what they did. v1 keyed the contribution
  // off `outcome === "used"`, which meant the gate lived in a status string; the list of spends
  // IS the gate now, and an offer nobody accepted is simply an empty list.
  it("a live OFFER contributes nothing — only spends do", () => {
    expect(
      v.foldsFrom(
        read({
          d20fold: {
            status: "pending",
            offers: [{ kind: "tactical", name: "Tactical Mind", dieFormula: "1d10" }],
            spends: [],
            targets: [{ uuid: "a" }]
          }
        })
      )
    ).toEqual([]);
  });

  it("a passed or expired fold contributes nothing", () => {
    for (const outcome of ["passed", "passed (timer)", "gone"]) {
      expect(
        v.foldsFrom(
          read({ d20fold: { status: "resolved", outcome, spends: [], targets: [{ uuid: "a" }] } })
        )
      ).toEqual([]);
    }
  });

  // ⚠ THE MULTI-SELECT CASE, and the reason the flag carries a LIST. v1 modelled one fold per
  // roll; the table found within minutes that heroic — first in the shipped list — masked the
  // other two entirely. The rules allow the stack: reroll, still fail, then add a die.
  it("STACKS a reroll and a die on one roll — replace first, then add on top", () => {
    const folds = v.foldsFrom(
      read({
        d20fold: {
          spends: [
            { kind: "heroic", reroll: { total: 11, isCritical: false, isFumble: false } },
            { kind: "bardic", die: 6 }
          ],
          targets: [{ uuid: "a" }]
        }
      })
    );
    expect(folds).toEqual([
      { uuid: "a", replace: { total: 11, isCritical: false, isFumble: false }, from: "d20fold" },
      { uuid: "a", add: 6, from: "d20fold" }
    ]);
    // The original 3 is replaced by 11, then +6 = 17 — enough for AC 15, not for AC 20.
    expect(v.foldedVerdict({ uuid: "a", ac: 15 }, { total: 3 }, folds)).toBe("hit");
    expect(v.foldedVerdict({ uuid: "a", ac: 20 }, { total: 3 }, folds)).toBe("miss");
  });

  // The 2026-08-23 composition ruling, now with a third fold in the room: the defender's Shield
  // moves the AC, the attacker's die moves the total, and ONE verdict is computed at the end.
  it("composes with a hold — the die is tested against the SHIELDED AC, not the snapshot", () => {
    const folds = v.foldsFrom(
      read({
        hold: { targets: [{ uuid: "a", kind: "ac", verdict: "miss", acAtVerdict: 20 }] },
        d20fold: { spends: [{ kind: "bardic", die: 8 }], targets: [{ uuid: "a" }] }
      })
    );
    // 14 + 8 = 22 vs the shielded AC 20 — hits. Against the snapshot AC 15 it would also hit,
    // so the assertion that matters is the one that FAILS against the shielded number:
    expect(v.foldedVerdict({ uuid: "a", ac: 15 }, { total: 14 }, folds)).toBe("hit");
    expect(v.foldedVerdict({ uuid: "a", ac: 15 }, { total: 10 }, folds)).toBe("miss"); // 18 < 20
  });

  it("a USED precision contributes its die to every target it names", () => {
    const folds = v.foldsFrom(
      read({
        precision: { outcome: "used", die: 6, targets: [{ uuid: "a" }, { uuid: "b" }] }
      })
    );
    expect(folds).toEqual([
      { uuid: "a", add: 6, from: "precision" },
      { uuid: "b", add: 6, from: "precision" }
    ]);
  });

  it("a PASSED or pending precision contributes nothing", () => {
    expect(
      v.foldsFrom(read({ precision: { outcome: "passed", die: 6, targets: [{ uuid: "a" }] } }))
    ).toEqual([]);
    expect(
      v.foldsFrom(read({ precision: { status: "pending", targets: [{ uuid: "a" }] } }))
    ).toEqual([]);
  });

  it("collects both channels at once, which is the case the old signature could not compose", () => {
    const folds = v.foldsFrom(
      read({
        hold: { targets: [{ uuid: "a", kind: "ac", verdict: "miss", acAtVerdict: 20 }] },
        precision: { outcome: "used", die: 4, targets: [{ uuid: "a" }] }
      })
    );
    expect(folds).toEqual([
      { uuid: "a", ac: 20, from: "hold" },
      { uuid: "a", add: 4, from: "precision" }
    ]);
  });

  it("an absent flag is not an empty flag — neither produces a contribution", () => {
    expect(v.foldsFrom(read({}))).toEqual([]);
  });
});

/**
 * TWO MACHINES ON ONE ROLL — the arithmetic behind `smoke-d20-folds` §6.
 *
 * ⚠ WHY THESE ARE HERE. A Battle Master holding a Bardic die is stamped by BOTH fold machines
 * on ONE missed attack: `d20fold` (d20-folds.js) and `precision` (maneuvers.js). The registry
 * has composed them since D8 and the unit cases above prove each spec ALONE — but nothing
 * pinned the composition itself, and the resolver that shipped without it went unnoticed until
 * v1.23.2, announcing `attackTotal + its own die` while `hitTargets` walked the whole registry.
 * These are the shapes both resolvers must agree on.
 */
describe("two machines, one roll — the composition each resolver has to obey", () => {
  const read = flags => key => flags[key] ?? null;

  it("a bardic die and a superiority die ADD TOGETHER on the target they share", () => {
    const folds = v.foldsFrom(
      read({
        d20fold: { targets: [{ uuid: "a" }], spends: [{ kind: "bardic", die: 3 }] },
        precision: { outcome: "used", die: 6, targets: [{ uuid: "a" }] }
      })
    );
    // The live band: 10 + 3 + 6 = 19 clears an AC of 18 that 10 + 6 = 16 does not.
    expect(v.foldedRoll(roll(10), folds)).toMatchObject({ total: 19, added: 9 });
    expect(v.foldedVerdict({ uuid: "a", ac: 18 }, roll(10), folds)).toBe("hit");
    // …and the number either die reaches ALONE is still a miss, which is what makes the
    // composition the whole feature rather than an accounting detail.
    expect(v.foldedVerdict({ uuid: "a", ac: 18 }, roll(10), folds.slice(0, 1))).toBe("miss");
    expect(v.foldedVerdict({ uuid: "a", ac: 18 }, roll(10), folds.slice(1))).toBe("miss");
  });

  it("a heroic REPLACE composes with later adds — the reroll leads, the dice follow", () => {
    const folds = v.foldsFrom(
      read({
        d20fold: {
          targets: [{ uuid: "a" }],
          spends: [
            { kind: "heroic", reroll: { total: 14 } },
            { kind: "bardic", die: 3 }
          ]
        },
        precision: { outcome: "used", die: 6, targets: [{ uuid: "a" }] }
      })
    );
    // The d20 is thrown away, not added to: 14 + 3 + 6, never 10 + 14 + 3 + 6.
    expect(v.foldedRoll(roll(10), folds)).toMatchObject({ total: 23, added: 9, replaced: true });
  });

  /**
   * ⚠ THE MULTI-TARGET TRAP, and it decides how a resolver may print its own sentence. An
   * attack is ONE roll judged against MANY targets, so the registry holds a contribution per
   * (target × spend) — two targets and one die is TWO `add`s of that die. `foldedVerdict`
   * filters by uuid and is right; `foldedRoll` sums whatever it is handed and is also right,
   * because summing is all it promised. A caller that hands it the UNFILTERED list to print a
   * per-target line announces a number nobody rolled — the "card disagrees with its own
   * arithmetic" class, one level up from the resolvers.
   */
  it("contributions are PER TARGET — an unfiltered sum counts every die once per target", () => {
    const folds = v.foldsFrom(
      read({
        d20fold: { targets: [{ uuid: "a" }, { uuid: "b" }], spends: [{ kind: "bardic", die: 3 }] },
        precision: { outcome: "used", die: 6, targets: [{ uuid: "a" }, { uuid: "b" }] }
      })
    );
    expect(folds).toHaveLength(4);
    // What each target actually gets — the filtered composition, which is what a card must say.
    for (const uuid of ["a", "b"]) {
      const mine = folds.filter(f => f.uuid === uuid);
      expect(v.foldedRoll(roll(10), mine)).toMatchObject({ total: 19, added: 9 });
      expect(v.foldedVerdict({ uuid, ac: 18 }, roll(10), folds)).toBe("hit");
    }
    // And what the unfiltered list sums to, pinned so the difference is impossible to miss.
    expect(v.foldedRoll(roll(10), folds)).toMatchObject({ total: 28, added: 18 });
  });

  it("a defender's fold moves the AC the composed total is tested against", () => {
    const folds = v.foldsFrom(
      read({
        hold: { targets: [{ uuid: "a", kind: "ac", verdict: "miss", acAtVerdict: 23 }] },
        d20fold: { targets: [{ uuid: "a" }], spends: [{ kind: "bardic", die: 3 }] },
        precision: { outcome: "used", die: 6, targets: [{ uuid: "a" }] }
      })
    );
    // 19 clears the snapshot AC 18 and still misses the Shielded 23 — precedence never enters
    // it, because there are no verdicts left to order.
    expect(v.foldedVerdict({ uuid: "a", ac: 18 }, roll(10), folds)).toBe("miss");
  });
});

describe("foldedSave — the save side of the fold (D8's real new work)", () => {
  it("with no folds it is exactly saveOutcome, which is what lets it ship empty", () => {
    expect(v.foldedSave({ total: 15, dc: 15 })).toMatchObject({ total: 15, outcome: "saved" });
    expect(v.foldedSave({ total: 14, dc: 15 })).toMatchObject({ total: 14, outcome: "failed" });
  });

  // ⚠ This test used to assert SAVE_FOLDS was EMPTY, which was the right assertion for as long
  // as the seam was unused — D8 shipped it declared-but-empty so `foldSaveVerdict` already ran
  // through the fold path while the arithmetic was provably unchanged. v1.23.0 is the seam
  // paying off: the d20 folds land as ONE SPEC and the resolver in saves.js was not touched to
  // admit them. What is worth pinning now is that property, not the emptiness.
  it("the save seam carries the d20 folds and nothing else", () => {
    expect(v.SAVE_FOLDS.map(s => s.flag)).toEqual(["d20fold"]);
  });

  /**
   * ⚠ THE REGRESSION THE TABLE FOUND: "Tactical Mind doesn't add +1d10".
   *
   * The two spec sets are NOT interchangeable, and reaching for the default is a silent bug.
   * ATTACK_FOLDS walks `flag.targets` — an attack is one roll judged against many targets — so
   * handed a CHECK or a SAVE flag, which have no `targets` at all, it yields NOTHING. The die
   * was really spent and really rolled in public, and then contributed zero.
   *
   * It hid well because saves.js composes the save verdict itself through SAVE_FOLDS: the save
   * card's number was right while the fold card's number was wrong. Pinned in both directions
   * so neither resolver can quietly pick the other's list again.
   */
  it("ATTACK_FOLDS yields NOTHING for a targetless flag — the wrong list is silent, not loud", () => {
    const spends = [{ kind: "tactical", die: 7 }];
    expect(v.foldsFrom(key => (key === "d20fold" ? { spends } : null), v.ATTACK_FOLDS)).toEqual([]);
    // …while the right list contributes the die it was handed.
    expect(v.foldsFrom(key => (key === "d20fold" ? { spends } : null), v.SAVE_FOLDS)).toEqual([
      { add: 7, from: "d20fold" }
    ]);
  });

  it("a check's 1d10 reaches the composed total — 23 + 7 = 30, never 23", () => {
    const folds = v.foldsFrom(
      key => (key === "d20fold" ? { spends: [{ kind: "tactical", die: 7 }] } : null),
      v.SAVE_FOLDS
    );
    expect(v.foldedRoll({ total: 23 }, folds)).toMatchObject({
      total: 30,
      added: 7,
      replaced: false
    });
  });

  it("a flag nothing recognises still contributes nothing", () => {
    expect(v.foldsFrom(() => ({ anything: true }), v.SAVE_FOLDS)).toEqual([]);
  });

  it("a save fold names nobody — one roller, one roll, no per-target dimension", () => {
    const folds = v.foldsFrom(
      key => (key === "d20fold" ? { spends: [{ kind: "bardic", die: 6 }] } : null),
      v.SAVE_FOLDS
    );
    expect(folds).toEqual([{ add: 6, from: "d20fold" }]);
    expect(folds[0]).not.toHaveProperty("uuid");
  });

  it("a live offer on a WITHHELD save contributes nothing until it is spent", () => {
    // ⚠ The demanded-save path stamps this flag and saves.js withholds its verdict while the
    // offer is live. Until a spend lands, the arithmetic must be exactly today's arithmetic —
    // otherwise the withheld save would resolve differently from the one nobody was offered.
    const offered = {
      status: "pending",
      dc: 15,
      offers: [{ kind: "bardic", name: "Inspired", dieFormula: "d8" }],
      spends: []
    };
    const folds = v.foldsFrom(key => (key === "d20fold" ? offered : null), v.SAVE_FOLDS);
    expect(folds).toEqual([]);
    expect(v.foldedSave({ total: 11, dc: 15, folds }).outcome).toBe("failed");
  });

  it("a passed offer on a withheld save leaves the failure standing", () => {
    for (const outcome of ["passed", "passed (timer)", "gone"]) {
      expect(
        v.foldsFrom(
          key => (key === "d20fold" ? { status: "resolved", outcome, spends: [] } : null),
          v.SAVE_FOLDS
        )
      ).toEqual([]);
    }
  });

  it("STACKS on a save too — Fireball rerolled, still short, then a bardic die saves it", () => {
    const folds = v.foldsFrom(
      key =>
        key === "d20fold"
          ? {
              dc: 15,
              spends: [
                { kind: "heroic", reroll: { total: 10, isCritical: false, isFumble: false } },
                { kind: "bardic", die: 6 }
              ]
            }
          : null,
      v.SAVE_FOLDS
    );
    // Rolled 4, rerolled to 10 — still under DC 15 — then +6 = 16, saved.
    expect(v.foldedSave({ total: 4, dc: 15, folds })).toMatchObject({
      total: 16,
      outcome: "saved"
    });
  });

  it("a heroic reroll folds into a save as a replace, carrying its own crit and fumble", () => {
    const folds = v.foldsFrom(
      key =>
        key === "d20fold"
          ? {
              spends: [
                { kind: "heroic", reroll: { total: 19, isCritical: false, isFumble: false } }
              ]
            }
          : null,
      v.SAVE_FOLDS
    );
    expect(folds).toEqual([
      { replace: { total: 19, isCritical: false, isFumble: false }, from: "d20fold" }
    ]);
    expect(v.foldedSave({ total: 3, dc: 15, folds }).outcome).toBe("saved");
  });

  it("an added die can turn a failed save into a saved one", () => {
    expect(v.foldedSave({ total: 11, dc: 15, folds: [{ add: 5 }] })).toMatchObject({
      total: 16,
      outcome: "saved",
      added: 5
    });
  });

  it("a reroll replaces the total and can go either way", () => {
    expect(v.foldedSave({ total: 18, dc: 15, folds: [{ replace: { total: 4 } }] })).toMatchObject({
      total: 4,
      outcome: "failed",
      replaced: true
    });
  });

  it("legendary resistance still wins regardless — it is a ruling, not arithmetic", () => {
    expect(v.foldedSave({ total: 1, dc: 30, forced: true }).outcome).toBe("saved");
    expect(
      v.foldedSave({ total: 1, dc: 30, forced: true, folds: [{ replace: { total: 0 } }] }).outcome
    ).toBe("saved");
  });

  it("returns the number it judged, so the card cannot disagree with its own arithmetic", () => {
    expect(v.foldedSave({ total: 9, dc: 15, folds: [{ add: 6 }] }).total).toBe(15);
  });
});

describe("modeAdmits — the npc/pc/all gate", () => {
  it("off admits nobody", () => {
    expect(v.modeAdmits("off", true)).toBe(false);
    expect(v.modeAdmits("off", false)).toBe(false);
  });

  it("all admits both sides", () => {
    expect(v.modeAdmits("all", true)).toBe(true);
    expect(v.modeAdmits("all", false)).toBe(true);
  });

  it("npc admits only NPCs, pc only PCs", () => {
    expect(v.modeAdmits("npc", false)).toBe(true);
    expect(v.modeAdmits("npc", true)).toBe(false);
    expect(v.modeAdmits("pc", true)).toBe(true);
    expect(v.modeAdmits("pc", false)).toBe(false);
  });
});

describe("saveOutcome", () => {
  it("saves on a tie — total >= dc", () => {
    expect(v.saveOutcome(15, 15)).toBe("saved");
    expect(v.saveOutcome(14, 15)).toBe("failed");
  });

  it("legendary resistance saves whatever the number", () => {
    expect(v.saveOutcome(1, 30, true)).toBe("saved");
  });
});

describe("interruptMultiplier — a held attack's damage against one reactor (user, 2026-09-02)", () => {
  const table = { "Uncanny Dodge": { multiplier: 0.5 } };
  it("Uncanny Dodge cast halves; the note names it", () => {
    expect(
      v.interruptMultiplier({ answer: "cast", kind: "damage", reaction: "uncanny dodge" }, table)
    ).toEqual({ multiplier: 0.5, reaction: "Uncanny Dodge", note: "Uncanny Dodge — halved" });
  });
  it("null for a pass, an AC kind, an unlisted reaction, or no target at all", () => {
    expect(
      v.interruptMultiplier({ answer: "pass", kind: "damage", reaction: "Uncanny Dodge" }, table)
    ).toBeNull();
    expect(
      v.interruptMultiplier({ answer: "cast", kind: "ac", reaction: "Shield" }, table)
    ).toBeNull();
    expect(
      v.interruptMultiplier({ answer: "cast", kind: "damage", reaction: "Absorb Elements" }, table)
    ).toBeNull();
    expect(v.interruptMultiplier(undefined, table)).toBeNull();
  });
});

describe("saveMultiplier — null means no application AND no receipt", () => {
  const entry = (outcome, choice) => ({ outcome, choice });

  it("a failure takes it all", () => {
    expect(v.saveMultiplier(entry("failed"), "half")).toBe(1);
  });

  it("a save takes half, all, or nothing as the effect dictates", () => {
    expect(v.saveMultiplier(entry("saved"), "half")).toBe(0.5);
    expect(v.saveMultiplier(entry("saved"), "full")).toBe(1);
    expect(v.saveMultiplier(entry("saved"), "none")).toBe(null);
  });

  it("an ACCEPTED interpose turns the saved half into nothing at all", () => {
    // finding ⑥, recut by walk-5 (y): the settle card is the record, not a zero receipt.
    const e = entry("saved", { kind: "interpose", answer: "use" });
    expect(v.saveMultiplier(e, "half")).toBe(null);
  });

  it("a DECLINED interpose still takes the half", () => {
    const e = entry("saved", { kind: "interpose", answer: "pass" });
    expect(v.saveMultiplier(e, "half")).toBe(0.5);
  });

  it("an interpose on a FAILED save cannot exist, and is not honoured if it does", () => {
    // Only a saved entry ever carries the choice — there is no failed-with-spend case.
    const e = entry("failed", { kind: "interpose", answer: "use" });
    expect(v.saveMultiplier(e, "half")).toBe(1);
  });

  it("an unresolved or gone entry applies nothing", () => {
    expect(v.saveMultiplier(entry(null), "half")).toBe(null);
    expect(v.saveMultiplier(entry("gone"), "half")).toBe(null);
  });
});

describe("verdictText — the one line the row and the card both read", () => {
  const flag = { dc: 15, hasDamage: true, damageOnSave: "half" };

  it("says nothing for an unresolved target", () => {
    expect(v.verdictText(flag, { done: false })).toBe(null);
  });

  it("states the total, the DC and the stakes", () => {
    expect(v.verdictText(flag, { done: true, outcome: "saved", total: 18 })).toBe(
      "18 vs DC 15 — saved — half damage"
    );
    expect(v.verdictText(flag, { done: true, outcome: "failed", total: 9 })).toBe(
      "9 vs DC 15 — failed"
    );
  });

  it("reads the stakes off the effect — none and full-anyway both say so", () => {
    expect(
      v.verdictText({ ...flag, damageOnSave: "none" }, { done: true, outcome: "saved", total: 18 })
    ).toBe("18 vs DC 15 — saved — no damage");
    expect(
      v.verdictText({ ...flag, damageOnSave: "full" }, { done: true, outcome: "saved", total: 18 })
    ).toBe("18 vs DC 15 — saved — full damage anyway");
  });

  it("says nothing about damage when the effect deals none", () => {
    expect(
      v.verdictText({ dc: 15, hasDamage: false }, { done: true, outcome: "saved", total: 18 })
    ).toBe("18 vs DC 15 — saved");
  });

  it("marks a forced save and a timed-out one", () => {
    expect(v.verdictText(flag, { done: true, outcome: "saved", total: 1, forced: true })).toContain(
      "(legendary resistance)"
    );
    expect(
      v.verdictText(flag, { done: true, outcome: "failed", total: 4, timedOut: true })
    ).toContain("(timer)");
  });

  it("gives a vanished target its own line rather than a verdict", () => {
    expect(v.verdictText(flag, { done: true, outcome: "gone" })).toBe(
      "the target is gone — nothing to roll"
    );
  });
});

describe("verdictText — a save that could not succeed prints the condition where the total would be", () => {
  it("names the condition, never a null total", () => {
    const flag = { dc: 15, hasDamage: true, damageOnSave: "half" };
    const line = v.verdictText(flag, {
      done: true,
      outcome: "failed",
      total: null,
      autoFailed: true,
      autoFailedBy: "Paralyzed"
    });
    expect(line).toBe("cannot succeed (Paralyzed) vs DC 15 — failed");
    expect(line).not.toContain("null");
    expect(
      v.verdictText(flag, {
        done: true,
        outcome: "failed",
        total: null,
        autoFailed: true,
        timedOut: true
      })
    ).toBe("cannot succeed vs DC 15 — failed (timer)");
  });
});

describe("Evasion — none on a success, half on a failure (user, 2026-09-02)", () => {
  it("the multiplier reads the entry: 0 saved, 0.5 failed, nothing for a gone target", () => {
    expect(v.saveMultiplier({ outcome: "saved", evasion: true }, "half")).toBe(0);
    expect(v.saveMultiplier({ outcome: "failed", evasion: true }, "half")).toBe(0.5);
    expect(v.saveMultiplier({ outcome: "gone", evasion: true }, "half")).toBeNull();
    expect(v.saveMultiplier({ outcome: "saved" }, "half")).toBe(0.5);
  });
  it("the row says Evasion", () => {
    const flag = { dc: 15, hasDamage: true, damageOnSave: "half" };
    expect(v.verdictText(flag, { done: true, outcome: "saved", total: 20, evasion: true })).toBe(
      "20 vs DC 15 — saved — no damage (Evasion)"
    );
    expect(v.verdictText(flag, { done: true, outcome: "failed", total: 3, evasion: true })).toBe(
      "3 vs DC 15 — failed — half damage (Evasion)"
    );
  });
});
