# HANDOFF.md — picking this up cold

> Current at 2026-08-16, LATE evening — **v1.5.0 built, six-suite battery-proven, and
> released in one AFK stretch**, off four user calls from the same afternoon's live
> dogfooding. Read [design.md](design.md) first — it is binding and wins every
> disagreement. This file is only *where things stand* and *what already bit us*.
> Delete or rewrite it freely; it is a snapshot, not a contract.
>
> **v1.5.0** = the Phase 3 **cast slice pulled ahead** (a no-gate cast applies itself:
> utility-activity effects land on every snapshot target, heal activities roll and land —
> receipts + revert throughout, suppressed cards replaced by a payload-carrying module
> card), the **Topple card folding its own save** (a failure applies Prone itself — the
> first Phase 2 seam pressed in place), **reminder popups** for the automatic masteries and
> Cleave (OK-only, 15s), and **effect-receipt hover tooltips**. All deployed; the GitHub
> release is cut per the release log. **The live settings are fully loaded for Tuesday** —
> the user walked the ladder themselves while testing (castApply ON, concMode PROMPT,
> effect + mastery riders ON, masteryAsk ask) — verify with a read as always.
> **Phase 2 (saves) is next**; the 2.5 machine (mode gate, ask + respondsTo fold, owner
> election, buzzer-that-rolls, native-dialog popup) is still the pattern it generalizes,
> and the topple fold is a working miniature of exactly that fold.

## Where things stand

**Shipped and live** in *The Broken Heart of Greenrest* (Foundry 14.364 + dnd5e 5.3.3,
Molten-hosted). Latest release **v1.5.1** (2026-08-16 night — the second live-testing
round's six fixes: the topple card's own Roll button, +N-in-blue healing receipts,
damage-spell card suppression with the blocklist carve-out, the affects-self gate that
stops the cast slice re-applying Shield, the Dice-So-Nice-aware verdict pause, and — in
**combatplus v1.3.0**, its own repo and release — per-side auto-defeated that works out of
combat). v1.5.0 = the cast slice + topple fold + reminders + tooltips, v1.4.0 =
concentration, v1.3.x = Phase 1.9, all the same day. Deployed, tags pushed, GitHub
releases carry zip + manifest. **The box tracks the GitHub manifest** (repointed
2026-08-15), so the process vends the real version string after a restart.

| Phase | State |
| --- | --- |
| 0 — native settings | **The user's to do**, at the table. Not code. |
| 1 — attack resolver | ✅ shipped. Auto-roll damage on hit, auto-apply via GM elect, receipts + revert. |
| 1.1 — dogfood polish | ✅ shipped. Tray auto-collapse, require-target gate, usage-card suppression, centered roll dialogs. |
| 1.5 — reaction hold | ✅ **feature-complete at v1.1.16** and dogfooded — both triggers exist: an attack hit, and a listed spell. Magic Missile stays in normal dogfood rotation rather than on a list. |
| 1.75 — hit riders | ✅ shipped v1.2.0 and dogfooded. A mark pays out with the attack that earned it. |
| 1.9 — effect + mastery riders | ✅ **shipped v1.3.0** (2026-08-16), suite-verified end to end. Not yet dogfooded — every switch is OFF at the table until the user walks the ladder. |
| 2 — saves | ⬜ NEXT. Generalizes the 2.5 machine per target (design.md Phase 2 note); the topple fold (v1.5.0) already presses its per-target seam in miniature. |
| 2.5 — concentration | ✅ shipped v1.4.0; **live at the table** since 2026-08-16 evening (`concMode: prompt`, user-walked). |
| 3 — effect application | 🟨 **cast slice shipped v1.5.0** (no-gate casts: utility effects + healing, receipts + revert, replacement-card bus); 1.9A covers the attack slice; the save slice waits on Phase 2. |

⚠ **World data changed 2026-08-15:** the Skeletal Mage's `system.attributes.ac.calc` went
`flat` → `natural`. Its `flat: 16` is untouched, so its printed AC is still 16 — but a flat AC
ignores every bonus, which made Shield inert on it. See the flat-AC ground truth; reverting the
field restores the old behaviour, bug included.

**Live settings as left** — verify with a read before trusting this list; the suites restore
whatever they find, so it drifts:

| Setting | Value | |
| --- | --- | --- |
| Auto-Roll Damage on Hit | `all` | `pc` / `npc` isolate one side for testing |
| Auto-Apply Damage | on | active-GM elect, receipts + revert |
| Dramatic Beat | 3s | |
| Suppress Attack Cards | on | cards carrying effects survive anyway |
| Require a Target | on | |
| Reaction Hold | on | governs **both** triggers |
| Spells a Reaction Blocks | `Magic Missile:Shield` | new in v1.1.16 — the second trigger |
| Hold Shows the Math | **on** | default flipped in v1.1.8 — design.md §5 carries the correction |
| Hold Timer | **15s** | 0 waits indefinitely |
| Skip Hopeless Holds | **on** | gated on the reveal, deliberately — see the setting's hint |
| Apply the Reaction's Effect | on | |
| Hold Settle | 8s | |
| Hit Riders | **off** | new in v1.2.0 |
| Rider Table | `hunters-mark, hex, great-old-one-hex` | identifiers only — the damage is read from the content |
| Rider Upgrades | `foe-slayer:hunters-mark` | replaces the die, never stacks |
| Effect Riders | **on** | user-walked ON 2026-08-16 — a hit applies the card's effects |
| Weapon Mastery Riders | **on** | user-walked ON 2026-08-16 — Vex/Sap auto + reminder, the rest ask |
| Mastery: Ask First | `ask` | `auto` is the tedium escape hatch (silences asks, not reminders) |
| Suppress: Weapon / Spell / Feature / Other | **all on** | new in v1.3.0 — inert until the master above them is on; defaults preserve the old boolean's behavior exactly |
| Concentration Checks | **prompt** | user-walked ON during 2026-08-16 evening testing |
| Concentration Timer | 15s | expiry ROLLS (data-driven, straight); 0 waits indefinitely |
| Failure Breaks Concentration | **on** | inert until the mode is on — the forgotten click the phase exists to press |
| Concentration Checks Are Public | **on** | off = whispered to owners + GM; the break card is ALWAYS public |
| Auto-Apply on Cast | **on** | new in v1.5.0 — no-gate casts (utility effects + healing) apply themselves; damage spells deliberately excluded |

## Open items

### To do first (user call, 2026-08-16): the second Molten box

The user is provisioning a **second Molten instance as a dedicated test box**. ⚠ **Molten
allows two servers but only ONE can be active at a time** (user, 2026-08-16) — so this is a
**take-turns box, not a parallel one**: no suite runs on test while the table plays on prod,
and the protocol below must include switching which server is up (activate test → iterate +
battery → deactivate → activate prod → deploy + one prod battery → release). Chosen over a
local mirror deliberately: it keeps real internet latency, which is where this module's bug
class (settle windows, replication races, derived-data beats) actually lives, and the speed
gain of local was measured small (suite time is deliberate waits, not network).

When the box exists, the user supplies its panel values in a new
`../fvtt-mcp-molten5e/.env.test` (same key names as `.env`: server URL, magic URL, WebDAV
URL + credentials, admin key). Then, in one pass:

1. Clone the Greenrest world to it over WebDAV — write the push counterpart to
   `pull-prod-to-local.mjs`. Users are world data, so DM Assistant and PC Assistant arrive
   working, passwords included.
2. Register + enable battleflow there (`register-module.mjs`, `configure-modules.mjs`).
3. Add a target switch to the suites and `deploy-house-module.mjs` — default prod,
   `BF_TARGET=test` reads `.env.test` — so today's workflow changes only on opt-in.
