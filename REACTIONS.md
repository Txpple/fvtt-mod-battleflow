# REACTIONS.md — the interrupt-reaction survey

> Evidence for the curated interrupt list in [design.md](design.md) §5 (Phase 1.5). Scanned
> 2026-08-15 against every Item compendium in *The Broken Heart of Greenrest*
> (Foundry 14.364 + dnd5e 5.3.3: 2024 PHB/MM/DMG, Heroes of Faerûn, and the legacy
> `dnd5e.*` SRD packs). Re-run `tools/scan-reactions.mjs` after adding content.
>
> **Scope**: *interrupt* reactions only — the ones that change the outcome of an attack that
> has already been rolled, and therefore need the chain to pause. Opportunity attacks,
> Hellish Rebuke, Counterspell and other retaliation/out-of-band reactions are table-level
> play, not module concerns (§8 non-goals).

## Method, and the trap in it

26 Item packs, 6 300+ documents. An item is a reaction candidate when **either** its own
activity declares `activation.type === "reaction"` **or** the item does.

⚠ **Both signals are required, and this is not obvious.** An activity carries its own
activation only when `activation.override` is true; otherwise it *inherits the item's*
(`data/activity/_types.mjs:15`, "Override activation values inferred from item"). Spells keep
casting time at item level, so an activities-only scan silently returns **zero reaction
spells — Shield included**. Class features mostly do the opposite. Compendium *index* data is
raw source with no data preparation applied, so neither signal alone is complete; a live
actor's activity resolves the inheritance during prep and reads correctly either way.

Raw scan: **170 reaction-cost items**. Of those, **31 are interrupts**, in three kinds.

## AC-type — raise AC against the triggering attack

Trigger is "you are hit"; the response raises AC, potentially turning that hit into a miss.
**Re-resolution is one uniform test for this entire family** — re-run `roll.total >= liveAC`
— which is the whole reason curation beats a platform here.

**Crits skip the hold**: a natural 20 hits regardless of AC, so pausing would be a pure
false stop.

| Reaction | Source | Effect | At this table |
| --- | --- | --- | --- |
| **Shield** (spell, L1) | PHB spells | +5 AC, *including against the triggering attack* | **Gren** ✓ (always-prepared, 2/4 L1 slots) |
| Defensive Duelist | PHB feats | +PB to AC vs melee, "potentially causing the attack to miss" | — |
| Illusory Self | PHB (wizard) | The attack **automatically misses** — not AC math | — |
| Glorious Defense | PHB (paladin) | +CHA AC to **self or an ally within 10 ft** | — |
| Parry | MM + `dnd5e.monsterfeatures` | +2 AC vs one melee attack | monsters |
| Defensive Stance | MM | +4 AC vs melee incl. the triggering attack | monsters |
| Counterattack | MM | +4 AC vs that attack | monsters |
| Riposte | MM 2024 | +3 AC vs that attack (⚠ the Battle Master maneuver of the same name is *retaliation*, not an interrupt) | monsters |
| Whirlwind of Sand | MM 2024 | +2 AC vs the attack, then teleports | monsters |

## Damage-type — reduce the damage after the hit lands

Trigger is the hit or the damage; the response reduces it. These must pause *before* damage
is rolled/applied, or be handled post-hoc via revert + reduction (a design.md §6 setting).

| Reaction | Source | Effect |
| --- | --- | --- |
| **Uncanny Dodge** | PHB (rogue), also MM | Halve the attack's damage |
| Deflect Attacks | PHB 2024 (monk) | Reduce by 1d10 + DEX + monk level (B/P/S only) |
| Deflect Missiles | `dnd5e.classfeatures` (monk 2014) | Reduce ranged weapon damage by 1d10 + DEX + level |
| Interception | PHB feats | Reduce damage to **another creature** within 5 ft by 1d10 + PB |
| Stone's Endurance | PHB origins (goliath) | Reduce by 1d12 + CON |
| Superior Hunter's Defense | PHB (ranger) | Resistance to that damage |
| Song of Defense | Heroes of Faerûn (bladesinger) | Reduce by 5 × slot level |
| Elemental Absorption | MM | Resistance to that instance + temp HP |

## Roll-type — modify the attack roll after it is rolled

Same pause point as AC-type, but they change the *roll*, not the AC — and the roll is already
evaluated and persisted, so the uniform `total >= liveAC` re-test does **not** see them.
**Deliberately out of scope for now**; revisit only if this table ever fields a bard or wild
magic sorcerer.

| Reaction | Source | Effect |
| --- | --- | --- |
| Cutting Words | `dnd5e.classfeatures` (bard) | Subtract a Bardic die from the attack roll |
| Bend Luck | PHB (sorcerer) | ±1d4 to the d20, "immediately after another creature rolls" |

## Pre-roll — impose disadvantage before the attack resolves

A **different interrupt point** (before the roll, not after the hit), so Phase 1.5's hold
cannot serve them. Out of scope; listed so the omission is a decision rather than an
oversight.

Protection (fighting style) · Warding Flare (cleric) · Shadowy Dodge · Arrow-Catching Shield
(redirects the attack to yourself).

## Findings that change the design

1. **Absorb Elements does not exist in this world.** It is a 2014 spell with no 2024 PHB
   entry; design.md §5 names it as the canonical damage-type example. Only **8 reaction
   spells** exist across all packs — Shield, Counterspell, Hellish Rebuke, Feather Fall,
   Backlash, Fount of Moonlight, Elminster's Effulgent Spheres, Alustriel's Mooncloak — and
   **Shield is the only interrupt among them**.
2. **The entire PC-side interrupt surface at this table is Shield, on Gren.** Nobody else has
   one. That is the strongest possible evidence for curation over a detection platform.
3. **Monster interrupts are real and all AC-type** (Parry, Counterattack, Defensive Stance,
   Riposte, Whirlwind of Sand). The GM-side hold is not a rare curiosity — it is the "your
   monster has Parry" reminder doing useful work.
4. ⚠ **The AC change is not automatic.** Shield's +5 arrives as a **non-transfer** Active
   Effect on the spell ("Imperceptible Barrier", `system.attributes.ac.bonus` ADD 5, 6s,
   `expiry: turnStart`) that the native effects tray applies on click. Monster reactions are
   worse — their AE ships **disabled** with a Foundry Note telling the GM to enable it by
   hand. So re-resolution cannot read live AC the instant a cast is detected: it must wait
   for the AC to actually move. Phase 3 (effect auto-application) closes this properly; until
   then the hold watches for the change and falls back to a settle deadline.
