# FLOW.md — the flow/polish backlog

> **What this is.** The FLOW track: places the table's natural play fought the automation.
> Built from a full audit of the **2026-08-18 live session** (session 4, the Hollow) — the
> spoken transcript (2,996 lines, 00:00:00–03:31:37) and the Foundry chat log (697 messages,
> 23:38Z–03:10Z), both under `fvtt-campaign-greenrest/sessions/2026-08-18/`, plus
> `gm-notes.md` §4 and `recap.md`.
>
> **This is NOT the bug list.** The seven ledgered bugs (findings ①–⑦) live in
> [HANDOFF.md](HANDOFF.md) and are **CLOSED at v1.15.0**. This file is the separate polish
> track.
>
> ⚠ **RECONCILED 2026-08-19 against the v1.15.0 tree.** The audit was written before v1.15.0
> landed, so parts of it were already built by the time it was read. Every claim below was
> re-verified against `scripts/` — see the reconciliation table. **The original Desktop
> scratch file is SUPERSEDED and is no longer a reference; this file is the source of truth.**

## What the reconciliation changed

| Audit said | Verified state | Where |
| --- | --- | --- |
| "Another session owns three items — uncommitted drafts in mastery.js / effect-riders.js" | ✅ **LANDED at v1.15.0.** Twin-ask supersede via `sourceMessageId`; `respondsTo` guard in the topple fold; twin-chip fingerprint `applied: true`. Nothing is uncommitted. | [mastery.js:288](scripts/mastery.js:288), [mastery.js:524](scripts/mastery.js:524), [effect-riders.js:93](scripts/effect-riders.js:93) |
| Item 7's worst case — two Con demands on Edda, one d20 claimed by the wrong machine | ✅ **FIXED** as v1.15.0 finding ④. The fold refuses any roll carrying another machine's `respondsTo`; a bare roll defers conc → saves → topple. | [mastery.js:524](scripts/mastery.js:524) |
| Item 7 — "Topple posts nothing on success" | 🟡 **HALF SHIPPED** as finding ⑤. Topple now posts `"<name> stays standing"`. The **saves** machine still folds verdicts into card rows and never announces. | [mastery.js:573](scripts/mastery.js:573) |
| Item 8 — doubled Cleave reminder cards, 477ms apart | ✅ **COVERED** by the same supersede, exactly as the audit predicted. | [mastery.js:288](scripts/mastery.js:288) |
| "Wednesday's order: re-verify ①–⑦ → fix pass → the v1.14.0 walk" | ✅ **ALL THREE COMPLETE.** ①–⑦ closed at v1.15.0; the carry-over walk closed clean 2026-08-19 with zero findings. | [HANDOFF.md](HANDOFF.md) |
| "Shield / 1-round effect auto-expiry" (listed as owned elsewhere) | ❌ **NOT landed.** Mastery chips carry `{ rounds: 1 }` in combat / 6s out, but **no expiry enforcement exists** — nothing sweeps them. Folded in below as item 12. | [mastery.js:235](scripts/mastery.js:235) |
| Every seam line reference | ✅ **ALL ACCURATE** against the current tree. | see Seams |

**Two new findings the reconciliation turned up — neither is in the original audit:**

- ⚠ **`Riposte:ac` in the live reaction list CAN NEVER FIRE CORRECTLY.** The hold machine
  offers reactions only on **hits** — `stampHoldIfInterrupted` iterates the `hits` array
  ([hold.js:304](scripts/hold.js:304)) — while Riposte triggers on an enemy **miss**. It is
  also the wrong *kind*: `ac` raises AC, Riposte makes an attack. And unknown kinds silently
  default to `ac` ([hold.js:32](scripts/hold.js:32)), so a typo lands in the same place. This
  is a **live misconfiguration in the settings table**, not merely unbuilt code — item 1's
  Riposte half must fix the setting as well as build the fold.
- ⚠ **Item 4's FIRST CHECK is decisive and probably resolves as CONTENT.** There is **zero**
  consumable handling anywhere in `scripts/` — self-aim keys purely on
  `activity.target.affects.type === "self"` ([polish.js:45](scripts/polish.js:45)–98). So if
  the world's potions carry `affects.type: self` on their heal activity, the existing machine
  already handles them and the sighting is content drift; if they don't, it is a content fix.
  Module code is only implicated if the flag IS set and it still healed the chest.
  ⚠ **Item 4 has since been FOLDED into item 2 by user call** — see its section for the one
  probe answer that would un-fold it.

## Context that still holds

- **The table LIKED it.** Two unprompted compliments on mic; combat visibly faster than
  session 3. These are polish targets, not a rescue.
- **The elect-contamination caveat is now history, not a live hazard.** Zombie headless GM
  clients held the elect for ~45 min of session 4. v1.15.0 makes the module CONVERGE, and the
  operational rule stands: ONE GM-capable client during play. Findings from that night
  involving duplicate cards or stranded one-shots were already re-judged under it.
- **HANDOFF.md's parenthetical mis-dated the live session as 2026-08-19.** It was Tuesday
  **2026-08-18**.

---

# PHASE 1 — THE FOLD WORK

## 1. Post-roll folds: Precision Attack + Riposte — 🔵 STANDS
The headline item. Both are post-hoc modification the system cannot do.

**Precision Attack** — 4 occurrences (00:46, 01:14, 02:42, 03:01, all Morgash), ~45–65s stall
each. Card posts, bare 1d8 rolls, nothing patches the missed attack total. The table's
workaround — re-rolling the attack as `1d20 + 1d20 + …` to force a hit — **re-randomizes the
d20** instead of adding 1d8 to the miss, so **every hit reached that way is mechanically
suspect**. On the first use the d8 was ALSO double-booked as bonus damage.

**Riposte** — 3 of 3 uses out of order. Clicking it posts `Riposte — Damage Roll: 1d8` before
any attack exists. First use: die rolled, no attack roll ever made, kill narrated anyway.
Third use: Matthew stopped the table (*"no, you have to attack"*). The die never merged into
the damage formula on any of the three.

**Shape** — both become reaction folds like Shield:
- *Precision*: button on the missed attack message → roll 1d8 → patch the original total →
  re-run the hit check → post a verdict line (`13 + 4 = 17 vs AC 15 — now hits`).
- *Riposte*: trigger on enemy melee **miss** → hold → attack rolls INSIDE the fold → die
  appended to damage on hit.