4. Full four-suite battery green on the test box, then record the protocol here:
   **iterate + battery on test → deploy prod → one full battery on prod → release.** The
   prod battery stays forever: live-world DATA is itself coverage (the flat-AC Skeletal
   Mage was a data bug no clean mirror would have caught). Refresh the test world from
   prod periodically so the weird stays represented.

This is the natural first step of Phase 2 — the two-client owner-election harness (PC
Assistant) wants a box it can hammer.

### Standing

1. **Riders, and the one case they deliberately refuse** (v1.2.0). A mark on the target pays out
   with the attack that earned it, injected at `dnd5e.preRollDamageV2`. Detection is one walk:
   the mark's `origin` up to the nearest Actor, keeping the Item passed — *who placed it* and
   *what it deals*, in one pass. **How much is never configured**; it is read from the mark's own
   bonus-damage activity. The curated list is identifiers only and exists solely to exclude
   things wearing the same data shape without being attack riders (Ensnaring Strike's
   "Start of Turn Damage" sits on the target with the caster as origin).
   ⚠ **A split target set drops the rider.** One damage roll serves every target it hit, so the
   rider is folded in only when it is true of ALL of them — a ranger hitting their quarry and an
   unmarked goblin with one attack gets nothing, and a console warning. Over-applying damage is
   the worst failure this module has, so the intersection is the only safe answer; the fix if it
   ever bites is per-target damage rolls, which is a much bigger change than it sounds.
2. **The second trigger, and the two things it deliberately does not solve** (v1.1.16).
   Casting a spell on the **`blockList`** setting (`Spell:Reaction`, default
   `Magic Missile:Shield`) stamps a hold on its own **usage card** at `dnd5e.postUseActivity` —
   same flag shape, same popup, same card, same timer, same three answer channels — carrying
   `trigger: "spell"` and a third kind, **`negate`**. No re-test, no settle window: the answer
   IS the verdict. The block is enforced at **`dnd5e.preApplyDamage`**, the only seam that can
   do anything, because nothing else in the module touches this spell (not an attack ⇒ Phase 1a
   never rolls its damage, Phase 1b never applies it).
   ⚠ **The dice roll anyway.** `DamageActivity._triggerSubsequentActions` rolls damage on use,
   so it is on the table while the hold is open. Harmless *here* and only here: a negate answer
   never depends on the number, so there is nothing to metagame — which is why this trigger does
   not fight to suppress the roll the way the attack path does. Do not copy that reasoning to a
   reaction whose answer depends on the damage.
   ⚠ **Apply-before-answer wins.** A GM who presses Apply while the hold is still `pending`
   beats the verdict and the damage lands. Vetoing pending applications is worse: a hold
   answered Pass would then need a second Apply click nobody would remember to make. The card
   reads "held — waiting on …" the whole time. If this bites in play, the fix is Phase 2/3
   owning non-attack damage application, not a bigger veto.

3. **The hold's UI is settled and shipped** (user calls, 2026-08-15) — recorded because it is
   binding on anything built next: **the popup decides, the card watches, the card is public
   so the table sees the moment.** One card shape (`bfCard`) for everything the module says out
   loud; the card carries no answer controls where popups are on, only an *Answer* button that
   calls a dismissed popup back.
   ⚠ **One decision, two controls, and the same two for everybody.** The hold asks a binary
   question — take the reaction or don't — and the GM's surface must be the *same shape* as the
   player's. A GM-only third button ("Skip") stood on both surfaces until **v1.1.15**: it ran
   the same code as Pass, the whole chain only ever asks `answer === "cast"`, and it appeared
   only where the GM already *is* the decider (an unowned monster) while being denied by
   `canAnswerFor` on the player-owned targets it was designed for. Reported by the user as
   "it seems like it should be a binary choice". The AFK fallback is the **timer**, not a
   button. `smoke-hold` §4d3 and §6 both assert the control set is exactly `Cast/Pass`.
4. **Cards say one thing, once.** The verdict card for a negate hold was two lines until the
   user cut it back: "Magic Missile does nothing to Skeletal Mage" already says the whole thing,
   and a second line restating it mechanically ("its damage is not applied to them") plus a
   note about the other targets answered questions nobody watching had asked. Worth remembering
   when writing the next announcement.
5. **The hold timer is built** (v1.1.8–v1.1.10) — `holdTimer` seconds, 0 = wait indefinitely,
   live at 15s. The continuing client owns the one authoritative clock and re-checks at the
   buzzer; unanswered targets pass and are marked `timedOut`. The bar is built with
   `element.animate()` and positioned from the flag's absolute deadline, so popup and card
   agree exactly (measured drift 0). ⚠ Do not "simplify" it back to a CSS animation — see the
   ground truth below for why that silently desyncs.
