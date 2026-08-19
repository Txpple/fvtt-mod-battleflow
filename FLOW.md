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

⚠ **Do this first, it is free:** remove `Riposte:ac` from the Reaction List setting. Per the
reconciliation it can never fire correctly — wrong trigger (hits, not misses) and wrong kind
(AC bonus, not an attack). Leaving it there means the machine offers a nonsense hold.

## 2. Targets shown in the use/roll dialog — 🔵 NEXT UP (probe folded in)
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
- Each row: target name + a **disposition icon**, ally vs enemy.
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
- ⚠ **Decide during the build: ABSOLUTE disposition or RELATIVE to the roller?** Absolute
  (the target's own friendly/neutral/hostile) matches the canvas borders exactly and is
  unambiguous to learn — **recommended**. Relative ("ally *of the attacker*") reads better
  when the GM rolls for a monster, where a `friendly` token is that monster's enemy. Absolute
  is the safer default precisely because it never disagrees with what the canvas is showing.
- **It must appear on every use dialog class**, not just attack rolls — attacks, spells, items.

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

## 4. Potions self-aim — 🟠 FOLDED INTO ITEM 2 (user call, 2026-08-19)
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

---

# PHASE 3

## 11. AC5e adoption — the Phase 5 tripwire — 🔵 STANDS ⚠ ORDERING CONFLICT
design.md Phase 5 already names **Automated Conditions 5e** as the adopt-don't-build candidate,
with the trigger written down: *"decision deferred to dogfood: adopt when the table starts
noticing missing condition math."*

⚠ **SESSION 4 IS THAT TRIPWIRE FIRING** — condition math was the most-asked question of the
night. **This conflicts with the current HANDOFF, which puts Phase 4 on deck and Phase 5
behind it.** The two cannot both be next; the ordering is an open user decision.

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
| **0** | **Strike `Riposte:ac` from the Reaction List** (item 1) | Free, no code. It can never fire correctly and currently offers a nonsense hold. |
| **1** | **Target decoration, probe folded in** (item 2) — Step A probe, then Step B display-only build | ⚠ **NEXT UP.** The probe and the build are one item now (user call). The probe also answers item 4's un-fold question and item 6's count field. Smallest real win, existing seam, no setting, no timer, no elect. |
| **2** | **Cleave arm-button** (item 8) | Small, shape fully agreed, twin-card half already shipped. |
| **3** | **Player-rolled damage popup** (item 3) | Self-contained, player asked for it. Carries the design.md amendment. |
| **4** | **Post-roll folds** — Precision, then Riposte (item 1) | The headline, biggest build. |
| **5** | **Magic Missile volley fold** (item 6) | Rides the existing `spellDamage` claim path. |
| **6** | **Shield Master fold + saves success verdicts** (items 5 + 7 remainder) | Same fix class; item 5 is verified unbuilt. |
| **7** | **Scorching Ray volley** (item 6) | Inherits everything from #5. |

**Not in this order — they need a decision first:**
- **Item 11 (AC5e)** — conflicts with Phase 4's deck slot. User ruling needed on which is next.
- **Item 12 (short-duration expiry)** — gated on Phase 4's verdict; may dissolve entirely.
- **Items 9, 10 (Guidance, Light)** — Phase 2, unscheduled.
- **Item 4 (potions self-aim)** — FOLDED into #1's decoration by user call. ⚠ Returns to the
  order only if the probe finds a potion use raises no dialog to decorate.
- **Untarget checkboxes** — scoped out of #1 by user call. ⚠ Returns only if the probe measures
  `flags.dnd5e.targets` as stamped AFTER the dialog resolves. See item 2's deferred section.