✅ **`Riposte:ac` STRUCK from the Reaction List, 2026-08-19** — build-order step 0, done.
It could never fire correctly: wrong trigger (the hold offers on **hits**, Riposte triggers on
a **miss**) and wrong kind (`ac` raises AC; Riposte makes an attack).

⚠ **It was not inert — it fired on every hit, and here is the mechanism.**
`reactionACBonus` ([ui.js:244](scripts/ui.js:244)) reads a numeric
`system.attributes.ac.bonus` change off the reaction's own effect. Riposte has **no effects at
all**, so it returns `null` — and `holdWouldMatter` ([hold.js:363](scripts/hold.js:363)) then
returns **true**: *"unmeasurable bonus — ask the human."* That default is correct for a
proficiency-scaled boost like Defensive Duelist, but for something that is not an AC boost at
all it means the hold was offered **every time Morgash was hit**, and answering it posted a
bare `1d8` with no attack behind it — the exact session-4 symptom. Both "hopeless hold" guards
were ON and neither caught it, because the null branch bypasses them by design.

**Audited, not guessed** — `tools/audit-reaction-list.mjs` (NEW) walks the setting against the
world's real items. The list turned out to be almost entirely **inert placeholders**: only
**Shield** (correct — the spell holders all carry `ac.bonus = 5`) and **Riposte** resolved to
any item at all. Absorb Elements, Uncanny Dodge, Defensive Duelist, Illusory Self, Glorious
Defense, Parry, Counterattack, Defensive Stance, Whirlwind of Sand, Deflect Attacks and
Stone's Endurance are held by nobody in this world, so they cost nothing where they sit.
⚠ An earlier guess that **Parry** and **Counterattack** were also miscategorised was WRONG and
is retracted — nobody has them, so their kind never matters until somebody does.

⚠ **Re-add Riposte only through item 1's fold**, never back into this list — the fold owns the
miss trigger, and an `ac` entry would resume offering the nonsense hold beside it.

## 2. Targets shown in the use/roll dialog — ✅ BUILT + TABLE-VERIFIED 2026-08-19