6. **Usage-card suppression, settled shape (v1.3.0).** The master boolean gates four
   per-source switches (weapon/spell/feature/other, by `flags.dnd5e.item.type` on the card —
   this world's statblock attacks are **weapon**-type, verified empirically by the suite).
   The carve-out is now conditional: a card carrying effects survives only when the riders
   will NOT handle them — Effect Riders off, or a **concentration cast**
   (`system.concentration`, stamped into the message data before creation, mixin.mjs:248),
   whose origin linkage the suppressed-card fallback cannot rebuild. With riders on, an
   ordinary effect-carrying card is suppressed and the effects land anyway.
7. **Phase 2.5 shipped shape, and its accepted corners** (built 2026-08-16; the 2026-08-15
   visibility request is absorbed — `concVisibility`, public default, break card always
   public). The flow: `dnd5e.damageActor` under the native prompt's exact guard → the elect
   stamps an ASK message → the first active non-GM owner's client rolls (GM elect for NPCs /
   offline / the buzzer) → the roll message answers via `respondsTo` → the elect folds and,
   on failure, `endConcentration` (native cascade). Zero HP = no save, straight break — the
   system does NOT do this natively. The popup carries the NATIVE roll dialog's controls
   (situational bonus + Advantage/Normal/Disadvantage, default hinted from
   `concentration.roll.mode` — user call: a save this important gets the full surface); the
   buzzer and auto mode roll straight and data-driven (War Caster still applies itself).
   Corners, all deliberate:
   - **Legendary resistance arrives too late.** LR flips a save via a message UPDATE after
     the failure landed; the break has already cascaded. Phase 2 owns `forceSuccess`
     aggregation; until then LR on a concentration save means the GM re-applies the
     concentration effect by hand (or runs break-on-failure off).
   - **A sheet-rolled save's card marks success against DC 10**, not the ask's DC
     (`rollConcentration` defaults `target: 10`; the module's own rolls pass the real DC).
     The fold judges by the ask's DC either way, so the verdict is right and only the
     sheet-roll card's green/red can disagree with it. Popup-path rolls always agree.
   - **`options.dnd5e.concentrationCheck === false` is invisible at `damageActor`** (no
     options in the hook signature), so a module opting out of the NATIVE prompt still gets
     ours. No system code sets it; accepted.
   - **A GM hand-lowering HP triggers the check** — onUpdateHP cannot tell a sheet edit
     from damage, and RAW-wise it usually is damage. Asserted as a feature
     (smoke-concentration §13).
8. **Vex/Sap enforcement is deliberately not built** (the 1.9 fence, user call): the chip is
   the reminder, the roll dialog is the enforcement surface, and nothing modifies a d20.
   The chips carry `duration rounds: 1` in combat as an approximation of the RAW windows —
   if the table reports chips outliving their moment, the fix is duration precision, not
   enforcement.
9. **Graze deliberately reads the attack AS ROLLED** — a Shield later flipping a hit to a
   miss does not re-open Graze for that target. Nobody has asked; recorded so the corner is
   a decision rather than a surprise.
10. **The 2026-08-16 architecture review** (v1.3.1) — an independent full-source pass plus
   the primary's, merged. Verdict: the north star is being followed; the Shield/hold area is
   NOT the feared one-off (the v1.1.13–16 hardening centralized every reaction question).
   What it fixed: the `answerHoldsFor` tail window (whole-log now), a `continueHold`
   re-entry race during the settle window (claim-first latch), answered-but-stranded holds
   and asks after a driving-client reload (stateless resume checks in both render hooks),
   answered targets being re-askable, `reactionSpent` clears gated behind the toggle, and
   the dropped-rider warning promoted from console to a whispered card. What it threaded
   for Phase 2: `applyDamagesWithReceipt` takes a `multiplier` (recorded on the entry when
   not 1) so half-on-save extends the applier instead of forking it. What it deliberately
   did NOT do: merge the two table-moment machines (the popup lifecycle is shared via
   `openManagedPopup`; the timers stay twins until Phase 2.5 makes a third), or unify the
   three effect appliers (Phase 3 is the convergence point, growing out of
   `applyEffectRiders` — which also finally gives the reaction effect its missing
   receipt/revert, the one §2.5 gap left standing).
11. **Accepted corner — mixed-ownership answer race.** On a multi-target hold with a
   player-owned and a GM-answered target, the GM's direct flag write and the continuing
   client's response-message fold can clone-modify-write the `hold` flag concurrently;
   Foundry replaces arrays wholesale, so the loser's answer drops and that target simply
   asks again. Milliseconds wide, self-healing, and the fix (forcing ALL answers through
   the response channel) would add a message per GM answer — not worth it until it bites.
12. **The cast slice's bus, and its exclusions (v1.5.0).** The gate is STRUCTURAL, no name
   list (user call: "any spells that have the no-save apply effect"): a used `utility`
   activity carrying effects (Bless; Hunter's Mark's Mark Creature AND Move Mark — a
   re-mark auto-lands on the new quarry) or a `heal` activity, with targets selected. The
   STAMP is the trigger, never the setting: preCreate on the initiating client writes the
   `castApply` payload onto a qualifying usage card — or onto a REPLACEMENT bfCard when the
   1.9D spell switch suppresses the original (the replacement carries targets, activity,
   and the concentration id, which is why a concentration UTILITY cast's card may die where
   the attack-spell carve-out still keeps one) — and `healPending` onto a targeted healing
   roll. The elect executes from createChatMessage AND the render hook (reload-resume), so
   an unstamped message — all of history — is inert by construction. Healing rides
   `applyDamagesWithReceipt` unchanged (`calculateDamage` negates healing-typed entries
   natively; the roll message carries receipt + revert; independent of `autoApply`).
   ⚠ **Bare `damage` activities are deliberately OUT**: Magic Missile is the negate hold's
   seam, and an auto-apply would beat every pending hold's verdict — apply-before-answer
   (standing item 2) would stop being a corner and become the machine. Save activities wait
   for Phase 2; their cards stay load-bearing.
   ⚠ **The activity must AIM at creatures** (v1.5.1): `target.affects.type` present and not
   `self`, resolved off the activity (override-false inherits the item's). A range-self
   spell's snapshot is incidental UI targeting — and **Shield is itself a utility-with-
   effects cast**, so the first battery run with castApply ON caught the cast slice
   stacking a second +5 on the reaction machinery's own application (+10 AC, two chips).
   smoke-hold now pins castApply ON permanently as the coexistence net. Self-buffs stay
   the caster's own tray click.
   ⚠ **Damage-spell cards are suppressible spam since v1.5.1** — except a BLOCKLISTED
   spell's card while the reaction hold is on, which is load-bearing three ways (the
   hold's home, the Answer surface, and the preApplyDamage veto finds the verdict through
   it: damage roll → originatingMessage → card). Eligibility is async and preCreate is
   not, so the keep-gate is the conservative pair (hold on + spell listed), targeted or
   not — at this table Magic Missile keeps its card, which is the price of the Shield
   negate. Re-plumbing the veto to a message-free hold lookup would lift it; offered, not
   built.
13. **The Topple fold (v1.5.0; the Roll button v1.5.1).** Recognizer is the 2.5 shape: the
   save's actor must be a still-pending target, the ability must match, and the roll is
   either chained to the topple card itself (the enricher click — `buildPost` stamps
   `originatingMessage` from the enclosing card, basic-roll.mjs:173) or chained to nothing
   (a bare sheet roll); a save chained to any OTHER message belongs to that chain. Judged
   against the DC stored on the card's flag — the ask's DC, exactly the concentration rule
   — failure presses Prone + announces, success closes quietly, and the GM per-target
   button remains for saves rolled on paper. Pre-v1.5.0 cards carry no `dc` and stay
   button-only. The button-vs-fold write race is the same accepted clone-modify-write
   corner as item 11.
   ⚠ **The card carries its own per-target "Roll save" button** (v1.5.1, decider-gated by
   canAnswerFor, native dialog, chained to the card) because **the native `[[/save]]`
   enricher rolls for whatever token is SELECTED** — which right after an attack is the
   ATTACKER, so the GM rolled Morgash's save at the dummy's topple and the fold rightly
   ignored it (bit live 2026-08-16; the evidence was trash-cleared chat, so it was
   reconstructed from the screenshot's selection ring). The enricher stays for tables
   that select first.
14b. **The verdict pause (v1.5.1).** `dramaticVerdictPause`: the concentration fold and
   the topple failure wait out Dice So Nice's animation (when present) plus the Dramatic
   Beat before their table-facing consequences — the break card, the cascade, the prone.
   The MECHANICS never wait: flags are written and timers disarmed first, so the buzzer
   cannot double-fire into the pause; the ask row's verdict text updating early is the
   accepted residue.
14. **Mastery reminders (v1.5.0).** The elect posts a `masteryNotice` bfCard when Vex or
   Sap lands and when a Cleave-weapon hit lands (once per combat turn per attacker,
   in-memory latch on the elect; out of combat every hit reminds — the test range has no
   turns). The popup rides the card on whichever client `canAnswerFor` picks: ONE control
   (OK), hardcoded 15s auto-dismiss with the drain bar, `deadline` gating stale renders so
   an old log never nags. Not gated by `masteryAsk` — auto silences asks, not reminders.
   Design language recorded in design.md 1.9C: a reminder of a time-limited fact is a
   table moment; what stays banned is a fake choice and results dressed as popups.

## How to work on this

**Deploy** (all scripts in `../fvtt-mcp-molten5e/scripts/`, need its `.env` + built `dist/`):

```bash
node scripts/deploy-house-module.mjs fvtt-mod-battleflow
```

That is a WebDAV hot-deploy: script changes go live on the next **world reload (F5)**, no
bounce, nobody disconnected. `module.json` changes (the version string, new `esmodules`
entries) keep vending old values until the Foundry **process** restarts — expected, not a
failure. **After a deploy, refresh every OTHER connected client with
`node tools/reload-clients.mjs`** (bridge-emitted core "reload" socket event, standing user
instruction 2026-08-15): the auto-apply elect is usually the human GM window, and it runs
whatever code it LOADED — a stale window fails brand-new assertions while everything else
passes. Ask the table first if a live session is running; it yanks players too. A bounce is `register-module.mjs --id … --manifest …`; enabling is
`configure-modules.mjs --enable …`. Never call `game.shutDown()` through the bridge.

**Release** (the house pattern, three commits then a tag on the middle one):
`test:` the harness → `fix:`/`feat:` the code + `module.json` bump *(tag this one)* → `docs:`
the handoff. Release title `vX.Y.Z — short phrase`; assets are `fvtt-mod-battleflow.zip`
**and** a bare `module.json`. Commit bodies in this repo are **ASCII** — the log shows
non-ASCII punctuation getting mangled.

⚠ **Build the zip with the script, never with `Compress-Archive`:**

```bash
powershell -ExecutionPolicy Bypass -File tools/build-release.ps1
```

It writes `dist/fvtt-mod-battleflow.zip` (gitignored) with exactly `scripts/`, `module.json`,
`LICENSE`, `README.md`, and then reads the archive back and **fails** if any entry name contains
a backslash. That check is the whole point. `Compress-Archive` on Windows PowerShell 5.1 writes
`scripts\battleflow.js` with a backslash, which is not what the ZIP spec says and not what
Node-based extractors do with it — they treat it as one literal filename and drop the file at
the archive root, so `esmodules: ["scripts/battleflow.js"]` resolves to nothing and the module
installs as an empty shell. **Every release from v1.1.0 to v1.1.15 shipped that way.** It never
bit because the live box is hot-deployed over WebDAV rather than installed from the zip, but a
clean install from any of those tags would have. v1.1.16 onward is correct; the old assets were
left alone, so re-cut one only if someone ever needs to install it.

**Test** — every suite restores the settings it touches and deletes its own chat messages:

```bash
node tools/smoke-battleflow.mjs
```

```bash
node tools/smoke-hold.mjs
```

```bash
node tools/smoke-riders.mjs
```

```bash
node tools/smoke-effects.mjs
```

```bash
node tools/smoke-concentration.mjs
```

```bash
node tools/smoke-cast.mjs
```

⚠ **Run suites ONE AT A TIME, not chained in a single command.** A four-suite battery run
back-to-back in one shell command produced exactly one polluted assertion (smoke-effects 13e
read a usage-card count delta of **−20** — some twenty messages vanished between its before
and after counts; green in isolation, twice). Mechanism unconfirmed — the shape says a prior
suite's teardown sweep landing late — but the class is harness topology, like the
double-elect below: the fix is protocol, not code.

⚠ **Disconnect the MCP bridge before any suite run** (the `disconnect-bridge` MCP tool; it
reconnects itself on the next tool call). A lingering bridge page and the suite's own login
are the SAME Foundry user, and two pages on one GM user make BOTH clients the
"single-writer" elect — `activeGM.isSelf` is per-user, not per-page. Measured 2026-08-16:
one cast created two identical effect chips (both elects won the create race), one attack
posted two Push cards, and damage applied twice — which drained a freshly healed fixture
to 0 and made the dead-skip eat a payout three assertions away from the cause. At a real
table this cannot happen (the bridge is one page; humans are different users); it is purely
a harness topology, so the fix is protocol, not code. `smoke-effects` §9 asserts the
announcement count so a double-elect now fails loudly at the source.

`tools/smoke-cast.mjs` (new at v1.5.0, 12 assertions) proves the cast slice: **1** the
native-card bus (suppression off — card survives, stamped, both targets chipped,
concentration origin + dependentOn, tooltip description on the receipt), **2** the
replacement bus (suppression on — native card dies, the bfCard carries payload + receipts,
linkage survives), **3** healing (usage card suppressed bare, roll stamped `healPending`,
HP moves by exactly the rolled total with `autoApply` OFF), **4** a bare damage activity is
untouched, **5** a targetless cast is left native. Its fixtures are built-in-suite innate
spells (`consumption.spellSlot: false`) on BF Test Attacker.

`smoke-effects` grew **14** (the topple fold: card carries dc/ability/weapon; a decoy
chained save is ignored; forced failure → Prone + one announcement; forced success closes
quietly; a bare sheet save answers) and **15** (vex/sap/cleave reminders + the receipt
tooltip field). Both force outcomes through the actor's own save bonus (±30).

`tools/probe-topple.mjs` is the fold's isolated one-shot (stamps a minimal topple card,
rolls a chained save, dumps every recognizer gate) — it proved the module correct while the
suite still failed, which re-aimed the hunt at harness topology (the stray-token lesson
below).

`tools/probe-effects.mjs` is the instrumented one-shot that untangled the above — it dumps
receipt/effect/message state around a vex attack, a push, and a double Guiding Bolt cast.
Cheap to re-run; extend it rather than adding printf debugging to a suite.
`tools/probe-missile-hp.mjs` is its sibling for the hold: it replays smoke-hold 6a with a
ledger of every message, damage event and HP write — the tool that proved the stand-in's
mystery damage came from the suite's own stray holds, not the module (below).

`tools/scan-reactions.mjs` regenerates the [REACTIONS.md](REACTIONS.md) survey after content
changes; `tools/scan-riders.mjs` does the same job for damage riders, finding them by the
structural signature (a `damage` activity whose activation is overridden to nothing) rather than
by name — that is where the Phase 1.75 seed list came from.

The user's own test aids (2026-08-16): a **Practice Dummy** actor (1000 HP — big enough
that damage assertions never hit the dead-skip; **walk 30, given legs deliberately** so
Slow and every speed-gated payout has something to bite — at walk 0 the hopeless-skip
silently eats the Slow ask, which is exactly what the live "bow didn't slow" report was)
and a **"Clear Temp Effects (Scene)"** script macro in Matt's hotbar slot 2 (strips every
temporary effect from every token actor on the current canvas, batch-deleted per actor).

