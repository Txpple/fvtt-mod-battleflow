// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the membership lists, one shape.
 *
 * Moved verbatim out of hold.js, maneuvers.js and hit-riders.js (PLAN.md Phase 2, "move, do
 * not rewrite"), then unified here (PLAN.md Phase 3). Strings in, entries out — no `game`, no
 * `setting()`, no warnings, no globals. Each list keeps a one-line EDGE wrapper in
 * settings.js that reads its setting and delegates, which is the whole split: reading the
 * world is EDGE, deciding what the string MEANS is not.
 *
 * ⚠ WHY THIS MATTERS MORE THAN IT LOOKS (ARCHITECTURE.md §6, the strict-parse contract): a
 * typo in a world setting does not raise anything. The entry simply drops and the feature it
 * named silently does nothing, forever, with no error to notice. These parsers are the only
 * thing standing between a stray character and a dead feature.
 *
 * ⚠ WHAT PHASE 3 CHANGED, AND WHY IT WAS WORTH CHANGING. There were five list parsers with
 * FOUR different failure behaviours — default-to-`ac` (interrupts), silent drop (blocks,
 * upgrades), drop-and-report (folds), and no validation whatsoever (riders) — and exactly one
 * of the five declared its kind set in code. Which behaviour a given list had was an accident
 * of which session wrote it. Now every list is a SPEC and there is one parser: same splitting,
 * same trimming, same required-column rule, same closed-kind test, same reject report.
 *
 * ⚠ THE SPECS DECLARE, THEY DO NOT READ. A spec names its setting KEY as a plain string so the
 * static gate can pair a list with its registration and its shipped default; nothing here ever
 * reads a setting, and this file still imports nothing at all.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/** The closed set of maneuver fold kinds. Unknown kinds are DROPPED, never guessed. */
export const MANEUVER_KINDS = new Set(["precision", "riposte", "interpose", "bash", "hew"]);

/** The closed set of interrupt kinds — what a held reaction changes about an attack. */
export const INTERRUPT_KINDS = new Set(["ac", "damage"]);

/**
 * The closed set of D20 FOLD kinds — the three surveyed features (v1.23.0), which are one
 * mechanism wearing three different SPENDS. The arithmetic they share already shipped with D8
 * (`foldedRoll`/`foldedVerdict`/`foldedSave` handle `add` and `replace` on both sides); what
 * genuinely differs per feature — and therefore what earns a kind under R4 — is where the
 * marker lives and how you take it away:
 *
 *   heroic    `system.attributes.inspiration`, a bare BooleanField. Spending it is a WRITE.
 *   tactical  Second Wind's `itemUses`, reached through a real utility activity. `use()`.
 *   bardic    an ActiveEffect ("Inspired") the bard applied. Spending it is a DELETE.
 *
 * ⚠ THREE SPENDS, THREE DIE SOURCES, AND ONLY ONE OF THEM HAS AN ACTIVITY. Measured in the
 * dnd5e 5.3.3 source and this world's own PHB pack, 2026-08-23:
 *   - `heroic` has NO activity anywhere in the system, and a boolean is not one of the five
 *     consumption kinds (activityUses · itemUses · material · hitDice · spellSlots), so there
 *     is no consumption route to hang it on. The module writes the field, which is exactly
 *     what the system's own sheet toggle does.
 *   - `bardic`'s die formula is `@scale.bard.inspiration` — a scale value on the GRANTING
 *     BARD, not on the creature holding the die. It resolves cross-actor, through the
 *     effect's `origin`.
 *   - only `tactical` is Precision-shaped: an activity, consumed with `use()`.
 *
 * ⚠ These are NOT contribution shapes. `add`/`replace`/`ac`/`verdict` are mechanism vocabulary
 * and deliberately uncounted (§6); a kind here names a SPEND, which is content, which is
 * precisely what the R4 tripwire is counting.
 */
export const D20_FOLD_KINDS = new Set(["heroic", "tactical", "bardic"]);

/**
 * The closed set of volley kinds. Lives here, in the pure layer, so that ONE definition serves
 * the shipping registry and the static gate alike. ⚠ It used to exist twice: volley-registry.js
 * knew them implicitly and `tools/check-registry.mjs` re-declared them as a lookalike — the
 * exact defect Phase 2 removed for the maneuver kinds and then left standing here.
 */
export const VOLLEY_KINDS = new Set(["damage", "attack"]);

/**
 * The weapon masteries this module RESOLVES. Seven of the system's eight — `nick` is
 * deliberately native (it is pure action economy, and ruling 1 says action economy is not this
 * module's job), which is why it is declared below rather than merely absent. An absence and a
 * decision look identical in a switch statement; only one of them survives a code review.
 */
export const MASTERY_KINDS = new Set(["vex", "sap", "cleave", "slow", "topple", "push", "graze"]);

/** Masteries the system has and this module deliberately leaves alone. See MASTERY_KINDS. */
export const MASTERY_NATIVE = new Set(["nick"]);

/** Walk-5 (z): what each mastery popup quotes (DATA, moved here from mastery.js 2026-09-01 so the
 * reminder gate can quote it without a sideways import) — the 2024 property text VERBATIM, matched
 * against the system's own rules journal by tools/probe-mastery-rules.mjs (2026-08-21,
 * dnd5e 5.3.3; punctuation included). Never paraphrase these; the module's operational
 * hints ride as separate lines wherever they are needed. */
export const MASTERY_RULES = Object.freeze({
  slow: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn’t exceed 10 feet.",
  topple: "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.",
  push: "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.",
  graze: "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.",
  vex: "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  sap: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  cleave: "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage, but don’t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn."
});

/**
 * The REMINDER kinds — the sources of Advantage or Disadvantage the gate can read off the table
 * before an attack roll (HANDOFF Stage 2, 2026-09-01). Each is a distinct way of KNOWING:
 *   vex    the attacker's own Vexed chip on a target      → Advantage
 *   sap    a Sapped chip on the attacker                   → Disadvantage
 *   prone  the Prone status, both roles: the attacker prone → Disadvantage; the target prone →
 *          Advantage within 5 feet of it, Disadvantage beyond (decide/reminders.js)
 * The gate never SETS a mode (DESIGN R-A): it lists every source and the net, and a human presses.
 * Membership — which of these a table wants nagged about — is the Reminder Sources list.
 */
export const REMINDER_KINDS = new Set(["vex", "sap", "prone", "condition"]);

/**
 * The CONDITION SOURCES the `condition` reminder kind can read — the thirteen (Stage 3,
 * 2026-09-01, the AC5e table carried as data, DESIGN R-B): the 2024 conditions whose glossary
 * clause bends an attack roll on one side or the other, plus the two whose clause says the
 * attack should not be happening at all. Prone is NOT here — it is its own kind, with geometry.
 * What each does is `CONDITION_BENDS` in decide/reminders.js; the unit tests pin the two sets equal.
 */
export const CONDITION_STATUSES = new Set(["blinded", "invisible", "paralyzed", "petrified", "poisoned",
  "restrained", "stunned", "unconscious", "frightened", "grappled", "incapacitated", "dodging", "charmed"]);

/**
 * THE R4 TRIPWIRE, AS DATA (DESIGN.md R4, PLAN.md Phase 3).
 *
 * R4's bargain is that a new ABILITY costs a data entry and zero code, and that this is safe
 * because every axis it keys on is a closed enumerated set. The bargain has a stated
 * abandonment condition: *if new KINDS start arriving faster than one per phase, stop adding
 * kinds and adopt a conditions library instead.* That condition was unmeasurable — nobody could
 * state the rate, so the tripwire could never actually fire.
 *
 * This is the measurement. Every closed kind set the module owns, in one place, with the size
 * of the system enum it mirrors where such an enum exists. `tools/check-registry.mjs` prints it
 * and pins the total, so ADDING A KIND FAILS THE GATE until someone changes the pin on purpose.
 * That is the whole mechanism: not a rule against new kinds, a rule against *unnoticed* ones.
 *
 * ⚠ `system` is the size of the dnd5e enum this set mirrors, or null where the kind is the
 * MODULE'S OWN invention and no system enum exists to check it against. Only masteries mirror
 * one. That distinction is the honest answer to "registries carry their kind against a closed
 * set, checkable against the system's own enums": it is checkable for exactly one of the four,
 * it is already checked there (tools/check-mastery-rules.mjs, live, against
 * CONFIG.DND5E.weaponMasteries), and for the other three there is nothing to check against
 * because the system has no concept of an "interrupt kind" or a "fold kind" at all.
 */
export const KIND_SETS = [
  { name: "interrupt", owner: "hold.js", kinds: INTERRUPT_KINDS, system: null,
    note: "what a held reaction changes about an attack already rolled" },
  { name: "maneuverFold", owner: "maneuvers.js", kinds: MANEUVER_KINDS, system: null,
    note: "how a listed feat folds into a resolved attack — D8 says this set is the one under pressure" },
  { name: "d20Fold", owner: "d20-folds.js", kinds: D20_FOLD_KINDS, system: null,
    note: "where the marker lives and how it is spent — the three surveyed features (v1.23.0); "
      + "the ARITHMETIC is shared and already shipped with D8, so only the spend earns a kind" },
  { name: "volley", owner: "volleys.js", kinds: VOLLEY_KINDS, system: null,
    note: "how a multi-projectile spell resolves: aggregated damage, or independent attacks" },
  { name: "mastery", owner: "mastery.js", kinds: MASTERY_KINDS, system: 8,
    note: "7 of the system's 8; nick is deliberately native (action economy, ruling 1)" },
  { name: "reminder", owner: "mastery.js", kinds: REMINDER_KINDS, system: null,
    note: "what the gate can READ as a source of Advantage/Disadvantage before an attack roll — "
      + "a chip on the target, a chip on the attacker, a status with geometry (Stage 2, 2026-09-01)" }
];

/** Split a comma list into trimmed, non-empty chunks — the shape every list setting wears. */
const chunks = raw => String(raw ?? "").split(",").map(s => s.trim()).filter(Boolean);

/** Split one `A:B` chunk into its trimmed halves. */
const pair = chunk => chunk.split(":").map(s => s?.trim());

/**
 * THE LIST SPECS — one per membership list, keyed by the name the EDGE wrapper uses.
 *
 * Fields:
 *   label       the setting's own UI name, so a warning names what the reader must go and fix.
 *   setting     the `S` key, as a STRING (see the header: declaring, not reading).
 *   columns     the `A:B` halves in order. Every column is REQUIRED unless it is the kind
 *               column of a spec that declares a fallback — one rule, no per-list exceptions.
 *   kindColumn  which column is validated against a closed set, or null.
 *   kinds       that closed set, or null.
 *   fallback    ⚠ a DECLARED, WARNED substitution for an unrecognised kind, or null to drop.
 *   default     the SHIPPED default for that setting.
 *
 * ⚠ THE DEFAULTS LIVE HERE, WITH THE PARSER THAT HAS TO ACCEPT THEM (PLAN.md Phase 3), and
 * settings.js reads them when it registers. They used to sit inline in the register blocks,
 * where the static gate could only reach them by scraping source with a regex — which the
 * check itself flagged as "a heuristic, and a fragile one". It was: the regex ended a
 * double-quoted default at the apostrophe in "Stone's Endurance", silently truncating the
 * interrupt list to two thirds of itself. That went unnoticed only because the old check asked
 * nothing stronger than "is it comma-shaped". A shipped default that its own parser rejects
 * disables a feature for every fresh world, so the gate now imports the real string.
 *
 * ⚠ Only `interrupt` declares a fallback, and it is the one deliberate exception to
 * ARCHITECTURE §6 rule 6 ("dropped with a warning, never guessed"). The reason is a table
 * outcome rather than a taste: an interrupt whose kind is mistyped is STILL a reaction worth
 * pausing for, and `ac` is the conservative reading — whereas a fold with no recognised kind
 * has no machine to run at all. What Phase 3 changed is that the exception is now *declared
 * and warned* instead of buried in a parser body, so a typo no longer looks like a working
 * entry. §6 rule 6 was amended to admit a declared fallback; an UNDECLARED one is still a bug.
 */
export const LIST_SPECS = {
  interrupt: {
    label: "Interrupt List", setting: "interruptList",
    columns: ["name", "kind"], kindColumn: "kind", kinds: INTERRUPT_KINDS, fallback: "ac",
    // ⚠ Riposte is deliberately ABSENT: it triggers on a MISS (the hold offers on hits) and it
    // is not an AC boost, so an entry here can only ever produce the every-hit nonsense hold
    // that was struck from the live worlds at v1.16.0. It lives in the Maneuver Folds list
    // instead. This default carried it until v1.19.0 — the strike missed the registered
    // default, so a fresh world or Reset Defaults kept re-seeding the bug.
    default: "Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, "
      + "Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, "
      + "Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage"
  },
  block: {
    label: "Block List", setting: "blockList",
    columns: ["spell", "reaction"], kindColumn: null, kinds: null, fallback: null,
    default: "Magic Missile:Shield"
  },
  maneuverFolds: {
    label: "Maneuver Folds", setting: "maneuverFolds",
    columns: ["name", "kind"], kindColumn: "kind", kinds: MANEUVER_KINDS, fallback: null,
    default: "Precision Attack:precision, Riposte:riposte, Shield Master:interpose, "
      + "Shield Master:bash, Great Weapon Master:hew"
  },
  d20Folds: {
    label: "D20 Folds", setting: "d20Folds",
    columns: ["name", "kind"], kindColumn: "kind", kinds: D20_FOLD_KINDS, fallback: null,
    // ⚠ THE `name` COLUMN IS A LOOKUP KEY, NOT A DISPLAY NAME (recut 2026-08-23 after the
    // first table pass). What the card and popup SAY comes from the kind — `KIND_LABEL` in
    // d20-folds.js — and the two genuinely differ:
    //   tactical  → an ITEM on the actor with this name ("Tactical Mind"). Key and label agree.
    //   bardic    → an ACTIVE EFFECT with this name, which the system calls "Inspired" (the
    //               effect the bard's Inspire activity applies, NOT the bard's own feat).
    //               ⚠ Key and label DISAGREE, and must: nobody at the table calls the feature
    //               "Inspired", so a card announcing "Inspired — spent" names a thing the rules
    //               do not have. It is Bardic Inspiration on screen and "Inspired" in the find.
    //   heroic    → NO LOOKUP AT ALL. The marker is `system.attributes.inspiration`, a boolean
    //               with no document behind it, so this string is never matched against
    //               anything. It is required only because every column is required.
    // ⚠ v1 used this column for BOTH jobs and the table read "Inspired" on every bardic card.
    // Splitting them is why renaming the effect here changes what is FOUND and never what is
    // said — which is the right way round.
    default: "Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic"
  },
  rider: {
    label: "Rider List", setting: "riderList",
    columns: ["name"], kindColumn: null, kinds: null, fallback: null,
    default: "hunters-mark, hex, great-old-one-hex"
  },
  riderUpgrade: {
    label: "Rider Upgrades", setting: "riderUpgrades",
    columns: ["feature", "rider"], kindColumn: null, kinds: null, fallback: null,
    default: "foe-slayer:hunters-mark"
  },
  reminders: {
    label: "Reminder Sources", setting: "reminderList",
    // ⚠ The list IS the switch (the v1.19.0 idiom): every entry is a kind the gate knows how to
    // read, and an empty list turns the gate off. Unknown kinds are dropped with a warning.
    columns: ["kind"], kindColumn: "kind", kinds: REMINDER_KINDS, fallback: null,
    default: "vex, sap, prone, condition"
  },
  conditions: {
    label: "Condition Sources", setting: "conditionList",
    // Which of the thirteen the gate reads. An entry is a status id the system uses; the list
    // is the switch for the `condition` kind, one condition at a time.
    // ⚠ `membership: true` — this closed set validates the list but is NOT a kind set, and the
    // R4 tripwire deliberately does not count it: the thirteen are ROWS of one table read by ONE
    // mechanism (decide/reminders.js `conditionSources`), and a fourteenth costs a data row and
    // a list entry, zero code paths — R4's definition of membership. The kind it belongs to is
    // `condition` in REMINDER_KINDS, which IS counted. The registry unit test pins this reading.
    columns: ["kind"], kindColumn: "kind", kinds: CONDITION_STATUSES, fallback: null, membership: true,
    default: "blinded, invisible, paralyzed, petrified, poisoned, restrained, stunned, unconscious, "
      + "frightened, grappled, incapacitated, dodging, charmed"
  }
};

/**
 * Parse one list setting against its spec.
 *
 * Returns `{ entries, rejects }` rather than warning: the warn-once bookkeeping is a side
 * effect that owns a console and a seen-set, so it belongs to the EDGE caller (settings.js).
 * Each reject carries `{ chunk, action, detail }` where action is `"dropped"` (the entry is
 * gone) or `"defaulted"` (the entry survives with the spec's declared fallback) — the EDGE
 * warns on both, because a silently corrected entry is still a setting somebody must fix.
 */
export function parseList(spec, raw) {
  const entries = [];
  const rejects = [];
  for ( const chunk of chunks(raw) ) {
    const halves = pair(chunk);
    const entry = {};
    spec.columns.forEach((col, i) => { entry[col] = halves[i]; });

    // Required columns. The kind column is exempt only where a fallback stands ready for it.
    const missing = spec.columns.find(col =>
      !entry[col] && !(col === spec.kindColumn && spec.fallback));
    if ( missing ) {
      rejects.push({ chunk, action: "dropped", detail: `no ${missing}` });
      continue;
    }

    if ( spec.kindColumn ) {
      const kind = entry[spec.kindColumn]?.toLowerCase();
      if ( spec.kinds.has(kind) ) entry[spec.kindColumn] = kind;
      else if ( spec.fallback ) {
        entry[spec.kindColumn] = spec.fallback;
        rejects.push({ chunk, action: "defaulted",
          detail: kind ? `"${kind}" is not a kind` : "no kind given" });
      } else {
        rejects.push({ chunk, action: "dropped",
          detail: kind ? `"${kind}" is not a kind` : "no kind given" });
        continue;
      }
    }
    entries.push(entry);
  }
  return { entries, rejects };
}

/**
 * The one-line human sentence for a reject — built here, beside the rule that produced it, so
 * the EDGE wrapper owns only the seen-set and the console. Names the allowed kinds, because a
 * warning that does not say what WOULD have worked costs its reader another trip to the docs.
 */
export function rejectMessage(spec, reject) {
  const allowed = spec.kinds ? ` (${[...spec.kinds].join("/")})` : "";
  return (reject.action === "defaulted")
    ? `${spec.label}: "${reject.chunk}" — ${reject.detail}${allowed}; read as "${spec.fallback}", never guessed further.`
    : `${spec.label}: "${reject.chunk}" — ${reject.detail}${allowed}; ignored, never guessed.`;
}