> ✅ **Table-walked clean in the v1.16.0 walk (all four of its checks) and the potion question
> it carried is ANSWERED: a consumable DOES raise a dialog, and the block decorates it.**
**⚠ This item now ABSORBS the probe pass** (user call, 2026-08-19: *"basically this is item 1,
too, so fold these topics together"*). The probe questions were never separable from the
build — they are step A of it.

**History, so it isn't re-litigated:** v1 was a separate "confirm targets, Proceed/Cancel"
popup — **rejected**, costs a click on every action and fights the speed goal. v2
(**adopted**) decorates the dialog the player already sees. v3 — checkboxes that untarget on
canvas — was scoped in and **scoped straight back out**; see the deferred section below.

### The user's spec (2026-08-19, with the screenshot)
> *"this popup which happens right when person clicks an icon that has a use ability — it
> showed for attacks, spells, items, etc… where I have the blue square I want it extended down
> so it shows all the actors that are targeted, 0–n."*

- The block hangs **below the ADVANTAGE / NORMAL / DISADVANTAGE row**, extending the dialog
  downward (the user drew the box there explicitly).
- It lists **every current target, 0 to n**. The **0 case is not an edge case** — render an
  explicit "No targets" line. A spell reaching the dialog with nothing targeted is exactly the
  mistake this exists to surface, and the `requireTarget` veto only guards `attack` activities
  ([polish.js:20](scripts/polish.js:20)), so spells and items arrive here ungated.
- Each row: the target's **token art**, its name, and its disposition in words.
  ✅ **Portraits landed 2026-08-19** (user: *"put the actor tokens in… like they are included
  on the cards for hp changes"*). 32px, `gold-icon` class, 4px radius — the receipt card's own
  damage-row framing, deliberately. The **token texture** is used, not the actor portrait,
  because the question this block answers is "is that the thing I clicked on the canvas?", so
  it should show what is ON the canvas; it falls back to the actor portrait, then to the
  disposition glyph, so art-less tokens still render a row instead of a hole.
  Disposition now rides the portrait's **border** in the canvas colour rather than a separate
  glyph. ⚠ The disposition WORD stays and is not decoration — with the glyph gone, colour
  would otherwise be the only ally/enemy carrier, which fails for colour-blind players and in
  every screenshot. Frame colour, `alt` text and the word are three independent carriers.
  ⚠ **NOT a warning flag.** The audit's original design was `[!]` on "anything suspicious";
  the user struck it 2026-08-19: *"don't use `!` because it's like a flag, and some spells are
  meant to cast on allies. If there's an icon indicating enemy vs ally that would be helpful."*
  Healing, Bless and Bane all legitimately aim at allies — an alarm on every one of those
  trains the table to ignore it, which is worse than showing nothing. **The icon is neutral
  information on EVERY row, never a judgement on any row.** The player reads the mismatch
  themselves: a sword icon on the person you meant to heal is the whole catch.
- **Icon scheme:** mirror the token disposition colours the table already reads off canvas
  borders — friendly / neutral / hostile. Foundry ships FontAwesome, so no new assets. Use
  colour AND glyph, never colour alone (a red-green-only cue fails for colour-blind players
  and is unreadable in scrollback screenshots).
- ✅ **DECIDED 2026-08-19: ABSOLUTE disposition** (user call, *"yes use absolute
  disposition"*). The icon reads the target's OWN friendly / neutral / hostile, exactly as the
  canvas border shows it — **never relative to whoever is rolling**. It therefore can never
  disagree with what is on screen, and it means the same thing on every dialog on every
  client. ⚠ The known consequence, accepted: when the GM rolls for a monster, a `friendly`
  token is that monster's *enemy* but still draws the ally icon. The GM knows the fiction;
  a cue that silently flips meaning depending on who is rolling would be worse than one that
  is always literal.
- **It must appear on every use dialog class**, not just attack rolls — attacks, spells, items.

### ✅ WHAT SHIPPED (2026-08-19, unversioned — deployed to the SANDBOX only)
Both dialog classes are hooked in `polish.js` and both were seen rendering the block:

| Probed question | Answer, measured |
| --- | --- |
| Which classes render? | **`AttackRollConfigurationDialog`** (attack rolls) and **`ActivityUsageDialog`** (spell/item use, where slot level is chosen). Both confirmed painting the block. Enchant/Summon/Transform/Order subclass the usage dialog, and ApplicationV2 fires render hooks for **every class in the inheritance chain**, so the two base-name hooks cover all of them. |
| Does a potion raise a dialog? | ⚠ **STILL OPEN** — the sandbox party carried no consumable to open one with. Item 4's un-fold still hangs on this. |
| Multi-projectile count field | ⚠ **NOT PROBED** — deferred to item 6's own build. |

Verified by `tools/probe-target-block.mjs` (NEW): two mixed targets render two rows with the
right glyph and the exact canvas colour; untargeting on canvas **repaints live under a
standing dialog**; a re-render leaves exactly **one** block, never two; zero targets render
"No targets"; a neutral target reads "neutral". Colours came back `rgb(231,33,36)` hostile,
`rgb(67,223,223)` friendly, `rgb(241,216,54)` neutral — `CONFIG.Canvas.dispositionColors`
exactly, so the block cannot disagree with the token border.

⚠ **HARNESS TIMING, or the next person will think the hook is broken:** the dialog takes
**~9 seconds** to auto-render in the Playwright sandbox (Chrome throttles timers in a
backgrounded page). Fixed waits of 700 ms and 3 s both found nothing and read exactly like a
dead hook. **Poll, never sleep a guess.** Also: `rollAttack(..., {configure: true}, ...)`
never resolves — it is waiting for a human — so it must be fired and left pending.

⚠ **Not yet seen by a human at the table.** Everything above is machine-verified in the
sandbox; nothing is on prod. The table check is one line: open an attack and a slot-level
spell and look at the bottom of the dialog.

### Step A — the PROBE (read-only, answers three questions at once)
This repo has been burned three times guessing system internals (`results.templates` being
arrays; `_stats.createdTime` reading null; `object.shape` not existing at create time).
**Probe first. Always.**

1. **Which Application classes actually render**, for each of: a weapon attack, a spell with a
   slot-level choice, a **consumable/potion use**, and a save-prompting spell. The screenshot
   is `RollConfigurationDialog`; the usage/activity dialog is a different class and may need a
   second hook. ⚠ **This same answer decides item 4** — if a potion use raises *no dialog of
   any class*, decoration cannot catch the mis-target and item 4 un-folds.
2. **When does dnd5e stamp `flags.dnd5e.targets`** — before or after the config dialog
   resolves? ⚠ **Not needed for display-only**, but it is the fact that decides whether the
   deferred interactivity below can ever be built honestly. Record the answer either way.
3. **The multi-projectile count field** (item 6) — where the count lives on a scaled activity,
   how it scales, and whether Scorching Ray's rays are one activity or N. Cheap to fold into
   the same probe run.

### Step B — the build (display-only)
**Seam:** [polish.js:169](scripts/polish.js:169) already hooks `renderRollConfigurationDialog`
and mutates the dialog — that is how `centerRollDialogs` works. Inject the target block the
same way, plus whatever second hook the probe names for the usage dialog.

⚠ **DIFFERENT RE-RENDER DISCIPLINE FROM THE CENTERING THAT SITS BESIDE IT — document this or
someone will "fix" it into a bug.** Centering is deliberately **first-render-only**
(`app._bfCentered`) because re-centering would fight the user dragging the window. The target
block is the opposite: it must **re-render idempotently on EVERY render**, reading live from
`game.user.targets` each time. Re-renders fire on every option change (advantage, attack mode,
roll mode), and a stale target list is worse than none. Rendering from live state each pass is
also self-healing — it costs nothing and cannot drift.

**Canvas changes while the dialog is open:** the user can click tokens with the dialog up. The
option-change re-render will not fire for that, so either listen to the `targetToken` hook
while the dialog is open (unhook on close) or accept a list that is stale until the next
re-render. **Recommend hooking it** — a target list that ignores the canvas is the same class
of lie as the rejected checkbox, just quieter.

**Why it's good:** zero extra clicks, no new machine, no timer, no elect (`game.user.targets`
is per-user, and the dialog runs on the roller's own client). Display-only and stateless —
same class as `hideCardButtons` — so it needs **no setting at all**. Closing the dialog is
still a cancel, so the veto survives; it just isn't a forced acknowledgment. Weaker against
pure inattention, free instead of costly — the right trade.

**Nice synergy:** the usage dialog is where upcast level is picked, so it is the natural place
to surface "5 darts → Osric" for item 6.

*Evidence: 02:11:15 Drew — "I'm trying to target Oscar" — Goldthorn hit MORGASH for 8, reverted by hand.*

### DEFERRED — untarget checkboxes (scoped out 2026-08-19)
The user asked for a checkbox per row that untargets on canvas, re-checkable to re-target,
then ruled: *"if unchecking/checking is complicated, even just a little, let's remove that
from scope."* **It is complicated, and the reason is worth keeping:**

⚠ **Every downstream Battleflow machine reads the SNAPSHOT, not live targets** —
`message.getFlag("dnd5e", "targets")` at [hold.js:448](scripts/hold.js:448),
[saves.js:94](scripts/saves.js:94), [mastery.js:183](scripts/mastery.js:183),
[shared.js:22](scripts/shared.js:22), [cast.js:72](scripts/cast.js:72). Only the
`requireTarget` veto and [hit-riders.js:175](scripts/hit-riders.js:175) read
`game.user.targets` live. **So if dnd5e stamps that flag BEFORE the dialog resolves, a
checkbox would change the canvas and NOT the roll** — the hold, the saves and the riders would
all still fire on the unchecked target. That is a control that looks authoritative and lies,
which is the exact failure this codebase already names as the worst possible outcome.

**The un-defer condition:** probe question 2 comes back "the flag is stamped AFTER the dialog
resolves." Then the checkbox is honest and cheap — `token.setTarget(checked, { releaseOthers:
false })` — and can be built as its own small item. Until that is *measured*, not assumed, it
stays out.

⚠ It would also have been the first **state-mutating** thing in this dialog, which breaks the
"display-only ⇒ no setting needed" argument above. If it ever returns, the setting question
returns with it.

## 3. Player-rolled damage popup — 🔵 STANDS *(direct player request)*
Player misses rolling their own damage dice. Wants a "Roll Damage" button with a 15s timer
that rolls anyway if missed.

**Seam:** [auto-damage.js:34](scripts/auto-damage.js:34) —
`setTimeout(() => rollDamageForAttack(subject, attackMessage), beat)`. The popup replaces that
timeout. `dnd5e.rollAttackV2` runs on whichever client rolled the attack, so the popup lands on
**the attacker's own client** — no elect, no `canAnswerFor`, no cross-client anything. That is
why it is cheap.

**Template:** mastery.js's reminder popup (one control, drain bar, deadline gating stale renders).

**Key property:** the button and the buzzer call the **same** `rollDamageForAttack()`
([auto-damage.js:44](scripts/auto-damage.js:44)), so crit, ammo, attack mode and
`originatingMessage` are byte-identical either way. Auto-apply, riders and receipts cannot tell
who pressed it. That is what stops it forking the machine.

**One popup per ATTACK, not per target** (one damage roll serves every target it hit — HANDOFF
standing item 1).

**Four decisions still open:**
1. **Default.** The `centerRollDialogs` comment warns that a per-client setting nobody knows to
   look for means every new login starts wrong. **Recommend default OFF + a player-patch-notes line.**
2. **Dramatic Beat** (3s at the table) — the popup IS the pause; it should *absorb* the beat,
   not stack behind it.
3. **Bare button vs the full damage-config dialog.** **Recommend the bare button** — the config
   dialog re-opens the manual second path `hideCardButtons` exists to close.
4. ⚠ **DESIGN TENSION, record as deliberate.** This re-introduces a per-client setting of
   exactly the shape v1.9.5 DELETED. `saveAutoRoll` was "the POPUP is the default, the opt-out
   is silent auto-roll", killed under *"max options later, one switch now"*. This is that
   mirrored. **design.md's Per-client section must carry the amendment** so it doesn't read as drift.

**Corner to check:** the hold path returns early at
[auto-damage.js:31](scripts/auto-damage.js:31), so no popup fires while a Shield hold is open
(correct). But the continuing client rolls damage on hold **resolution** — decide whether that
path offers the popup too.

*Timer 15s matches the family (hold / save / conc all 15s; 0 = wait indefinitely).*

## 4. Potions default to the drinker — ✅ BUILT + VERIFIED 2026-08-19 (re-shaped)

**RE-SHAPED AND BUILT, and it is NOT the item that was folded.** The v1.16.0 walk answered the
folded item's open question — a potion DOES raise a dialog, so the reversal trigger never
fired and the original "self-aim" item stayed dead. The user then asked for something else:

> *"1 - if no target, then auto target self. 2 - if target exists, then use that."*
> *"if a person has nothing targeted to drink a potion, it should be easy, like second wind.
> but potions can be applied to others, so they need the option to do that."*

⚠ **A DEFAULT, NOT A FORCE — that distinction is the whole design.** v1.11.0's `affects: self`
self-aim DISCARDS the snapshot, which is right for Second Wind (no other sensible target) and
wrong for a potion (handing one to a downed ally is a real table move). Filling only the EMPTY
case retires the *"self-aim UNLESS the target is friendly"* carve-out the old shape needed — no
friendliness is inferred anywhere.

⚠ **It does NOT fix either recorded sighting, and was never meant to.** Both had a target set
(the chest at 02:41:58, Cadoc at 03:23:17), so rule 2 fires and the potion still goes where it
was aimed. **The target block (item 2) is what catches those** — you now see `Chest · neutral`
before confirming. The two items cover different halves.

**MEASURED before building** (`tools/probe-potion-aim.mjs`), both facts load-bearing:
- Healing potions carry **`affects.type: "creature"`, activity type `heal`** — NOT `self`, NOT
  blank. So the module was never wrong to leave them alone, the "blank affects must not guess"
  rule is not in play, and filling an empty aim is a default INSIDE what the data allows.
  ⚠ The content is inconsistent across the party: Selma's Elixir of Health, Antitoxin and
  Potion of Resistance DO carry `affects: self` and already self-aim. Tagging the rest `self`
  was rejected as the fix precisely because `self` forces.
- **`messageFlags` snapshots targets BEFORE `dnd5e.preUseActivity` fires** (dnd5e 5.3.3
  `Activity#use`). A three-case control proved it: target set before `use()` → stamped; target
  set inside the hook → empty. So the canvas cannot be the seam; `messageConfig` is passed in
  mutable and IS the seam.

**WHAT SHIPPED** — one hook in [polish.js](scripts/polish.js), beside the `requireTarget` veto
that uses the same event. Both sides are written on purpose: the SNAPSHOT is what every
downstream machine reads (hold, saves, mastery, shared, cast), the LIVE TARGET is what the
dialog's target block paints — so the table SEES the default before confirming instead of
learning where it went from the receipt (user call: *"at least in this scenario they may catch
a mis target when drinking"*).

**The gate is structural, NO NAME LIST:** `consumable` + `heal` + `affects: creature` + no
template. That separates a drinkable potion from **Oil**, which is also subtype `potion` but is
`save`/`creature` plus `damage`/`space`-with-template because you THROW it.

**NO SETTING**, deliberately — the same reason v1.11.0's self-aim has none, and the application
it feeds is already gated by `castApply`.

**Verified 5/5** (`tools/probe-potion-selfaim.mjs`): potion with no target fills both sides ·
potion with someone else targeted is untouched · oil-save stays out · oil-area stays out · the
same `heal`/`creature` shape on a SPELL stays out. Battery green alongside it.

⚠ **Two probe traps, both cost a run — do not re-derive:** a template-bearing activity's
`use()` **never resolves** (parked waiting for a human to place the template) and hung a probe
past its watchdog — race every use, never await one unbounded. And Party Camp's two Practice
Dummy tokens **share one actor**, so `getTargetDescriptors` keys them to one uuid and any
"did the other target survive" assertion is unanswerable until a distinct bystander exists.

### The original folded shape, kept as history


**Dropped from the build order as its own step** — the user's call: *"remove 5, we'll handle
it with target decoration."* The roll-dialog decoration (item 2) is expected to catch the
mis-target before it lands, making a dedicated self-aim machine unnecessary.

⚠ **THE CONDITION THIS DECISION RESTS ON — the audit argued the opposite, and it is now a
PROBE QUESTION, not a settled point:** *"WHY IT SURVIVES ITEM 2: drinking the Draught rolls
nothing, so there's no dialog to decorate. This is the only thing that catches that case."*
Decoration can only work if using a potion raises **some** dialog. **If the probe finds that a
potion use raises no dialog at all, item 2 cannot catch it and THIS ITEM COMES BACK** — the
full shape below is kept for exactly that reason. Do not delete it.

A drunk potion must ignore the target snapshot and apply to the drinker. Same shape as
v1.11.0's SELF self-aim, triggered structurally off the item being a consumable the actor
drinks. **NO NAME LIST** — keeps faith with the cast slice's structural gate.

**Evidence (2 sightings):**
- `02:41:58` — Morgash drinks the Draught of Wholeness → *"you just healed the chest actually… make sure you target yourself"*
- `03:23:17` — Morgash drinks a Greater Healing Potion with Cadoc targeted → *"Cadoc, and he appreciates it… it's fine, I didn't apply it"*

⚠ **RECONCILED: do the content check before writing any code.** There is zero consumable
handling in `scripts/`; self-aim keys purely on `affects.type === "self"`
([polish.js:45](scripts/polish.js:45)). So:
- **Potions DON'T carry `affects.type: self`** → content fix + sweep other consumables
  (design.md: *"the fix for an ability that misbehaves is almost always CONTENT"*). **No module change.**
- **They DO and it still healed the chest** → real self-aim bug, probe it.

**Corner to decide (only if code is needed):** administering a potion to a **downed ally** is a
legitimate table move and a blanket self-aim breaks it. Cheapest carve-out that still fixes both
sightings: **self-aim UNLESS the target is a friendly creature.** A chest and an enemy both fall
through to self; an unconscious ally still receives it.

**The reversal trigger:** drinking the Draught rolls nothing. If the probe confirms a potion
use raises **no dialog of any class** — not a roll dialog, not a usage/consumption dialog —
then item 2 structurally cannot see it, and this item is un-folded and returns to the build
order. That is the single fact that decides it.

## 5. Shield Master bash → Topple-style fold — 🔵 STANDS *(verified genuinely unbuilt)*
4 uses (01:19, 01:51, 02:51, 02:59). Full ~1,100-char feat description posted every time, save
rolled every time, and on **both** failures (Skeleton save 2 vs DC 14; Osric 5) nothing pressed
Prone. No verdict card even on the passes, so the demand visually never resolves.

⚠ **Verified: `grep -ri "shield master" scripts/` returns ZERO hits.** Genuinely unhandled —
same fix class as the ledgered Topple gap but a different, unhandled feature. Route it through
the Topple-style demand + verdict + condition press.

**Also add while in there** (from gm-notes.md): it offered itself against a creature that was
already dead, and Topple prompted an already-prone target. **Redundancy gates.**

## 6. Multi-projectile fold — 🔵 STANDS
**BUILD MAGIC MISSILE FIRST.** It rides the already-instrumented `spellDamage` claim path
(v1.6.0, standing item 2 — that machinery exists because Magic Missile IS the negate hold's
seam), and it has no attack rolls. Scorching Ray then inherits the volley card, the row model
and the count-read, and only adds the genuinely new engineering.

**Upcasting is FREE — the system already computes it.** The session's own cards prove it:
`Scorching Ray: "Total Rays: 3"` · `Magic Missile: "Level 1 darts: 3"`, and at 3rd level
`"Level 3 darts: 5"` with target line `"5 creatures"`. The fold **READS N at use time** from
the scaled activity — the same trick the save machine uses to let upcast scaling ride the
native plumbing (standing item 16). **Never do the arithmetic.**

**STEP 0 — PROBE.** Which 5.3.3 field yields that count is **UNKNOWN**. This repo has been
burned repeatedly guessing system internals (`results.templates` being arrays;
`_stats.createdTime` reading null; `object.shape` not existing at create time). One read-only
probe against both activities: where the count lives, how it scales, whether Scorching Ray's
rays are one activity or N. Structural detection is *"activity whose scaling multiplies
PROJECTILES rather than dice"*; a settings list of identifiers is the **LAST resort, not the plan.**

**The two spells genuinely differ — pin this in a suite assert, it silently regresses:**
- **MAGIC MISSILE** — darts strike **simultaneously** ⇒ aggregate damage per target ⇒ **ONE**
  application ⇒ **ONE** concentration check against the total.
- **SCORCHING RAY** — *"make a ranged spell attack for each ray"*, resolved independently,
  nothing says simultaneous ⇒ each hitting ray is its own damage instance ⇒ **PER-RAY** checks
  are correct there.

*MM evidence:* the skeletal mage's volley used the activity 3 times, so Thomas rolled **two**
concentration checks for one volley at 01:35 — two chances to drop Bane where he owed one.
Meanwhile Gren hand-lumped `1d4 + 1 + 4d4 + 4` in one roll, which was **CORRECT** (one
application, one check) — he was manually doing what the fold should do. Also: dart-3's damage
posted before dart-2's verdict, so **ordering needs sequencing regardless**.

*SR evidence:* 3 full re-casts, 3 Consume Resource prompts for one casting, 9 messages. Player
on mic: *"with the automation it doesn't give me an option to attack again."*

**SR's hard part:** each ray is an attack message that trips the Phase 1a hook at
[auto-damage.js:13](scripts/auto-damage.js:13), so the volley must **CLAIM** the rays (same
pattern as `spellDamage`) to suppress per-ray auto-damage, then drive rolls itself. Two things
to decide: whether a Shield hold on ray 2 pauses the **whole volley or just that ray** (per-ray
is correct but means N hold windows), and whether hit riders fold per-ray — standing item 1's
all-targets-or-nothing rule was written for ONE damage roll serving many targets, and **rays
invert that**.

**Row model to reuse:** saves.js's demand-card per-target rows (`targets: [{uuid, name, done}]`).

## 7. Silent success verdicts — 🟡 HALF SHIPPED
A design conversation, not a bug — HANDOFF standing item 15 records "NO verdict announcement
cards" as deliberate. Session 4 priced it.

✅ **The topple half SHIPPED at v1.15.0** (finding ⑤): a successful topple save now posts
`"<name> stays standing"` ([mastery.js:573](scripts/mastery.js:573)), and the binding design
language is already recorded — **"a table moment opened in public is closed in public."**

✅ **The worst case cited by the audit is FIXED** — the 01:15:02–01:15:32 double-demand on Edda
(concentration DC 10 + Topple DC 14 from one hit; a 19 claimed by concentration, a 13 arriving
24s later attributable to nothing) is v1.15.0 finding ④.

🔵 **What REMAINS: the saves machine.** It folds verdicts into the demand card's rows rather
than announcing, so an open demand is still indistinguishable from a stalled one on scrollback.
Silent successes still stand for: **Command, Faerie Fire, Entangle, Shatter, Necrofire Reach**
(and Shield Master passes, once item 5 exists).
**Proposal:** always post the verdict line, pass or fail — `"Osric holds — 19 vs DC 14"`.

## 8. Cleave arm-button — 🔵 STANDS *(twin-card half already covered)*
Fired once all session, but the shape is agreed, so it is cheap to close.

**The trap:** the reminder card says *"its damage takes no ability modifier. Roll it from the
sheet"* — and **the sheet has no modifier-less mode**. The follow-up rolled `1d12 + 4`, WITH
the modifier the card just said to omit. Worse, with Auto-Roll Damage on `all` the machine
beats the player to it: they roll the Cleave attack (correct — the ATTACK keeps all modifiers,
only DAMAGE drops the ability mod), the resolver sees a hit and auto-rolls `1d12+4` and
auto-applies **before any dialog exists** where a situational −4 could go. So better card copy
documents a step the player never gets to take.

**REJECTED:** silent detection ("same attacker, same weapon, different target, same turn,
reminder latched" → strip `@mod`). It is a guess, and the milestone level-up to 5 gives Morgash
and Thomas **Extra Attack**, where "second swing, same weapon, different target" describes an
ordinary turn. **Violates the 1.9 fence.**

**ADOPTED SHAPE:** the reminder card (which already exists and already latches once per turn)
grows **ONE button** — effectively *"my next attack is the Cleave"*. Pressing it arms a one-shot
flag (attacker uuid + weapon + turn); the next matching attack's damage roll has its flat
ability-modifier part removed at `dnd5e.preRollDamageV2` — the same seam hit riders already use,
**subtracting a part instead of injecting one** — and the flag disarms after one use or at turn
end. Nothing guessed: the player declares, the machine does the one thing the sheet can't.
Never pressed ⇒ today's behaviour exactly.

⚠ **RAW CORNER:** the modifier is dropped **UNLESS IT IS NEGATIVE.** Skip the strip when the mod
is below zero. Small, but reads as a bug if missed.

✅ The doubled Cleave reminder cards (477ms apart) are **already covered** by v1.15.0's
`sourceMessageId` supersede — nothing Cleave-specific needed.

**HONEST NULL OPTION:** at once-per-session frequency, *"the GM trims the damage by −mod"* is a
defensible ruling — **but then the CARD COPY must say that**, because the current text instructs
a move the sheet cannot make.

---

# PHASE 2

## 9. Guidance (choice-bearing effects) — 🔵 STANDS
Applied 1d4 to **every** ability check type instead of prompting for one skill. On mic at
00:52: *"I gave guidance on every ability… it did it for every single ability instead of just
omnibus."* Surfaced when a Performance check produced a d4.

**Two knock-ons:**
- The cantrip's concentration rode an **hour** into the Osric fight; two DC 10 checks resolved
  "rolled by the timer" mid-conversation (02:03:54, 02:04:36). ⚠ **Reconciled:** the general
  duration-expiry work that was expected to absorb this half **did NOT land** — see item 12.
- At 02:42 Tom talked himself **out** of casting it: *"can I give myself guidance… I'm not
  gonna do that."* The mess made the spell avoidable.

Same family as Careful Spell: **a choice-bearing effect applied without asking the choice.**

## 10. Light cantrip applies light — 🔵 STANDS
Cast on Thomas's shield, attached no token light. Gren recast it three times
(00:27:35–00:29:00); Matthew hand-toggled a torch instead (*"i'm just gonna turn his torch
on"*). Two players also reported darkvision not active at scene start. Light-family spells
should attach/remove token light on the target.

## 12. Short-duration effect expiry — 🔵 NEW, promoted by the reconciliation
⚠ **Not in the original audit's own list** — it was listed under "another session owns this",
and that work **did not land**.

Mastery chips are created with `{ rounds: 1 }` in combat / `{ seconds: 6 }` out of it
([mastery.js:235](scripts/mastery.js:235)), and hold extends the duration of an existing
same-origin effect ([hold.js:644](scripts/hold.js:644)) — but **nothing in the module sweeps an
expired one.** Expiry depends entirely on the combat round advancing natively.

⚠ **This overlaps Phase 4 (turn-time truth) directly** — do not build it before Phase 4's
experiment rules on whether the module should own turn-time at all. If native duration handling
carries the weight, this item dissolves; if it doesn't, this is the concrete cost.

## 13. Temp HP renders as "−0 HP" in damage red — ✅ FIXED + VERIFIED 2026-08-19
⚠ **Not from the session-4 audit — reported by the user during the FLOW planning pass.** This
is a **defect**, not polish: the card actively misreports what happened. It sits on this list
because this list is what's on deck, but treat it as a bug.

**Symptom.** Morgash uses his Dash, which grants temporary HP. The receipt card shows
**`−0 HP` in damage maroon** instead of the temp HP granted.

**Root cause — located, high confidence.** [receipts.js:126](scripts/receipts.js:126):
```js
const healed = taken < 0;
amount.textContent = healed ? `+${-taken} HP` : `−${taken} HP`;
```
The card knows exactly **two** kinds — damage and healing — and separates them by the sign of
`taken`. Healing works because `calculateDamage` inverts healing types into a negative take.
**Temp HP is a third kind and produces a take of `0`.** `0 < 0` is false, so it falls through
to the damage branch and prints `−0 HP` in maroon. ⚠ If the value is negative zero, `-0 < 0`
is **also false** in JS — same branch, same output, and that is the likelier exact source of
the reported string.

**Why the pooled number can't fix it.** [receipts.js:106](scripts/receipts.js:106)–108 sums
`delta.value + delta.temp` into one figure. Temp HP moves `hp.temp` and leaves `hp.value`
alone, so the *pool* story and the *temp* story need to be told separately — the fix is a
third branch reading `delta.temp` directly ([auto-apply.js:113](scripts/auto-apply.js:113)
already computes it), **not** a tweak to the sign test.

✅ **SEVERITY SETTLED BY MEASUREMENT, not inference — it was only ever the card.** Probed
against dnd5e 5.3.3 in the sandbox (`tools/probe-temp-hp-card.mjs`, NEW):
`calculateDamage([{type:'temphp', value:7}])` returns **`{amount: 0, temp: 7}`** — confirming
`amount` is 0 — and `applyDamage` moved the actor's `hp.temp` **0 → 7**. The grant always
landed. Morgash had his temp HP the whole time; the receipt just described it as damage.

✅ **THE FIX, verified through the real render path** — four receipt rows rendered and read
back out of the DOM:

| Case | Renders | Colour |
| --- | --- | --- |
| pure temp grant | `+7 temp HP` | blue |
| plain damage | `−3 HP` | maroon |
| mixed (damage + temp) | `−3 HP · +4 temp` | maroon + blue |
| healing | `+5 HP` | blue |

⚠ **`−0 HP` has bitten before, from a DIFFERENT cause** — the comment at
[receipts.js:100](scripts/receipts.js:100) records a target already at 0 HP clamping every
delta to `−0` (the vulnerable Ice Mephit, 2026-08-15). **Two paths now produce the same bad
string.** Fixing one will not fix the other, and a suite assert that only pins one will pass
while the other regresses.

## 14. The DM was getting the players' hold popups — ✅ FIXED + VERIFIED 2026-08-19
User: *"As a DM, I shouldn't see Gren's shield popup. DM doesn't want to be spammed with
player popups. DM can just see the card timer tick. This was a requirement and it worked
before, but now broken."*

**It was a real gap, and it was never in the hold machine at all.** The rule is the save
machine's — **the GM's UNSOLICITED popups are non-player-owned targets only** (v1.12.0
finding ④, *"as a GM i dont care to see other player saves"*). `gmQuiet` has lived in
[saves.js:1164](scripts/saves.js:1164) and [mastery.js:945](scripts/mastery.js:945) ever
since. **The hold was the one machine that never got it** — `showHoldPopup` gated on
`canAnswerFor` alone.

⚠ **WHY IT LOOKED LIKE A REGRESSION WHEN NOTHING REGRESSED.** `canAnswerFor`
([hold.js:494](scripts/hold.js:494)) returns false on the GM client whenever an active
player owner exists — so for as long as the players were logged in, the DM correctly saw
nothing and the requirement looked satisfied. It deliberately **falls back to the GM when the
owner is OFFLINE**, which is precisely the case a DM hits when testing alone. `hold.js` has
not changed since v1.15.0 (git-verified); what changed was who was connected.

**The fix:** `showHoldPopup` takes `{ manual }` and skips the auto-popup when
`game.user.isGM && actor.hasPlayerOwner`. The card's **Answer** button passes `manual: true`,
so a deliberate click can always summon the question — the same escape hatch saves and mastery
keep in their Roll buttons. A player-owned target with an absent owner now rides the hold
timer, which is right twice over: expiry is a PASS, and an absent player was never going to
spend a reaction. NPCs and unowned creatures keep their popups — the monster side is the GM's.

**Verified** by `tools/probe-gm-hold-quiet.mjs` (NEW) against exactly the offline-owner case
(`grenHasPlayerOwner: true`, `activeNonGMOwner: false`): the hold still stamps `pending`; the
DM gets **zero** popups; the card still renders its row *"Reaction — held · Shield · Gren ·
waiting on Tom"* **with the 15s drain bar** (`data-bf-deadline` present); and clicking Answer
still opens it. `smoke-hold` ALL PASS with the change in.

---

# PHASE 3

## 11. AC5e adoption — the Phase 5 tripwire — 🔵 STANDS ⚠ ORDERING CONFLICT
design.md Phase 5 already names **Automated Conditions 5e** as the adopt-don't-build candidate,
with the trigger written down: *"decision deferred to dogfood: adopt when the table starts
noticing missing condition math."*

⚠ **SESSION 4 IS THAT TRIPWIRE FIRING** — condition math was the most-asked question of the
night.

✅ **THE "CONFLICT" WITH PHASE 4 IS DISSOLVED, NOT DECIDED (2026-08-19).** It was framed as a
fight over one deck slot; it is not one, because **the two need different resources**:
- **Phase 4 needs THE TABLE** — a real combat, ten rounds of Bless, the user watching. It
  rides along with the next actual play session and costs no bench time.
- **Phase 5 / AC5e needs THE BENCH** — install into the local sandbox, watch what it decorates,
  decide. It needs no table time at all, which is exactly what the sandbox exists for.

Neither blocks the other. **Recommended: evaluate AC5e at the bench** (higher value, no table
cost), and let Phase 4's Bless observation happen during the next real session.

**Boundary is complementary** (RESEARCH.md): AC5e **decorates rolls** (conditions/range/cover →
adv/dis/auto-crit) and never applies damage or effects; Battleflow **applies** and never
decorates. **The 1.9 fence holds** — nothing in Battleflow touches a d20, AC5e does. MIT, zero
deps, verified against exactly Foundry 14.365 + dnd5e 5.3.3.

**What it covers:** prone-within-5ft (free), Faerie Fire, Vex chips (Battleflow's own chips
would carry the AC5e advantage flag in their effect data — small clean seam), Guiding Bolt
(⚠ **VERIFY the consumed-on-next-attack expiry during eval** — that was always the harder
half), and Sunlight Sensitivity.

**THE SUNLIGHT CASCADE, 02:03:38–02:07:01 — why this matters beyond convenience:** Osric
attacked Gren while standing in Driftglobe daylight. Sunlight Sensitivity was forgotten, so the
module resolved a clean 20-to-hit, **the Shield hold CORRECTLY declined to offer on those
numbers**, and 16 damage auto-applied. Two minutes later the GM remembered, re-adjudicated as
disadvantage, retro-offered Shield and reverted 16 HP. **A wrong INPUT silently poisoned an
otherwise-correct hold decision.**

**Advantage-claiming was the most-asked question of the night.** The Vex chip literally says
*"Claim it in the roll dialog — nothing applies it for you."* Players either asked before every
roll or rolled flat and lost owed advantage (Gren's first Fire Bolt was redone at 00:42:36).
Matthew on mic: *"you still have to remember to give yourself advantage for now."*

---

# DELIBERATELY REMOVED — DO NOT RE-RAISE

- **Hollowing / Life Drain automation** (13 hand-composed max-HP cards, the biggest GM-action
  count of the night) — user call: one-off mechanic for that adventure, not recurring. Dropped.
  ⚠ Related: **Thomas A. Invictus at 16/36 HP is GAMEPLAY**, resolving via plot — do not "fix" it.
- **Hunter's Mark lifecycle** — investigated, mostly **USER ERROR**. Drew's model evolved live
  ("use it all the time" → "four per day" → "five a day"); the actual 2024 rule is 2 free casts
  at ranger 1–4 plus slots, and **the machine tracked it correctly**. He also called the
  concentration swap himself before casting Entangle. Residues are world-content, not module:
  Jetten's ranger slots read 3/3 despite being out at the table; a duplicate/renamed item
  (`Hunter's Mark - Favored Enemy` vs `Hunter's Mark`); and Move Mark discoverability, which is
  a player-patch-notes line.
- **Friendly-fire confirm on attacks** — Jetten hitting Morgash was a stale target the module
  cannot read intent on. A confirm would fight every legitimate AoE and cost a click on every
  roll to save one mistake a night. **Superseded by item 2.**
- **Minor prompts** (Smite-before-bonus-action nudge; Careful Spell respected by save rows) —
  removed by user call.
- **Not-Battleflow infra** (scene desync fixed by browser reload, combat carousel position, wand
  charge tracking, the Graveheart rolling initiative) — removed. Only the Light cantrip was
  kept, promoted into Phase 2 as item 10.
- **World content / player education track** — removed by user call. Items still live in
  gm-notes.md if wanted: potion self-aim tagging, Hunter's Mark slot desync, Wand of the War
  Mage +1 not applying its bonus, patch-notes lines.

---

# SEAMS — all verified against the v1.15.0 tree

| Seam | What it is |
| --- | --- |
| [auto-damage.js:13](scripts/auto-damage.js:13) | `dnd5e.rollAttackV2` — Phase 1a entry |
| [auto-damage.js:31](scripts/auto-damage.js:31) | hold early-return (no popup while held) |
| [auto-damage.js:34](scripts/auto-damage.js:34) | the `setTimeout` the damage popup replaces |
| [auto-damage.js:44](scripts/auto-damage.js:44) | `rollDamageForAttack` — programmatic press pattern (`configure:false`, stamped `originatingMessage`) |
| [polish.js:20](scripts/polish.js:20) | `dnd5e.preUseActivity` — requireTarget veto |
| [polish.js:45](scripts/polish.js:45) | `affects.type` read — the self-aim gate (item 4) |
| [polish.js:169](scripts/polish.js:169) | `renderRollConfigurationDialog` — the dialog decoration seam (`centerRollDialogs` lives here) |
| [ui.js:32](scripts/ui.js:32) | `openManagedPopup` — shared popup lifecycle |
| [mastery.js](scripts/mastery.js) | reminder popup = template for one-control popup + drain bar + deadline gating |
| [mastery.js:235](scripts/mastery.js:235) | mastery chip durations — `{rounds:1}` / `{seconds:6}` (item 12) |
| [hold.js:32](scripts/hold.js:32) | reaction-list parse — **unknown kinds default to `ac`** |
| [hold.js:304](scripts/hold.js:304) | `stampHoldIfInterrupted` iterates **hits** — why Riposte can't fire |
| [saves.js](scripts/saves.js) | per-target demand row model |
| `dnd5e.preRollDamageV2` | the damage-part seam (hit riders inject here; Cleave would subtract here) |

# STANDING RULES THAT CONSTRAIN ALL OF THIS

- **The 1.9 fence:** nothing in Battleflow ever modifies a d20. That is AC5e's job (Phase 3).
- **Structural gates, never name lists.** design.md: *"the fix for an ability that misbehaves is
  almost always CONTENT, not teaching the module its name."*
- **Popups decide, cards watch, cards are public.**
- **Timers:** 15s across the family; 0 = wait indefinitely.
- **Probe before designing against system internals. Always.**
- **Settings philosophy since v1.9.5:** *"max options later, one switch now."* Any new client
  setting is a deliberate reversal and must be recorded as one.

---

# BUILD ORDER — rebuilt 2026-08-19

Shipped items dropped; the free setting fix promoted to the top.

| # | Item | Why here |
| --- | --- | --- |
| ~~0~~ | ~~**Strike `Riposte:ac`**~~ (item 1) | ✅ **SHIPPED v1.16.0** — struck from the world setting, the verify-settings reference and the HANDOFF table together. Verified absent on PROD too (verify-settings CLEAN). |
| ~~1~~ | ~~**Target decoration**~~ (item 2) | ✅ **SHIPPED v1.16.0** — both dialog classes hooked, then **TABLE-verified clean in the v1.16.0 walk**. The potion-dialog question is ANSWERED: a consumable raises a dialog. |
| ~~13~~ | ~~**Temp HP card**~~ (item 13) | ✅ **SHIPPED v1.16.0** — display fix, table-verified in the walk. |
| ~~14~~ | ~~**DM stops getting player hold popups**~~ (item 14) | ✅ **SHIPPED v1.16.0** — `gmQuiet` finally reaches the hold; table-verified in the walk. |
| ~~4~~ | ~~**Potions default to the drinker**~~ (item 4) | ✅ **SHIPPED v1.17.0** — re-shaped from the folded self-aim item at the user's ask; built, 5/5 verified, battery green, table-tested, released and deployed. |
| **2** | **Cleave arm-button** (item 8) | ⚠ **NEXT UP.** Small, shape fully agreed, twin-card half already shipped in v1.15.0. |
| **3** | **Player-rolled damage popup** (item 3) | Self-contained, player asked for it. Carries the design.md amendment. |
| **4** | **Post-roll folds** — Precision, then Riposte (item 1) | The headline, biggest build. |
| **5** | **Magic Missile volley fold** (item 6) | Rides the existing `spellDamage` claim path. |
| **6** | **Shield Master fold + saves success verdicts** (items 5 + 7 remainder) | Same fix class; item 5 is verified unbuilt. |
| **7** | **Scorching Ray volley** (item 6) | Inherits everything from #5. |

**Not in this order — they need a decision first:**
- **Item 11 (AC5e)** — conflicts with Phase 4's deck slot. User ruling needed on which is next.
- **Item 12 (short-duration expiry)** — gated on Phase 4's verdict; may dissolve entirely.
- **Items 9, 10 (Guidance, Light)** — Phase 2, unscheduled.
- ~~**Item 4 (potions self-aim)**~~ — **CLOSED 2026-08-19.** The walk found a potion DOES raise
  a dialog, so the folded item never un-folded; it was then RE-SHAPED at the user's ask and
  BUILT (see item 4 above). Nothing here is pending.
- ~~**Untarget checkboxes**~~ — **CLOSED 2026-08-19, and now MEASURED rather than assumed.** The
  return condition was "`flags.dnd5e.targets` stamped AFTER the dialog resolves". It is stamped
  **BEFORE**: `messageFlags` builds it at the top of `Activity#use`, ahead of both
  `preUseActivity` and the dialog's creation (dnd5e 5.3.3). A dialog checkbox would therefore
  change the canvas and NOT the roll — exactly the "control that looks authoritative and lies"
  the scope-out feared. **It stays scoped out permanently.**