Fixtures live in the world and are reused: scene **Battle Flow Test Range**, actors
**BF Test Attacker** (NPC — also the Magic Missile caster in §6, which builds the spell on it
and sweeps it again on the way out), **BF Test Victim** (NPC — wears a mundane shield for the
name-collision test, and hosts the statblock cast-activity fixture), **BF Test Shielder**
(GM-owned clone of Gren) and **BF Test PC Attacker** (character-type). The suites **long rest
every `BF Test` fixture on the way out** — they spend real slots and real HP, and nothing else
puts it back. Fixtures only: live PCs are restored to whatever was found, because resting the
party is the user's call, not the harness's.

`smoke-hold`'s sections, so you can find the one you need: **1–3** hold/cast/pass on Gren,
**4** reaction-spent, **4b/4b2** the real Cast control and one-cast-many-holds on the
GM-owned stand-in, **4c** the effect safety net, **4d** a mundane shield never holds,
**4d2** an NPC paying with x/x uses, **4d3** the statblock cast activity end to end (+ the
control set and the announcement wording), **4d4** at-will, **4d5** a PC attacker,
**4d6** a flat AC, **4e** the timer, **4f** hopeless holds, **5** the crit skip,
**6** Magic Missile — the negate hold, the real block, the Pass control case, and a target who
only *wears* a shield.

`smoke-concentration`'s sections: **1–3** auto mode + the DC math (floor 10, half-damage,
the modern 30 cap, temp-HP triggering), **4** deterministic failure → break + the native
dependent cascade + the public card, **5** prompt mode (the popup, the native-dialog control
set, the click, the situational-bonus/advantage plumbing), **6** the buzzer rolls (straight,
data-driven), **7** two instances queue popups, **8** a sheet roll is the answer, **9** the
native whisper card suppressed/restored, **10** private visibility (and the always-public
break), **11** break-off announces only, **12** the cause through a real attack chain,
**13** a sheet edit is damage too, then zero HP breaks with no save. Outcomes are FORCED —
success by `+30` con save bonus, failure by DC 30 (70 temp-buffered damage) against a mortal
modifier — a suite that can lose a coin flip lies once a week.

⚠ **Find "new" messages by ID-SET DIFFERENCE, never by timestamp.** Message timestamps come
from the server's clock, the suite's `Date.now()` from the client's, and a ~2–3s skew made
every `timestamp >= t0` search read straight past freshly created asks — the machinery all
worked while every flag assertion returned undefined (this suite's first run, 2026-08-16).
Snapshot the ids before the action; diff after. No clock can lie to a set. And **wait for
announcement cards** — they post AFTER the flag flips done, so a same-breath content search
races the fold it just observed.

⚠ **The shielder's stray pending holds detonate under a later cast.** smoke-hold's windowed
search loops leave unanswered pending holds on the stand-in, one real cast answers EVERY
pending hold for its target (whole-log by design since v1.3.1 — asserted as a feature in
4b2), and the strays' continuations then re-test, still hit, and auto-apply real damage
mid-section — the negate case read hpBefore 18/26 twice on 2026-08-16 from exactly this.
`ensureShielder` now deletes stray pending holds as part of its clean slate; the probe
above is how it was cornered.

`smoke-riders` is eight flat assertions; **5** is the load-bearing one (*another creature's mark
pays this attacker nothing*), because a suite that only checks "is there a mark" passes the rest
by luck. It builds its own **linked** tokens deliberately: an unlinked token's synthetic actor
has a different uuid from its base actor, and that distinction is exactly what the ownership
test turns on.

⚠ **HP is a fixture resource, and forgetting to reset it makes a damage assertion lie.** The
stand-in takes real, auto-applied hits in §4b–4c, so it reached §6 at **0 HP** — where "took no
damage" and "took the lot" are the same reading. The negate assertion passed 0 → 0 while
proving nothing; only its Pass counterpart failed (HP clamps at zero) and gave the pair away.
`ensureShielder` now heals to full alongside the slots it already refilled, and both §6
assertions check `hpBefore` against `hp.max` so a regression there fails loudly instead of
passing vacuously. **Generalise this:** an assertion that a number did not move is only worth
anything if the number could have moved.

⚠ **The harness runs as a GM, and the module deliberately refuses to let a GM answer a hold
for a character a logged-in player owns.** So Gren's own Shield *cannot* be driven from the
bridge while a client owning Gren is connected — that is correct behaviour, not a bug. The
real-cast path is tested on **BF Test Shielder**, a GM-owned clone of Gren (a genuine
spellcaster with genuine slots). Do not "fix" this by weakening `canAnswerFor`.

⚠ **Never bound a "did the damage appear?" search to a tail window of the chat log.** These
suites fire dozens of attacks, and a late-resolving stray hold injects announcement messages
that push a real damage card out of a short tail — two assertions flaked that way on
2026-08-15 and cost a bisect. An originating id is unique to one attack, so searching the
whole log cannot produce a false positive.

⚠ **Assert what the table is TOLD, not just what happens.** The verdict and the wording of the
card are computed separately, so a hold can resolve perfectly and still publish nonsense. Both
bugs found on 2026-08-15 (v1.1.13, v1.1.14) were visible *only* in the announcement; every
mechanical assertion passed straight through them.

**combatplus v1.3.0** (2026-08-16, its own repo/release — changed for a Battle Flow
report): auto-defeated split into per-side booleans (NPCs / PCs, both default ON — PCs at
0 get the skull at this table by explicit user call) and the dead overlay no longer needs
a combat. Interplay: Battle Flow's revert restores HP → combatplus itself clears the
overlay on the heal-back, so the old one-way-cleanup contract now has a native echo;
harmless in both orders.

The user **logs in as the player accounts themselves** to dogfood the player side, so an
"active player" in `get-world-info` is often just them in another browser. Logging that
session out hands the hold back to the GM and unblocks the bridge — ask before assuming a
connected player is someone else at the table.

**Topology since 2026-08-16** (user changes, measured by `tools/probe-player-seam.mjs`):

- **DM Assistant is role 4 now** (the standing elevation offer, executed). Measured with
  both role-4 users connected: **the elect is DM Assistant, not Matt** (`activeGM` →
  `getDesignatedUser`, a deterministic user-order pick). Implication: whenever the bridge
  page is up during live play, IT applies damage with whatever code it LOADED — after any
  deploy, bounce the bridge (disconnect-bridge; it reconnects fresh on the next call) or
  its stale code is the table's resolver. Before the elevation Matt outranked it; that
  protection is gone by design.
- **PC Assistant** (role 1, player, **no password**) exists for two-client suite coverage.
  Credentials live in `../fvtt-mcp-molten5e/.env` as `MOLTEN_TEST_USER` /
  `MOLTEN_TEST_PASSWORD`; it OWNS **BF Test PC Attacker**. The proving spike
  (`probe-player-seam.mjs`, read-only, safe mid-session) asserts: it joins and reaches
  ready, it owns the fixture, and the `canAnswerFor` seam flips on the GM side the moment
  it connects — the plumbing Phase 2's owner-election coverage stands on. The suites do
  not use it yet; the first real two-client sections come with Phase 2.

## Ground truths that already cost a debugging session

Most of these are commented at the line where it bit. Do not rediscover them.

**Foundry / v14**

- **Never key persisted data by uuid.** Foundry expands dotted keys on write, and every uuid
  contains dots: `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }` and the
  lookup misses silently forever. Per-target state is an **array of entries with a `uuid`
  field**. (Phase 1 receipts dodged this by accident — they were already an array.)
- **A message renders into several DOM trees** — chat log, the floating notifications pane,
  popouts. Any "do this once per message" latch in a render hook fires on a tree that gets
  replaced while the ones on screen skip. Render hooks must be **stateless**. (Also why a
  `querySelectorAll` over a message's controls returns each button more than once.)
- **Detached render trees hold un-upgraded custom elements.** `tray.open = false` writes a
  plain property that shadows the accessor and never touches the attribute. Use
  `toggleAttribute` — which is exactly what the system's own `_collapseTrays` does.
- **A CSS animation is not instantiated until its element is actually being rendered**, and a
  chat message is inserted into a tree that is not rendering yet. Measured: a card's countdown
  bar reported `getAnimations().length === 0` and zero width more than a second after render,
  so it later began its drain from zero and stayed seconds behind the same bar in a popup —
  from an identical `animation-delay`. `animation-delay` cannot fix it (it is relative to a
  start the element chooses). Build timed visuals with `element.animate()`, which exists the
  moment it is called and runs on the document timeline, and set `currentTime` from an
  absolute deadline.
- ⚠ **A synthetic (unlinked-token) actor rebuilds its embedded collections from the delta on
  every write**, so deleting documents one at a time throws `Item "…" does not exist!` on the
  second call — the loop is deleting a document the server already dropped. Collect the ids and
  make **one** `deleteEmbeddedDocuments` call. Same for its effects.
- PowerShell's `-Encoding utf8` writes a **BOM**, which breaks `JSON.parse` for the deploy
  tooling and Foundry alike. Edit `module.json` with the editor tools, not shell rewrites.
  Editor writes can also flip a whole file to CRLF against an LF `HEAD`, which turns a 300-line
  diff into a 2000-line one — check `git diff --numstat` before committing.
- ⚠ **`getSpeaker({actor})` resolves through the actor's OLDEST active token on the VIEWED
  scene.** A stray unlinked fixture token (another suite's reused "Hobgoblin", same base
  actor) made every programmatic save's `getAssociatedActor()` return a SYNTHETIC token
  uuid (`Scene…Token…Actor…`) that can never string-match a linked snapshot entry
  (`Actor.x`) — the topple fold skipped every save while probe-topple (different viewed
  scene, no token) passed clean. Three suite runs to corner, 2026-08-16. The module's
  exact-uuid match is CORRECT for every real-table shape (linked↔linked,
  synthetic↔synthetic); the fix is harness protocol — smoke-effects §14 sweeps stray
  victim tokens before rolling.

**dnd5e 5.3.3** (clone at `D:\Workbench\LOCAL\Repos\dnd5e-release-5.3.3`, tag matches exactly)

- An activity carries its own `activation` **only when `activation.override` is true**;
  otherwise it inherits the item's. Spells keep casting time at item level, so an
  activities-only compendium scan finds **zero reaction spells, Shield included**. Scan both.
- **Shield's +5 is a non-transfer Active Effect** ("Imperceptible Barrier",
  `system.attributes.ac.bonus` ADD 5) that the native tray applies on click — casting alone
  moves nothing. Monster reactions ship theirs *disabled* with a note telling the GM to
  enable it by hand. Anything re-testing AC must make sure the effect actually landed.
- ⚠⚠ **`system.attributes.ac.calc === "flat"` RETURNS before `ac.bonus` is ever added**
  (`data/actor/templates/attributes.mjs`, comment: *"Flat AC (no additional bonuses)"*), and
  `ac.bonus` is precisely the field Shield's effect writes. **On a flat statblock the reaction
  is inert**: the effect lands, `ac.bonus` reads 5, `ac.value` never moves, and the attack still
  hits. No module can fix this — the system is refusing to count it.

  **This is the first thing to check when a reaction "does nothing" on a monster.** It bit live
  on 2026-08-15: the hand-authored Skeletal Mage had `calc: "flat", flat: 16`, so Gren's 16
  stayed a hit through two casts of Shield. It is bad data, not a shape to support —
  `dnd-monster-manual.actors` is 383 natural / 116 default / **1 flat** out of 500, and this
  world's 130 NPCs are 113 default / 15 natural / 2 flat. Fix is one field: `calc` →
  `natural`, leaving `flat` as the number. Natural uses it as the BASE and then adds shield,
  bonus and cover, so the printed AC does not move (verified 16 → 16, and 21 under Shield).
  Since **v1.1.14** the verdict card names this case specifically instead of saying "its AC has
  not arrived", which is what sent a debugging session after a module bug that was not there.
  `smoke-hold` §4d6 holds the line. *(Note: this cannot bite the Magic Missile trigger — a
  negate hold never reads AC at all.)*
- `flags.dnd5e.originatingMessage` is stamped **only from a DOM click's enclosing card**. A
  programmatic roll must pass it explicitly or the roll never enters the message registry.
- Hit/miss is computed at render time and **never persisted** — recompute downstream.
- The usage card is a message **subtype** (`type: "usage"`); `flags.dnd5e.messageType` is the
  legacy shape `migrateData` writes, so matching only the flag no-ops on every current card.
- `dialog.configure === false` skips a roll dialog. `activity.use(usage, dialog, message)` —
  the dialog config is the **second** argument.
- **An item added to a base actor reaches an unlinked token's delta stripped of its embedded
  effects and activities.** Set test fixtures up on the token actor, or use a linked token.
- **The target snapshot is not an attack-roll thing.** `flags.dnd5e.targets` comes from the
  activity mixin's `messageFlags` getter (`mixin.mjs:140`), which every usage card gets whole
  (`mixin.mjs:203`) — and every damage card too (`:895`). So a spell with no attack roll
  anywhere in it still tells you exactly who it was aimed at. That is what made the second
  trigger cheap.
- `_createUsageMessage` returns **plain data, not a ChatMessage**, when `create: false`
  (`mixin.mjs:812`) — hence the `instanceof ChatMessage` guard on the spell trigger.
- **`dnd5e.renderChatMessage` fires for EVERY message subtype** (`chat-message.mjs:142`, outside
  the usage/roll branch), so a usage card grows the hold row exactly as an attack message does.
- **A damage activity rolls its damage the moment it is used** —
  `DamageActivity._triggerSubsequentActions` (`damage.mjs:53`), same as an attack activity rolls
  its attack. `subsequentActions: false` suppresses it, which is how the harness controls timing.
- **`dnd5e.preApplyDamage(actor, amount, updates, options)` cancels on an explicit `false`**
  (`actor.mjs:754`), and the native tray passes the **damage message** as
  `options.originatingMessage` (`damage-application.mjs:76`) — one `getOriginatingMessage()` hop
  gets you the usage card. It fires on whichever client is applying, so a veto must not be
  GM-gated. **Healing takes this same path** (`roll.type: "healing"`), so any veto must check
  the roll type or it can refuse someone a cure.
- ⚠ **A `min3` damage die survives crit doubling — the CARD is what lies.** Great Weapon
  Fighting is not automated by the system (its own feature text says so); the premades and this
  world both express it as a **custom damage formula**, `2d6min3` on the weapon's base part.
  `configureDamage` raises the die COUNT through `term.alter(cm, cb)` and never touches
  `term.modifiers`, so a crit rolls `4d6min3`. Measured on Morgash's greatsword, 250 rolls each
  way: every die under 3 paid out as a 3, normal and crit alike. What misleads is the render —
  Foundry's `min` leaves `result: 1` and sets `count: 3`, so the card prints the glyph **1**
  with a faint `rerolled` class and the missing 2 shows up only in the total, identically on
  both. **A correct crit looks exactly like a broken one; read the total, not the faces.**
  *(Reported 2026-08-15 as "the 1 became a 3 on a normal hit but not on a crit"; closed by
  building the real roll through `getDamageConfig` → `DamageRoll.build` with `create: false`.)*
- ⚠ **A `system.identifier` is NOT unique across rule versions.** `dnd5e.spells` (2014) ships a
  Hunter's Mark with identifier `hunters-mark` and **no bonus-damage activity at all** — the
  separate "Bonus Mark Damage" press is a 2024 modelling. `smoke-riders` picked it by taking the
  first identifier match and scored **4/8 with every negative assertion passing vacuously**.
  Select content by the SHAPE you need, not by the identifier alone.
- **A mark names its placer through `origin`, and there are TWO shapes.** The effect tray writes
  `origin = concentration ?? effect` (`effect-application.mjs:184`): normally the source item's
  own effect (`Actor.x.Item.y.ActiveEffect.z`), but the caster's concentration effect when
  `chatMessage.system.concentration` is set. A live mark on this table took the FIRST branch
  while its ranger was concentrating throughout — so do not code to either. Walk the uuid up to
  the nearest Actor, and if no Item was passed, read `flags.dnd5e.item` off the origin effect.
  **Concentration is never a gate**: the dependent-effect cascade deletes the mark when
  concentration breaks, so a mark still on the target is a mark that still counts.
- **Injecting a damage part at `dnd5e.preRollDamageV2` gets crit doubling for free.** That hook
  fires at `basic-roll.mjs:101`, *before* `applyKeybindings` at `:106` stamps `options.isCritical`
  onto every entry in `config.rolls` — including one pushed by a module. Do not hand-roll it.
  ⚠ And do not consult `damage.critical.allow`: it governs the standalone button (where there is
  no attack to ask about) and reads inconsistently across official content.
- **Spell-slot consumption is skippable in data**: `hasSpellSlotConsumption` is
  `requiresSpellSlot && consumption.spellSlot` (`mixin.mjs:432`), so an activity built with
  `consumption.spellSlot: false` casts with no slot at all. That is how §6 gives an NPC with no
  slot maxima a working Magic Missile, and it is the shape innate casting really has.
- **A heal activity rolls itself on use** (`heal.mjs` `_triggerSubsequentActions` →
  `rollDamage`), stamping `roll.type: "healing"` and `originatingMessage: results.message?.id`
  — which is `undefined` when the usage card was suppressed, and nothing downstream minds.
  The roll's own CONFIG DIALOG is native on the caster's client and deliberately stays (dice
  agency); suites must pass `subsequentActions: false` and roll explicitly with
  `configure: false` or the headless page hangs on the dialog.
- **`calculateDamage` negates healing-typed entries itself** (`actor.mjs:868`,
  `invertHealing`), and derives `treatAs` from `options.originatingMessage`'s `roll.type`
  (`actor.mjs:807`) — so passing the heal roll message as `originatingMessage` makes
  `"maximum"` and `"temphp"` entries behave too. The shared applier needed ZERO changes to
  apply healing.
- **Casting concentration at the limit auto-replaces, silently**: `_prepareUsageConfig`
  sets `concentration.end ??=` an existing effect when at the limit (`mixin.mjs:475`), and
  the use ends it (`mixin.mjs:250`) — no dialog, the old cast's dependents cascade away.
  Why smoke-cast's back-to-back Blesses just work.
- **The save enricher's click really does chain**: `buildPost` derives
  `originatingMessage` from `event.target.closest("[data-message-id]")`
  (`basic-roll.mjs:173`), and the enricher passes the click event through — a save rolled
  from the topple card's `[[/save]]` button arrives chained to that card. Confirmed live;
  the fold rides it.

**Concentration (5.3.3, the 2.5 seams)**

- `getConcentrationDC(damage)` is `clamp(floor(damage/2), 10, modern ? 30 : ∞)`
  (`actor.mjs:471`) — the 30 cap exists only under modern rules.
- The native trigger guard (`attributes.mjs:548`): net HP+temp loss AND (temp fell OR value
  below `effectiveMax`) — the excluded case is a max-HP reduction. Rest/advancement return
  before `dnd5e.damageActor` ever fires, so the hook never sees them.
- **A failed save changes nothing natively, and neither does 0 HP** — nothing in the system
  links HP, statuses, or save results to `endConcentration`. Both breaks are the module's.
- `rollConcentration(config)` resolves ability `conc.ability in abilities ? it : con`, folds
  `conc.bonuses.save` and `conc.roll.mode` (War Caster's advantage) from actor data, and
  defaults `target: 10` — pass the real DC as `config.target` and the save card marks
  success/failure natively (`isSuccess` is bare `total >= target`, basic-roll.mjs:221 — **no
  nat-1/nat-20 override on saves at 5.3.3**, so a verdict computed the same way can never
  disagree with the card).
- The save message carries `flags.dnd5e.roll = { type: "save", ability }` — **nothing marks
  it as concentration**. The module's own rolls carry `respondsTo`; a bare sheet roll is
  recognized by actor + ability + the ABSENCE of `flags.dnd5e.originatingMessage` (a save
  belonging to an activity chain must never be mistaken for a concentration answer).
- **Forcing advantage/disadvantage with `configure: false`**: `applyKeybindings`
  (`d20-roll.mjs:81`) recomputes `advantageMode` unconditionally from the roll's
  `advantage`/`disadvantage` booleans, so set THOSE (an explicit false out-votes the
  data-driven true via `mergeConfigs`, basic-roll.mjs:465) and never `advantageMode`
  directly. Situational bonuses are `config.rolls[0].parts` (unshifted in front).
- The native prompt is a whispered roll-request card whose content carries
  `data-action="concentration"` (roll-request-card.hbs) — rendered HTML at create time, so a
  content match vetoes it cleanly; a GM's `[[/concentration]]` enricher text never matches
  (messages store raw enricher text; enrichment happens at render).

**Weapon masteries (5.3.3, the 1.9 seams)**

- **Eligibility is trait + weapon**: `masteryOptions` (`data/item/weapon.mjs:327`) is non-null
  only when `actor.system.traits.weaponProf.mastery.value` (a Set of base weapon ids —
  character data only) contains `weapon.system.type.baseItem` AND the weapon has
  `system.mastery`. With `configure: false` the roll takes `masteryOptions[0]` — the weapon's
  own mastery — and stamps `flags.dnd5e.roll.mastery` on the attack message
  (`attack.mjs:167`); an ineligible wielder stamps nothing. A test fixture needs BOTH fields.
- **A usage card's `system.effects` is relative-uuid suffixes** (`.ActiveEffect.<id>`),
  written by `_finalizeMessageConfig` from `applicableEffects` (`mixin.mjs:720`) immediately
  before `_createUsageMessage` — so it IS readable at `preCreateChatMessage`, which is what
  the suppression carve-out does. `system.concentration` (the effect id) is likewise stamped
  pre-creation (`mixin.mjs:248`).
- ⚠ **The native usage card prints the mastery name in its subtitle** ("Simple Melee •
  Push"), so matching announcements by `/push/i` over message content finds the SYSTEM's
  card first. Match this module's announcements by their eyebrow text ("Weapon Mastery —
  Push"), or better, by flag.
- ⚠ **`activity.use()` returning `undefined` means the use was REFUSED** (no slot, no uses,
  cancelled) — a different fact from a suppressed card, where `results` exists and only
  `results.message` is empty. A suite that conflates them chases suppression bugs that are
  empty slot pools; both suites now distinguish, and casters are long-rested between
  cast-heavy sections. (Character slot maxima honor `system.spells.spellN.override` — that
  is how a classless fixture casts a levelled concentration spell deterministically.)
- **Character ability defaults are 10s** — a bare-created `type: "character"` fixture has
  +0 everywhere, and Graze (flat ability-mod damage) refuses to pay 0. The suite sets
  str/dex 16 explicitly and restores them.

**The statblock caster (the monster side, and where most of the bugs lived)**

- ⚠ **A 2024 statblock does not cast from the spell item at all.** Its "Spellcasting" feature
  carries one **`cast` activity per spell**, and the activation, the resource and the
  consumption all live on THAT activity — the spell item it links to is a target that reports
  `spellSlot: true` with no uses and no slots. Verified on Skeletal Mage
  (`Shield - Spellcasting`, activation `reaction`, uses 1/1, consumption `activityUses`) and on
  the compendium Green Hag, which has the same shape on two features. Interrogating the spell
  item concluded every statblock caster was unable to cast, so none ever held. Resolve
  `activity.spell.uuid` for the real name; the activity's own name is decoration
  ("Shield - Spellcasting" on one, plain "Augury" on another).
  **On a cast activity, no uses pool means AT-WILL** — the opposite of the spell-item rule.
  The Green Hag's at-will spells carry `uses.max: ""` and no consumption target at all.
- ⚠ **`CastActivity#use` never uses itself.** It resolves (or lazily creates) a **cached copy
  of the spell on the actor** — flagged `dnd5e.cachedFor: <activity relativeUUID>`, with
  `_stats.compendiumSource` pointing at the linked spell — and calls **that item's** `use()`.
  Three consequences the whole monster side rests on: `dnd5e.postUseActivity` fires with the
  **cached spell's** activity (so matching on the used activity's item name gives "Shield", not
  "Spellcasting"); `_prepareUsageConfig` sets `consume.spellSlot ??= !linked && …`, so a linked
  cast **never spends a slot**; and `config.cause.resources` routes payment to the **cast
  activity's own uses** instead. That is why a statblock caster with 0/0 slots can cast at all.
  *(This is also why the spell trigger matches through `reactionNameFor`: a monster casting
  Magic Missile arrives with the cached spell's activity, whose item really is named for the
  spell.)*
- **The system materializes that cached spell by itself**, about half a second after a cast
  activity is created on an actor. Creating one by hand (`getCachedSpellData()`) races it and
  leaves the actor with **two** items called Shield — a name collision the module then has to
  survive. Fixtures must wait for it, not build it.
- A cast activity's `activation.type` lives in **its own source** — the Skeletal Mage stores
  `reaction` with `override: false` — and `prepareFinalData` overrides it from the cached spell
  when one exists. So it reads `reaction` from the moment of creation; an `override: true` is
  not needed and would model a shape no statblock has.
- **An NPC's spell-slot maxima are derived** from spellcasting progression and recompute to
  0; a leftover `value` with `max: 0` is phantom data. Requiring a real `max` is what stops
  the module holding every attack for a reaction the actor can never cast.
- **There are TWO ways to pay for a spell**, and monsters mostly use the second: a slot, or the
  statblock's "Additional Spells" x/x uses pool (item-level or activity-level). Verified on
  Skeletal Mage: `spellcasting: "int"`, `details.spellLevel: null`, every slot 0/0.
- **`prepared` is a PC concept.** Every levelled spell on a 2024-statblock NPC reads
  `prepared: 0` (Skeletal Mage's entire list does). Gating eligibility on it silently
  disqualified the whole monster side.
- **A name match is not a reaction.** A hobgoblin WEARS a shield — an `equipment` item named
  literally "Shield" — and eleven such items existed in the world. Matching the interrupt list
  on name alone made every shield-carrying monster hold the chain for a spell it cannot cast
  ("Hobgoblin — Shield?" on a creature with no spells). Eligibility must require a real
  reaction activation, at item level or on an overriding activity — which is what
  `usableReaction()` is, and why **both** triggers go through it.
- **One name can match several items.** An armoured caster owns a worn shield AND (via the
  cached copy above) the Shield spell; `items.find()` returns whichever sorts first, and on an
  unlinked token the base actor's equipment sorts ahead of the delta-created spell.
  `usableReaction` handles this for **eligibility** (it tests every match). Every *other*
  question — has the effect landed, what is its AC bonus, what artwork and description does the
  popup show, what does the Cast fallback use — was still a bare name match until **v1.1.13**,
  and all of them read the worn shield: no effects, no bonus, no activities. The mechanics
  still came out right, so the failure was purely in what the table was TOLD. They all route
  through **`reactionItem()`** now, which prefers the cached spell of the cast activity the hold
  recorded. **If you add another question about a reaction, ask it through that helper.**

## The shape of the thing

One ES module, `scripts/battleflow.js`, no build step (**4,156 lines — the ~4,500 split
trigger in design.md §9 is one phase away; plan the split as part of Phase 2**). Sections
in order: settings + the settings-sheet polish, shared hit-test/chain helpers, table
polish (incl. per-source suppression + the cast-slice stamps/replacement), Phase 1a
auto-damage, the reaction hold (eligibility → **both triggers** → answers → continuation →
the veto → views), Phase 1.75 hit riders, Phase 1b auto-apply + the shared damage applier,
Phase 1.9A effect riders + the shared effect applier (`applyEffectsWithReceipt` — the
Phase 3 convergence, extracted at v1.5.0), Phase 1.9B/C mastery riders + the topple fold +
the reminders + the ask, **Phase 2.5 concentration (cause capture → trigger → ask → roll →
fold → break → views → native-card veto)**, **Phase 3 cast slice (stamp → elect executes →
receipts)**, receipts. Entry-point hooks check their feature toggle; view/continuation
hooks check flag presence (the cast slice's stamps are exactly this discipline); every
feature ships **off**.

The elect-owned single-answer clock is shared (`armAskTimer` — the mastery ask and the
concentration ask are true twins there); the hold's clock stays its own machine on purpose
(continuing-client owner, per-target answers — the extraction note that used to sit on the
mastery timer says why).

The payout pipeline is one deterministic sequence per damage message on the elect
(`resolveDamagePayouts`): **application → effect riders → mastery** — sequential because
the Vex/Slow damage gates read the receipt's post-trait `taken`, which exists only after
application. The mastery ask is a hold miniaturized (stamp → row → popup → answer-flag →
elect executes), deliberately with no continuation, settle, or re-test.

The hold has **two entry points and one machine**. `stampHoldIfInterrupted` (from
`dnd5e.rollAttackV2`) writes a hold onto the **attack message**; `stampSpellHold` (from
`dnd5e.postUseActivity`) writes the same shape onto a **usage card** with `trigger: "spell"`.
Everything downstream is shared, and the four places that need a d20 branch on that one field —
`continueHold`, the card row, the popup's situation line, and the response message's wording.
Holds already in the log carry no `trigger` at all, which is exactly why the branches cannot
reach the shipped attack path. **If you add a third trigger, add it as a stamp function and a
`trigger` value, not as a second machine.**

**The flag inventory** — every piece of persisted module state, in one place:

| Where | Flag | What |
| --- | --- | --- |
| attack message | `hold` | the reaction hold: status, trigger, deadline, per-target answers/verdicts (array, uuid fields) |
| attack message | `mastery` | the Use/Pass ask: status, key, answer, deadline, targets |
| attack message | `receipt` | Graze only — the miss's damage receipt lands here (no damage message exists) |
| damage message | `receipt` | per-target prior HP/deltas/taken/traits/multiplier + reverted markers |
| damage message | `effectReceipt` | applied effects per target, each entry carrying `description` (the hover tooltip) + per-stage idempotence markers (`ridersDone` / `castDone`) |
| response message | `respondsTo`, `uuid`, `answer`, `ac`, `effectLanded` | a player's answer traveling to the continuing client |
| bfCard message | `topple` | the Topple demand: `dc`, `ability`, `weapon`, per-target `done` + `outcome` ("prone"/"saved") — the fold judges by this dc |
| usage card OR replacement bfCard | `castApply` | the cast payload: activityUuid, concentration id, scaling, spellLevel, targets — the stamp IS the trigger |
| healing roll message | `healPending` | the initiating client's claim; the elect applies and the receipt marks it done |
| bfCard message | `masteryNotice` | the reminder: key, attacker, weapon, wording, deadline/window (popup auto-dismiss) |
| ask message (bfCard) | `concentration` | the concentration ask: status, actor, ability, dc, damage, names, effectIds snapshot, cause, deadline, outcome |
| concentration roll message | `respondsTo`, `timedOut` | which ask this roll answers (the hold's answer-channel key, same meaning); whether the buzzer pressed it |
| actor | `reactionSpent` | the click-volume guard, cleared on turn/combat-end (clears are NOT toggle-gated) |
| applied effect | `reactionEffect` / `mastery` | which module path created it |

The load-bearing idea, worth re-reading in design.md §4 before changing anything: **the chat
log is the state and the bus.** No sockets, no in-memory workflow object. State lives in flags
on messages; the popup and card rows are *views* of those flags; clients volunteer actions
based on what appears in the log and never command each other. Three different answer channels
for a hold (the player's response message, the player's own cast, the GM's flag flip) need
zero coordination because of this.

## Working with this user

- They dogfood live, at the table, and report bugs from real play — Tom caught the Cast button
  not casting; the user caught the flat AC and the extra Skip button. **Trust those reports;
  they have been right every time.** Reproduce in the harness before fixing, and add the
  assertion that would have caught it.
- **When a report arrives, read the actual log and flags before theorising.** The flat-AC bug
  looked exactly like the module bug that had just been fixed; one read of `ac.calc` settled it.
- **They will ask whether a feature is worth its complexity, and they mean it.** Magic Missile
  opened with "i dont want to do it if it overly complicates things". Answer with the real cost
  and a recommendation *before* building, not after.
- They asked for independence on long stretches ("I'm going to AFK, do the work"). Ship, test,
  release, and report honestly at the end. **They keep their git clean and want the rev cut when
  the work is done** — never leave a bumped `module.json` dangling without the matching GitHub
  release; a later fix becomes a new rev rather than a reason to hold one back. Build and test
  freely, then *offer* the release — they say yes, but the offer is the courtesy.
- They test immediately after a release, so say plainly what is live, what needs an F5, and
  what needs a process restart.
- They cut prose that repeats itself. Say it once (standing item 4).
- combatplus is a **reference, not a template**.
- Surface doc/code disagreements rather than silently choosing (design.md §10).
