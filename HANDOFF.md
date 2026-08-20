# HANDOFF.md — picking this up cold

> ⚠⚠ **THIS SESSION OPENS ON A WALK. v1.18.0 IS BUILT AND UNSEEN — PRESENT THE CHECKLIST
> BELOW FIRST.** The player-rolled damage popup (FLOW item 3 / Pass B) plus the crit indicator
> is built, 9/9 on its own probe, battery-green, deployed to the sandbox and the box is
> **BOUNCED AND REGISTERING 1.18.0**. **No human has seen it.** It is **NOT tagged, NOT
> released and NOT on prod** — deliberately: v1.17.0's pattern was table-test first, release
> after, and this follows it.
>
> ✅ **PROD IS CLEAN AND UNTOUCHED at 1.17.0**, `BF_TARGET=prod verify-settings` CLEAN. The
> four-session version drift stays paid off — **no CODE was deployed to prod this session.**
>
> ⏸⏸ **ONE THING IS LEFT UNFINISHED AND IT IS NOT CODE — THE GM-BAR MACRO.** *Clear Temp
> Effects + Full Rest (Scene)* is applied and verified on the SANDBOX and **still pending on
> PROD**: prod went 0 → 1 users mid-write and the never-during-live-play rule stopped it. The
> macro body and its applier are committed — see **“The Clear + Full Rest macro”** below for the
> one command that finishes it. **Confirm prod is idle first.**
>
> ⚠⚠ **THE DECK WAS RE-CUT, AND THEN PASS A WAS DEFERRED.** The old seven slots became THREE
> PASSES at the user's call (*"i would rather bundle 2, 4 and 6 in one pass. 3 in another pass,
> 5 and 7 in a another pass"*): **A** = Cleave arm-button + post-roll folds + Shield Master and
> the success verdicts; **B** = the player-rolled damage popup; **C** = both volleys. Then A was
> deferred — *"i dont want to do A, tedious, can we try B please"* — and **B was built first
> and out of order.** A is waiting on appetite, not on a blocker. **C should still not go
> before A** (item 6's per-ray rider question is answered by watching A at the table).

## ⬜ THE CHECKLIST — walk v1.18.0 in the sandbox

The box is up, minimized, on 1.18.0. **The setting ships OFF and is PER-CLIENT**, so nothing
changes until you turn it on: **Settings → Battle Flow → Attack Resolver → "Roll Your Own
Damage"**. Turn it on for the client you want to test as.

| # | What to check | What should happen |
| --- | --- | --- |
| ① | **The setting is findable and off.** | Under Attack Resolver, below Dramatic Beat. Greyed out when Auto-Roll Damage is Off. Nothing changes while it stays off. |
| ② | **Turn it on. Hit something.** | A popup on YOUR client only — weapon art, *Damage — your roll*, who it is aimed at, a draining 15s bar, one **Roll Damage** button. The dice do NOT roll yet. |
| ③ | **Press the button.** | Damage rolls exactly as it used to — same auto-apply, same receipt, same revert. Nothing downstream should look different. |
| ④ | **✨ Crit it.** | Gold **CRITICAL HIT** badge, button reads **Roll Critical Damage**, window title says Critical. It reads the roll's own crit flag, so it cannot lie — but confirm it FIRES when you actually crit. |
| ⑤ | **Ignore one. Let the bar run out.** | At 15s it rolls itself. A missed popup must never stall the table. |
| ⑥ | **X out of one.** | It rolls IMMEDIATELY — dismissing means *get on with it*, not *cancel*. |
| ⑦ | **Two targets, one attack.** | **ONE** popup, not two. One damage roll serves every target it hit. |
| ⑧ | **A held reaction (Shield) that still hits.** | After the hold resolves you STILL get the popup — that is the moment you most want your own dice. |
| ⑨ | **The GM's own side.** | It is per-client, so the GM only gets popups for attacks the GM rolls. Check it does not follow the players' attacks onto your screen. |

⚠ **KNOWN LIMIT to confirm you are happy with, not a bug to report:** the 15s window is a
`setTimeout` on one client, so an **F5 mid-popup loses that roll** (today's 3s beat has the
same hole, 5× narrower). Making it survive a reload needs a flag + a re-render popper + an
elect for *who rolls if the roller never comes back* — the cross-client machinery whose
absence is exactly why this item was small. Say the word if it bites and it becomes a
follow-up.

**After the walk:** findings → fixes → one battery-green pass → tag + GitHub release → prod
deploy → **the user bounces prod** → verify the registered version. The bounce is never
scripted from here (prod's `/setup` 403s an authenticated admin session).
>
> ✅ **v1.17.0 IS CUT, TAGGED, RELEASED, TABLE-TESTED AND DEPLOYED.** The potion default was
> walked by the user and confirmed good before release. Its walk is CLOSED; the OPEN walk on
> this file is v1.18.0's, above.
>
> ⚠⚠ **THE v1.16.0 WALK CLOSED CLEAN — 7 of 7, ZERO findings, no code.** Second clean walk
> in a row. Every v1.16.0 item is now TABLE-verified: the target block on both dialog classes,
> the zero-target case, live re-target repaint, the temp-HP card, the DM's quiet, and the
> struck Riposte prompt. **Do not present that list again.**
>
> ✅ **PROD IS FULLY CURRENT.** Files deployed over WebDAV and byte-verified (17 files
> md5-matched, prod IDLE at 0 users), process bounced from the Molten panel by the user, and
> **`game.modules.get('fvtt-mod-battleflow').version` reads 1.17.0**. Verified after the
> bounce, not assumed.
> ⚠ **THE RULE THAT GOT US HERE, KEEP IT:** a file deploy is HALF a prod release — Foundry
> reads `module.json` at PROCESS BOOT — and **the bounce cannot be scripted**: prod's `/setup`
> returns **403** to an authenticated admin session, so a script can shut the world down and
> then fail to bring it back. **Never attempt it from here.** Every version bump ends by
> handing the bounce to the user and verifying the registered version afterwards.
>
> ✅ **`Riposte:ac` IS ALREADY GONE FROM PROD — the previous handoff's claim was STALE.**
> `BF_TARGET=prod node tools/verify-settings.mjs` reports **CLEAN**: every prod setting matches
> the reference table, Riposte included. **There is nothing to strike. Do not re-raise it.**
>
> ⚠ **Phase 4 still stands and is still not next.** Its checklist is below and still valid —
> it needs TABLE time (ten rounds of Bless), so it rides a real session.
>
> 📋 **THE FLOW BACKLOG LIVES IN [FLOW.md](FLOW.md)** (2026-08-19). Session 4's FLOW/polish
> track — 14 items, built from the transcript + chat-log audit, RECONCILED against the tree
> (four items had already shipped in v1.15.0), and carrying its own build order. It is a
> separate track from this file's bug ledger. **Read it before building anything.**
> ⚠ **It supersedes the Desktop scratch .txt entirely — that file is no longer a reference.**
> **Done and shipped:** **v1.18.0** — PASS B (the player-rolled damage popup + the crit
> indicator), BUILT AND AWAITING ITS WALK. **v1.17.0** — build-order 4 (potions default to the
> drinker). **v1.16.0** — build-order 0 (strike `Riposte:ac`), 1 (target decoration),
> 13 (temp HP card), 14 (the DM's quiet). **After the walk: PASS A, the fold pass** — deferred
> once as tedious, so confirm appetite before opening it rather than assuming it is next.
> ✅ **That track's open question is ANSWERED:** a consumable DOES raise a dialog, so the
> decoration reaches potions and item 4's reversal trigger is permanently dead.
>
> ✅ **The AC5e-vs-Phase-4 ordering conflict is RESOLVED, not open.** It was never a fight
> over one slot — Phase 4 needs the TABLE (ten rounds of Bless, rides a real session) and
> AC5e needs the BENCH (install in the sandbox, watch, decide). User's call 2026-08-19:
> *"ok thats fine re ac5e on bench. we are not there yet, we are working on the items list."*
> **The FLOW build order has the deck; AC5e waits.**

> ⚠⚠ **THE STANDING SESSION CYCLE** (named by the user 2026-08-19: *"i like it when you
> do the fixes, make a handoff ready and when i start the handoff i have a testing check
> list — we've been doing that a while now"*). This is now PROCEDURE, not habit:
> **findings → probe to bedrock → user says "go" → Claude does the fixes in ONE
> battery-green pass → release → HANDOFF rewritten with the next checklist ready.**
> A session opened on this file STARTS by presenting the checklist. A fix pass ENDS by
> recutting it. Neither step is optional, and neither waits to be asked for.

> ⚠ **ONE GM-CAPABLE CLIENT PER ACCOUNT DURING PLAY** (standing, after the 2026-08-18
> session — but the MECHANISM was re-derived 2026-08-19 and the old wording, *"the bridge
> never connects during live play"*, is RETIRED: it was built on a misreading of the elect).
>
> **What is true.** `isActiveGM()` is per-USER: `game.users.activeGM` names an ACCOUNT, so it
> is true in EVERY session logged into that account at once. Two sessions on the **elected**
> account both run the apply/sweep — exactly session 4's twin asks reaching contradictory
> verdicts. v1.15.0 makes the module CONVERGE when it happens (twin asks and twin chips delete
> themselves); one client per GM-capable account is still the rule. Note this bites a stale
> second window on the USER'S OWN account just as hard as anything headless.
>
> **What is NOT true: a second session does not "steal" the elect from the user's window.**
> Core's `Users#activeGM` → `getDesignatedUser` designates the **highest ROLE** among active
> GMs (id breaks ties only between EQUAL roles), and its own doc comment reads *"non-assistant
> if possible"*. `Matt the DM` is role 4; `DM Assistant` and `Tester Assistant` are role 3 — so
> **the user's window holds the elect for as long as it stays connected.** Verified three ways
> on 2026-08-19: prod's served `foundry.mjs` (14.364) is BYTE-IDENTICAL to the sandbox's 14.365
> on `getDesignatedUser`; and with a real Matt-the-DM window AND the bridge connected at once,
> `game.users.activeGM` = Matt the DM, `bridgeHoldsElect: false`.
>
> ⇒ **Live MCP assistance during play is therefore ALLOWED** — it is half the point of the
> tooling (`fvtt-mcp-molten5e` design.md §1, half 2), and a blanket ban deleted it by accident.
>
> ⚠ **The real residual risk: the bridge is a HOT STANDBY.** Role 3 inherits the elect the
> instant no role-4 client is connected — an F5, a reconnect, a slept laptop — and module work
> landing in that gap goes to the invisible headless window. Leaked bridge processes and the
> `process.exit()` rule matter for exactly this reason, not because a connect is itself theft.
>
> 🔎 **Diagnostic corollary.** Session 4's twin Topple asks were authored by `DM Assistant`, so
> under role-priority NO role-4 client can have been connected at 00:37:24 — the user's own
> window had dropped by then. Worth remembering as a read on the logs, not just a rule.
>
> 💡 **Permanent fix if ever wanted (NOT built).** `isActiveGM()` is one line in `scripts/core.js`
> wrapping core's elect. Excluding a designated bridge account there would make the bridge
> permanently elect-INELIGIBLE while keeping its GM powers for MCP work — removing the hot-standby
> risk structurally instead of managing it by rule.

> ⚠ **Current at 2026-08-19 (third session of the day) — v1.16.0 IS CUT, TAGGED, RELEASED
> AND RUNNING IN THE SANDBOX; PROD IS UNTOUCHED AND STILL ON v1.15.0.** Four changes, all
> raised by the user at the table and all machine-verified before release, NONE yet seen by
> a human: the use dialog now says who it is aimed at (token art + absolute disposition, on
> both the attack roll dialog and the spell/item usage dialog); temp HP stops rendering as
> `−0 HP` in damage red; the DM stops getting the players' hold popups; and `Riposte:ac` is
> struck from the Reaction List. Battery green on the released build and `verify-settings`
> CLEAN. Full detail per item lives in [FLOW.md](FLOW.md) — this file carries the walk.
>
> **The previous session, kept because its rulings are still law** — **THE CARRY-OVER WALK CLOSED CLEAN:
> ZERO findings, ZERO code, no release.** The user walked the four geometry items in one
> pass: ② instantaneous cleanup, ③ the toolbar path and ④ big-token sampling all CONFIRMED
> at the table, ① ruled NOT A CONCERN (and recorded as unwalked, not as verified). Two
> long-running questions closed as RULINGS in the same pass — the concentration popup for
> offline-owner PCs is FINE as-is, and Thomas's 16/36 HP is Life Drain resolving via plot.
> **The shipped code did not change; everything below about v1.15.0 still stands.**
> ⚠ The oldest debt on this file is now paid — **v1.13.0's finding ① (the toolbar path) is
> table-verified two releases late**, and Phase 4 takes the next checklist slot.
>
> **The release state, unchanged** — **v1.15.0 SHIPPED, TABLE-CONFIRMED, AND LIVE ON PROD: four of
> the 2026-08-18 live session's seven findings closed in code, three closed as not-module,
> plus finding ⑥ raised and fixed during the walk itself.** Every item was confirmed at the
> table by the user before release. The freeze lifted when Tuesday's session ended. Diagnosis ran off the FULL CHAT LOG plus three read-only
> probes (`tools/probe-session4.mjs`, `probe-topple-session4.mjs`,
> `probe-doubles-session4.mjs`, all committed) rather than a clean-room re-verify — the
> log turned out to be a better witness than a re-run would have been, because it records
> what actually happened rather than what happens next time. Read [design.md](design.md)
> first — it is binding and has absorbed everything through v1.15.0. This file is only
> *where things stand* and *what already bit us*.
>
> **v1.15.0 in one breath:**
> - **⓪ THE ELECT IS PER-USER — the night's root cause, probe-proven.**
>   `game.users.activeGM` names a USER, so `isActiveGM()` is true on EVERY client logged
>   into that account at once. Two zombie script sessions held DM Assistant from ~20:20
>   to 21:05 and the bridge reconnected in stretches after. The twin Topple asks at
>   00:37:24 are both authored by DM Assistant off ONE swing, and they reached
>   CONTRADICTORY verdicts (prone-by-timer 10 AND saved-by-hand 21). Foundry exposes no
>   cross-client session identity, so the race cannot be prevented — it CONVERGES now:
>   every topple ask carries `sourceMessageId` and a twin over the same source deletes
>   itself (elder wins by timestamp, then id); every module-applied effect carries a
>   fingerprint (`flags.battleflow.applied`, or the chip applier's `mastery`) and a twin
>   chip does the same. Fingerprints ONLY — another module's deliberate stack is safe.
> - **④ ONE ROLL ANSWERS ONE MACHINE.** Edda's single d20 at 01:15:08 answered her
>   concentration ask AND was eaten by the topple fold's whole-log fallback — her open
>   Topple popup vanished "resolved" having never been rolled for. The fold now refuses
>   any roll carrying another machine's `respondsTo`, and a BARE roll defers conc →
>   saves → topple (the ship order). `saves.js` has had this guard since v1.7.0; mastery
>   was the only recognizer missing it.
> - **⑤ A VERDICT ALWAYS ANNOUNCES.** All eight Topple asks resolved correctly in the
>   data while the user pressed Prone by hand all night: the five "lost" verdicts were
>   SAVES (19, 22, 19, 17, 21), and a success said nothing at all. A public ask with a
>   draining bar that ends in silence reads as a dropped machine — so a successful topple
>   save now posts "<name> stays standing", the concentration fold's idiom. **Binding
>   design language: a table moment opened in public is closed in public.**
> - **① A DURATION AREA DIES WITH ITS CONCENTRATION.** Faerie Fire's region outlived the
>   spell (the native end-of-concentration cascade owns that delete and lost it — same
>   lost-one-shot class as v1.14.0's finding ②). The spent-sweep floor now covers
>   duration areas: demand done + the usage card's concentration effect gone ⇒ swept,
>   immediately via `deleteActiveEffect` and convergently on render. The chips cascading
>   away with it at TRUE spell end is correct; that only hurt because the user was
>   deleting the region by hand to clean up after the machine.
> - **Closed as NOT-MODULE:** ③ Life Drain "asked twice" (nine demands in the log, all
>   singletons, well separated — not reproduced); ⑥ Shield re-prompting while Shield was
>   up (the card reads `AC 15 → 20`, so the +5 was NOT active — the module was right);
>   ⑦ Innate Sorcery (WORLD CONTENT: the DDB import stripped its ActiveEffect — grafted
>   back from the PHB compendium, `tools/fix-innate-sorcery.mjs`, and the same sweep
>   found it was the party's LAST ghost reference). ② Bane's double demand is two
>   separate dnd5e usage cards 2 s apart from one player's client — the module stamped
>   each faithfully; watch for a repeat before building cross-message dedupe.

## Where things stand

**Shipped and live** in *The Broken Heart of Greenrest* (Foundry 14.364 + dnd5e 5.3.3,
Molten-hosted). Latest release **v1.16.0** (2026-08-19 — the target block, the temp-HP card,
the DM's quiet, and the struck `Riposte:ac`; sandbox-verified, **NOT deployed to prod**, and
NOT yet seen by a human). Before it: **v1.15.0** (2026-08-19 — the 2026-08-18 session's
findings plus the walk's ⑥, table-confirmed before release), and before that: v1.14.0 (2026-08-17 night —
the v1.13.0 walk's two findings), and all 2026-08-17: v1.13.0 (afternoon), v1.12.0 (night
prior, the v1.11.0 walk's findings), v1.11.0 (evening), v1.10.0 (afternoon; v1.9.6
burned as its staging diagnostic), v1.9.5 (the dogfood sixteen, small hours); and on
2026-08-16: v1.8.0 (the Phase 3 convergence), v1.7.0 (Phase 2 saving throws + the save
slice), v1.6.1 (the split), v1.6.0, v1.5.1, v1.5.0, v1.4.0, v1.3.x. Deployed, tags
pushed, GitHub releases carry zip + manifest. **The box tracks the GitHub manifest.**
⚠ Current deploy state (2026-08-19): **v1.15.0 scripts are deployed to prod over WebDAV and
byte-verified** (every file md5-matched against the repo) and prod's `module.json` on disk
reads 1.15.0. Prod was IDLE at deploy — no live table was touched. The running Foundry
process keeps vending the older version string as the script cache key until its next
natural restart, at which point the manifest pulls the real v1.15.0 install; expected, not
a failure. **No bounce was performed.** ⚠ Any client that was open through the deploy needs
ONE F5 — a window runs whatever code it loaded, and a stale window that holds the elect
runs old code for everyone.

| Phase | State |
| --- | --- |
| 0 — native settings | **The user's to do**, at the table. Not code. |
| 1 — attack resolver | ✅ shipped. Auto-roll damage on hit, auto-apply via GM elect, receipts + revert. |
| 1.1 — dogfood polish | ✅ shipped. Tray auto-collapse, require-target gate, usage-card suppression, centered roll dialogs. |
| 1.5 — reaction hold | ✅ **feature-complete at v1.1.16** and dogfooded — both triggers exist: an attack hit, and a listed spell. Magic Missile stays in normal dogfood rotation rather than on a list. |
| 1.75 — hit riders | ✅ shipped v1.2.0 and dogfooded. A mark pays out with the attack that earned it. |
| 1.9 — effect + mastery riders | ✅ **shipped v1.3.0** (2026-08-16), suite-verified end to end. Not yet dogfooded — every switch is OFF at the table until the user walks the ladder. |
| 2 — saves | ✅ shipped v1.7.0, **user-walked live 2026-08-16** (`saves` ON at the table) — the walk produced the sixteen feedback items v1.9.5 answers. |
| 2.5 — concentration | ✅ shipped v1.4.0; **live at the table** since 2026-08-16 evening (`concMode: prompt`, user-walked). |
| 3 — effect application | ✅ **COMPLETE at v1.8.0**: attack slice (1.9A), cast slice (v1.5.0), save slice (v1.7.0), and the convergence (v1.8.0 — unified appliers + the reaction receipt/revert). |

⚠ **World data changed 2026-08-15:** the Skeletal Mage's `system.attributes.ac.calc` went
`flat` → `natural`. Its `flat: 16` is untouched, so its printed AC is still 16 — but a flat AC
ignores every bonus, which made Shield inert on it. See the flat-AC ground truth; reverting the
field restores the old behaviour, bug included.

**Live settings — THE USER'S REFERENCE CONFIGURATION** (read off the box 2026-08-17 after
v1.9.5, at the user's explicit instruction: *"whenever you test, leave them like that"*).
⚠ STANDING RULE: after ANY suite, probe, or test session, VERIFY the world settings
against this table and restore drift — the suites' restore-what-they-find is necessary
but not sufficient (a crashed run restores nothing). When the USER changes a setting,
update this table, never fight it:

| Setting | Value | |
| --- | --- | --- |
| Auto-Roll Damage on Hit | **`all`** | ⚠ an earlier snapshot read `off` and mis-recorded it as the user's call — it was SUITE RESIDUE from a failed run's skipped teardown (see the suites' settings-first rule); the user corrected it, and was rightly annoyed |
| Auto-Apply Damage | on | active-GM elect, receipts + revert |
| Dramatic Beat | **3s** | same residue incident — `0` was the suites' pin, not the user's taste |
| Require a Target | on | |
| Reaction Hold | on | governs **both** triggers |
| Spells a Reaction Blocks | `Magic Missile:Shield` | new in v1.1.16 — the second trigger |
| Reaction List | `Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage` | user-expanded 2026-08-17; ⚠ `Riposte:ac` STRUCK 2026-08-19 — it is not an AC boost and could never fire correctly (see FLOW item 1), so it was offered on every hit and answered with a bare 1d8 |
| Hold Shows the Math | **on** | default flipped in v1.1.8 — design.md §5 carries the correction |
| Hold Timer | **15s** | user re-tuned 2026-08-17 evening ("all my timers to 15s") — also the module default since v1.11.0; 0 waits indefinitely |
| Skip Hopeless Holds | **on** | gated on the reveal, deliberately — see the setting's hint |
| Apply the Reaction's Effect | on | |
| Hold Settle | 8s | |
| Hide Redundant Buttons | **on (the default)** | v1.9.5; keep-list since v1.12.0: **exactly Refund Resource** (finding ②, the user's third ask — the v1.9.5 spec restored; the v1.10.0/v1.11.0 Place Template detour deleted) |
| Hit Riders | **on** | user flipped ON 2026-08-17 |
| Rider Table | `hunters-mark, hex, great-old-one-hex` | identifiers only — the damage is read from the content |
| Rider Upgrades | `foe-slayer:hunters-mark` | replaces the die, never stacks |
| Effect Riders | **on** | user-walked ON 2026-08-16 — a hit applies the card's effects |
| Weapon Mastery Riders | **on** | user-walked ON 2026-08-16 — Vex/Sap auto + reminder, the rest ask |
| Mastery: Ask First | `ask` | `auto` is the tedium escape hatch (silences asks, not reminders) |
| Concentration Checks | **prompt** | user-walked ON during 2026-08-16 evening testing |
| Concentration Timer | 15s | expiry ROLLS (data-driven, straight); 0 waits indefinitely |
| Failure Breaks Concentration | **on** | inert until the mode is on — the forgotten click the phase exists to press |
| Concentration Checks Are Public | **on** | off = whispered to owners + GM; the break card is ALWAYS public |
| Resolve Saving Throws | **on** | user-walked ON 2026-08-16 during the live dogfood |
| Save Timer | **15s** | user re-tuned 2026-08-17 evening ("all my timers to 15s" — 6s proved unwinnable on an unwatched window, finding ④); expiry ROLLS; inert until saves is on. Since v1.10.0 the TOPPLE demand rides this same clock |
| Auto-Apply on Cast | **on** | new in v1.5.0 — no-gate casts (utility effects + healing) apply themselves; damage spells deliberately excluded |
| Center Popups | on (per client, the default) | v1.9.5: THE ONLY client setting left — `holdView` and `saveAutoRoll` are deleted, code paths and all |

## Open items

### ✅ THE 2026-08-18 LIVE SESSION (session 4, the Hollow) — CLOSED at v1.15.0

Findings ①–⑦ were recorded live under the freeze and resolved 2026-08-19 from the chat
log + three committed probes. Full reasoning is design.md's v1.15.0 amendment; the
one-breath version is the header. Disposition, kept because reports referencing these
will keep arriving:

| # | What was reported | Disposition |
| --- | --- | --- |
| ⓪ | elect contamination all night (two zombie GM clients + bridge reconnects) | **ROOT CAUSE, fixed** — per-user elect; twin asks + twin chips now converge |
| ① | Faerie Fire's region outlived the spell; hand-deleting it stripped the chips | **fixed** — duration areas sweep when concentration ends |
| ② | double application ×4 sightings | **split**: Topple ×2 = ⓪ (fixed); Bane ×2 = two real usage cards from one client (watch); chips = no duplicate effect survives anywhere in the world |
| ③ | Life Drain demanded its save twice | **not reproduced** — nine demands in the log, all singletons |
| ④ | Topple ask + concentration ask collided; Topple vanished unresolved | **fixed** — one roll answers one machine |
| ⑤ | Topple verdicts with no follow-through; Prone pressed by hand all night | **fixed** — every failure DID press Prone; the silence on a SAVE was the bug |
| ⑥ | Shield held while Shield was already up | **not reproduced** — the card reads AC 15 → 20; the +5 was not active |
| ⑦ | Innate Sorcery applies nothing | **world content, fixed** — ActiveEffect grafted from the PHB compendium |

⚠ The four stale WAITING demand cards from 2026-08-17 (19:42–19:51) still stand in chat,
deletion still unapproved — ask the user or let them clear chat.

**World content fixed 2026-08-18/19 (not module code):** Gren's Wand of the War Mage +1
was a raw DMG enchant-TEMPLATE copy — shimmed with a plain transferring +1 msak/rsak
effect (`Tu0htbQAllmONqwv`); **Wednesday's leftover: apply the real enchantment or strip
the template cruft, and sweep other actors for the same silent pattern** (the
`fix-innate-sorcery.mjs` ghost sweep covers activity→effect references, NOT this
enchant-template shape). Adrenaline Rush's activity renamed + chat flavor says Temp HP.
Wight "Necrotic Sword" minted as loot. Hollow soundscape volumes re-tuned.

### ✅ THE v1.13.0 WALK — COMPLETE (2026-08-17) + v1.14.0 CLOSED BOTH FINDINGS

The walk's outcome, kept because reports referencing these will keep arriving:
- Item 1's dialog-placement half 🔴 became **finding ①**: Web (18:20 AND 19:03),
  Entangle (19:06) and Fireball (19:11/19:13) all demanded Salyth from OUTSIDE the
  drawn area — the v14 region shim's ×(gridSize/100) create-corruption (the header's
  one-breath list; the full evidence trail is probes 1–9 in tools/, committed). Shatter
  passed BOTH rounds purely on token spacing — its corrupt circle happened to contain
  the right set. The TOOLBAR half of item 1 went UNTESTED at the table (suite-covered
  at §10; re-queued below).
- **Finding ②** (user report, probe-corroborated): instantaneous spells' areas stopped
  sweeping — two stale Fireball circles stood with every target applied. The user
  hand-cleaned the canvas mid-session ("that was me" — do not chase the deletions).
- The retired watch-⑭ "11m 364d ago" render GHOST resurfaced on three buzzer save
  cards (19:13:20) — their DATA timestamps are sane, so this sighting is render-side
  only; the watch stays retired unless the user re-opens it.
- **Both findings → SHIPPED at v1.14.0.** The binding record is design.md's v1.14.0
  amendment (Phase 2); the session ledger lives in this file's git history.

### 🧪 THE LOCAL SANDBOX IS THE TEST ENVIRONMENT (NEW, 2026-08-19)

User's call, mid-session: *"going forward that is our test environment."* This replaces
"suites run on prod, taking turns with the table" everywhere it appears below.

- **What it is.** A local Foundry (v14.365) serving a byte copy of prod's world, imaged by
  `fvtt-mcp-molten5e/scripts/pull-prod-to-local.mjs`. Same world id, same users, same
  fixtures — which is exactly why a suite pointed at the WRONG instance is invisible until
  it is expensive. Two MCP namespaces coexist in one session: **`foundry-local5e`** (sandbox)
  and **`foundry-molten5e`** (prod); the instance is fixed by which server the call goes to.
- **How the harness chooses.** `tools/target.mjs` — **local by default**, `BF_TARGET=prod` to
  opt out deliberately. All 35 harnesses route through it and every run prints its target.
  Content flows prod→local ONLY; code flows local→prod ONLY.
- **The suites have their own identity: `Tester Assistant`** (role 3, password in the
  gitignored `.env` as `BF_SUITE_PASSWORD`, never in repo code). The MCP bridge keeps
  `DM Assistant`. This is NOT for parallelism — `preflightSoleGM` still aborts when more
  than one GM-capable client is connected, because the elect picks exactly one. It is for
  DETECTABILITY: sharing one account made a bridge/suite collision unreadable, because
  **both `game.users` and `/api/status` count USERS, not sockets** (measured — a bridge and
  a suite connected simultaneously still reported `users: 1`). That is finding ⓪'s blindness
  aimed at the test harness, and it cost a confusing 9-failure concentration run.
- ⚠⚠ **A FILE DEPLOY IS NOT ENOUGH AFTER A VERSION BUMP.** Foundry registers `module.json`
  at PROCESS BOOT. Deploy v1.15.0 files while the process still registers 1.14.0 and it keeps
  vending the old version as the script cache key — a MIXED code state that produced bizarre
  half-failures (concentration 42/47, effects fatal) which vanished on restart. A world reload
  suffices for script edits with NO version change; a version bump needs the process bounced.
- **Restarting it:** close gracefully with `CloseMainWindow()` — **never `Stop-Process`**, the
  LevelDB is at risk — relaunch **minimized** (user's ask: *"so my screen isnt spammed"*),
  then launch the world over HTTP with `LOCAL_ADMIN_KEY` (`POST /auth` adminAuth → `POST
  /setup` launchWorld) and poll `/api/status` until `active`.
- ⚠ **A refresh overwrites the module under test** — re-run
  `node scripts/deploy-house-module.mjs fvtt-mod-battleflow --local` after every pull, unless
  the version you want is already what prod carries.
- ⚠ **The battery must start with `smoke-battleflow`** — it builds the test scene, actors and
  tokens every other suite assumes. Two mid-session failures were nothing but missing fixtures.
- **What it bought:** connects are instant (no Molten wake), and the ~5-minute front-cache
  quiet period per deploy is GONE. That wait cost ~15 minutes in one session and twice caused
  reasoning against stale code.

### ✅ THE v1.15.0 WALK — COMPLETE (2026-08-19, in the SANDBOX)

The user walked it in the local sandbox and confirmed **every fix**, in this order: ⑤ Innate
Sorcery, ① the Topple/concentration collision, ② the announcing success, ③ no doubles,
④ the duration sweep, and the two sanity-checks (Life Drain ×2, Bane ×2) as NOT REPRODUCING
— note those two had NO code change, so "fixed" means the clean single-GM room removed the
elect contamination that most likely caused them. Re-open them if they ever recur.

**The walk raised ONE new finding, fixed and confirmed in the same session:**
- **⑥ A reaction already standing was offered again.** Gren was re-prompted for Shield with
  his +5 active. `findInterrupt` never consulted `hasReactionEffect` — the helper the ANSWER
  path had used since v1.8.0 to avoid double-applying; only the eligibility side never asked.
  User's call, verbatim: *"if they have shield up, just dont prompt for shield."* Narrow on
  purpose and both limits are load-bearing: **`ac` kind only** (an AC bonus does not stack,
  while Absorb Elements resists the TRIGGERING type and deserves the next ask) and **the
  attack trigger only** (a standing Shield already grants "no damage from Magic Missile", so
  skipping the hold on the negate path would apply damage to someone IMMUNE to it — that fix
  would have been worse than the bug). Deliberately independent of `reactionSpent` and of
  combat rounds, per the user: *"we dont have timers and combat rounds yet"* — which is also
  why the repro worked out of combat, where `reactionSpent` is never set at all.
  smoke-hold §4a2 pins it, asserting the effect is verifiably UP so a fixture that never
  raised it cannot pass by proving nothing.

### ✅ THE CARRY-OVER WALK — CLOSED CLEAN (2026-08-19, the geometry session)

**The geometry debt is paid.** Items ①–④ had carried UNWALKED across three sessions (the
18th was live play; the 19th's first session walked only the v1.15.0 fixes). The user
worked the whole list in one pass and it produced **ZERO findings** — the first walk in
seven rounds with nothing to fix. No code was written. No release followed.

| | Item | Outcome |
| --- | --- | --- |
| ① | The Salyth re-test, dialog path | ⛔ **Closed as NOT A CONCERN** — user ruling. ⚠ **Recorded honestly: NOT walked, NOT verified.** The spell-true containment fix (v1.14.0) remains suite-covered but never table-confirmed on this path. If area geometry is ever suspected again, this is the untested seam — start here. |
| ② | Instantaneous cleanup | ✅ **CONFIRMED at the table.** Fireball/Shatter templates leave the canvas by themselves once saves resolve and damage lands. |
| ③ | The TOOLBAR path | ✅ **CONFIRMED at the table.** Bare cast waits for its area, the toolbar-drawn cube claims it, rows come from the DRAWN area. This was the oldest never-walked-live item on the file — **v1.13.0's finding ① is finally table-verified**, two releases after it shipped. |
| ④ | Big-token sampling | ✅ **CONFIRMED at the table.** A 2×2 creature half inside an area is demanded — the corner center-only testing missed before v1.14.0. |

**Two questions closed as RULINGS in the same session, neither one code:**
- **The concentration popup for offline-owner PCs — RULED FINE, question closed.** It had
  been open as a CHECK since 2026-08-17 (does the ask still pop the GM for a PC whose owner
  is offline?). The user's call: *"this is fine remove from list."* The behaviour is
  ACCEPTED AS-IS — the two-line `isGM && hasPlayerOwner` gate that saves.js and mastery.js
  carry is **deliberately NOT extended** to concentration.js. Do not re-raise it, do not
  "harmonize" the three machines on a tidiness argument. Still true and still fine: the
  conc buzzer ROLLS on expiry, so nothing goes unresolved either way.
- **Thomas A. Invictus at 16/36 HP — GAMEPLAY, not a defect.** He is Life Drained and
  **resolves it via PLOT**. `maintain-party.mjs` did its job; the long rest is not broken;
  there is no tempmax/Hollowed bug here. ⚠ **Do not "fix" this actor's HP** — it is a
  story state the user is running deliberately.

### ✅ THE v1.16.0 WALK — CLOSED CLEAN 2026-08-19 (7 of 7, zero findings)

Walked in the sandbox by the user in one pass. **Do not present this list again.** Every item
confirmed at the table: ① the target block on the attack path (look, size and spacing all
judged fine; no warning icon on the ally, as designed) · ② the same block on the spell/item
path · ③ the zero-target "No targets" in damage red · ④ live re-target repainting under an
open dialog ("NICE") · ⑤ temp HP as `+N temp HP` in blue · ⑥ the DM's quiet with the player
logged out, and the Answer button still raising the popup · ⑦ no Riposte hold offered on a
melee hit.

**The question the walk existed to answer:** a consumable **DOES** raise a dialog, and it looks
the same as a spell's. So the target decoration reaches potions, the folded FLOW item 4 never
un-folded, and its reversal trigger is permanently dead. See FLOW.md item 4.

⚠ **One half of ⑤ was not walked and is NOT a finding:** the COMBINED case
(`−3 HP · +4 temp` on a hit that both damages and grants) was left to come up naturally. The
grant-only case is confirmed.

### ✅ THE POTION WALK — CLOSED CLEAN 2026-08-19 (tested, then released)

The user walked the potion default in the sandbox and reported *"tested and looks good"*, then
authorised the full release cycle. **Do not present this list again.** Shipped as **v1.17.0**.

⚠ **The one taste question was answered by silence, not by a ruling:** the drinker STAYS
TARGETED on the canvas after drinking. It was called out in the checklist as the thing to
judge, the user walked it and raised nothing. Treat it as accepted-as-shipped — but if it ever
starts to grate, clearing the target on completion is a small change and this is where the
decision was made.

### ✅ THE PROD BOUNCE — DONE AND VERIFIED 2026-08-19

The user restarted the Foundry process from the Molten hosting panel. Verified straight after:
**`game.modules.get('fvtt-mod-battleflow').version` reads 1.17.0** and
`BF_TARGET=prod node tools/verify-settings.mjs` reports **CLEAN**. Prod was idle throughout.
**Nothing is owed to prod. Do not re-raise the bounce, the version drift, or `Riposte:ac`.**

⚠ **The lesson that outlives this, and it is the reason the drift reached THREE releases:**
a file deploy is only half a prod release. Foundry reads `module.json` at PROCESS BOOT, and
**the bounce cannot be scripted** — prod's `/setup` returns **403** to an authenticated admin
session, so a script can shut the world down and then fail to bring it back. **Never attempt
it from here.** Every future version bump ends with the same handoff to the user: bounce from
the Molten panel, then verify the registered version. Budget it into the release, do not let
it accumulate again.

### 🧪 STILL ON THE SHELF — PHASE 4, THE EXPERIMENT (not next; needs table time)

Chosen at the recut as the cheapest real answer now that the walk debt is clear. **This is
an EXPERIMENT, not a fix pass — the expected outcome is ZERO code.** Phase 4 is turn-time
truth (durations ticking, areas re-evaluating as tokens move on their turn). The question
it has to answer first is whether dnd5e 5.3.3 already does enough of it natively that the
module should stay out.

Present this, wait, aggregate, act only on "go" (the header's standing cycle). The settings
table above is law — no settings changes needed. **Every client F5 once** before starting.
⚠ **ONE GM-capable client** — no bridge, no scripts, no suites running alongside.

1. **Cast Bless and watch ten rounds.** Roll initiative with the party + something to
   fight. Note, per round: does the duration tick down on its own? Does it announce
   anything? Does it EXPIRE on its own at round 10, or does it sit there forever until
   somebody deletes it by hand?
2. **Concentration through the rounds.** With Bless up, take a hit — does the
   concentration ask fire on schedule, and does breaking it clear Bless from every target
   (the cascade), or does it strand chips behind?
3. **A standing area, over time.** Leave a Web (or Faerie Fire) region up and MOVE a token
   into it mid-combat, on that token's turn. Does it join the demand? ⚠ Known and
   deliberate: containment is **semi-live** — a token entering a standing area joins only
   when a card re-render runs the floor. If it only picks up on the next render, that is
   the RECORDED behaviour, not a finding. Phase 4 exists precisely to decide whether
   turn-time truth is worth owning.
4. **The verdict question, for the user to answer out loud:** after ten rounds, does
   anything actually feel MISSING? If native durations carry the weight, Phase 4 closes
   as a RULING (no code) and the plan advances to Phase 5 — the adopt-AC5e decision.

### 🔧 The Clear + Full Rest macro — SANDBOX DONE, PROD PENDING (2026-08-19)

⚠⚠ **THIS IS THE ONE THING LEFT UNFINISHED THIS SESSION, AND IT IS NOT CODE.** The user asked
for the GM-bar macro **Clear Temp Effects (Scene)** to ALSO do a full rest, on BOTH worlds.
**Sandbox: applied and verified. PROD: NOT APPLIED.**

**What it is now:** renamed **Clear Temp Effects + Full Rest (Scene)**, same document id
`8ablqYRiKDOEWLPz`, still pinned to **Matt the DM slot 2**. Updated **IN PLACE** — a
delete + create would silently unpin the hotbar button, which is why the applier never does that.

**Scope is EVERYTHING ON THE SCENE, monsters included** — the user's explicit choice when asked
(the alternative offered was PCs-only). It restores NPC spell slots, features, hit dice and
legendary resistances too. **That makes it the wrong button to press mid-fight on prod**;
consider a distinctive icon before it lives next to the things pressed in a hurry.

**In the repo, so it survives a session:**
- [tools/macro-clear-and-rest.js](tools/macro-clear-and-rest.js) — the macro body, verbatim.
- [tools/apply-macro-clear-rest.mjs](tools/apply-macro-clear-rest.mjs) — writes it in place.
  `node tools/apply-macro-clear-rest.mjs` for the sandbox, `BF_TARGET=prod …` for prod. It
  **REFUSES to write to prod while any other user is connected** and it never EXECUTES the macro.

**⏸ WHY PROD IS PENDING:** prod went from **0 users to 1** between the status check and the
write, so the tool's own sole-occupancy guard bit. `/api/status` gives a count, not names, so who
it was is unknown. (The guard is about writing to a world someone else is using — NOT the retired
*"bridge never connects during live play"* rule, which the block at the top of this file corrects.)
**To finish: confirm prod is idle, then `BF_TARGET=prod node tools/apply-macro-clear-rest.mjs`.**
Do not execute the macro on prod to test it — read the document back instead; the behaviour is
already proven on the sandbox.

**Two 5.3.3 facts this bought, both load-bearing:**
- **`longRest()` defaults `dialog: true`** — without `{ dialog: false }` it pops one rest
  configuration dialog PER ACTOR, which on a populated scene is unusable. `chat: false` too, or
  every actor posts its own rest card.
- **`initiateRest` returns `undefined` when it BAILS** (a vehicle, or any module vetoing
  `dnd5e.preLongRest`) and an object when it actually rested. The first version counted the bail
  as a success and reported *"long-rested 2 of 2"* for a rest that had not happened. **Count the
  return value, never the absence of a throw.**

⚠ **A TEST TRAP worth remembering — it produced three false failures.** The Test Range's tokens
are **UNLINKED**, so `token.actor` is a SYNTHETIC actor with its own uuid (its name is the
token's — "Hobgoblin" — not the base actor's "BF Test Victim"). A verification that sets HP on
the sidebar document and reads it back sees nothing move, and blames the macro. **Assert on the
token actor — that is what anything scene-scoped actually operates on.**

⚠ **Gren Greenmantle rests to 23/26 and that is FULL for him** — the `Hollowed` effect carries
`system.attributes.hp.tempmax -3`, so his `effectiveMax` is 23. **User's ruling: max-HP loss from
a wight, campaign content, not a bug.** Use `hp.effectiveMax`, never `hp.max`, in any assertion
about a party member being "topped up".


### 📦 Deploy + battery state — v1.18.0 (2026-08-19, FIFTH session)

⚠ **BUILT, NOT RELEASED.** No tag, no GitHub release, **prod untouched and still on 1.17.0.**
The sandbox has it: deployed over the local path, **process-bounced by Claude** (graceful
`CloseMainWindow()`, minimized relaunch, world launched over HTTP) and
`game.modules.get('fvtt-mod-battleflow').version` reads **1.18.0** — verified after the bounce,
not assumed. `playerRollDamage` registers, scope **client**, value **false**.

**Battery on the sandbox with the change in, all green:** battleflow ALL PASS · hold ALL PASS ·
cast 17/17 · riders 8/8 · effects 46/46 · concentration 47/47 · saves 49/49 ·
`verify-settings` **CLEAN** (re-run after the bounce, still CLEAN).
Plus **`probe-player-damage` 9/9** (new, committed).

✅ **The hold trap was dodged by ORDER, not luck** — `hold` ran STANDALONE immediately after
`smoke-battleflow` and passed first time. Third session running, the documented fix holds:
**battleflow → hold → everything else.**

✅ **`check-hook-order` was run, and it EARNED ITS KEEP.** A static `import ... from "./ui.js"`
in auto-damage.js MOVED the evaluation order — the entry reaches auto-damage through
polish.js → hold.js, before hold reaches its own ui import, so ui.js's renderChatMessage and
deleteChatMessage registrations ran ahead of auto-damage's. All four load-bearing assertions
still passed, so it would have shipped silently. Converted to a **lazy `await import()`** inside
the function (hold.js and saves.js keep the same discipline) and the order is now **byte-identical
to HEAD, diffed both ways**. Keep it dynamic.

⚠ **A NEW 5.3.3 DECOY, and it cost a probe run:** `D20Roll#isCritical` is
`this.d20.isCriticalSuccess`, which reads the **D20Die TERM's** `options.criticalSuccess`. The
ROLL also carries `options.criticalSuccess` — present, numeric, entirely plausible, **read by
nothing**. Setting it changes no answer. Recorded in design.md §7 and pinned by
`probe-player-damage` assertion 9 so it can never cost a second run.

⚠ **A second target needs a second ACTOR, not a second token** — descriptors key on the actor
uuid, so two tokens of one linked actor collapse to a single snapshot row and "one popup for two
targets" is unanswerable. Same shape as the Practice Dummy trap. The probe creates a hidden
`BF Probe Second Target` at AC 1 and deletes it in teardown.

⚠ **The sandbox is on Foundry 14.365** (this file said 14.364 through v1.17.0). Noticed, not
chased — nothing in the battery moved.


### 📦 Deploy + battery state — v1.17.0 (2026-08-19, FOURTH session)

✅ **RELEASED AND DEPLOYED.** Tagged `v1.17.0`, pushed, GitHub release carries zip + bare
`module.json`. Prod deployed over WebDAV and byte-verified — **17 files md5-matched, prod
IDLE at 0 users**. The SANDBOX was deployed and PROCESS-BOUNCED and now registers **1.17.0**.
✅ **Prod was bounced by the user and verified reading 1.17.0**, with prod `verify-settings` CLEAN.

**Battery on the sandbox with the change in, all green:** battleflow ALL PASS · cast 17/17 ·
riders 8/8 · effects 46/46 · hold ALL PASS · concentration 47/47 · saves 49/49 ·
`verify-settings` **CLEAN**. Plus `probe-potion-selfaim` 5/5.

⚠ **`hold` aborted on the first pass and it was NOT a regression** — it died in setup with
"BF Test Victim has no token", before any assertion, because a suite between it and
`smoke-battleflow` strips that fixture's token. Re-running `smoke-battleflow` and then `hold`
STANDALONE is the documented fix and it passed clean. This is the third session this trap has
cost time; **run `hold` standalone after a fixture rebuild, always.**

⚠ **The sandbox was relaunched from a COLD PROCESS this session** (the user closed the whole
app, not just the window), so `module.json` re-registered at boot and the box is cleanly on
1.16.0. Launch dance used: `Start-Process ... -WindowStyle Minimized`, then the world over HTTP.
⚠ **The HTTP world launch needs a SESSION first** — `GET /auth` to get the `session` cookie,
THEN `POST /auth` adminAuth, THEN `POST /setup` launchWorld. Skipping the GET returns the setup
HTML from /auth and then a 403 from /setup, which reads exactly like a wrong admin key and is
not. Script kept at the scratchpad path; the admin key is `LOCAL_ADMIN_KEY` in the MCP `.env`.

⚠ **TWO NEW PROBE TRAPS, both cost a run:**
- **A template-bearing activity's `use()` NEVER RESOLVES** — it parks waiting for a human to
  place the template. A plain `await` on it hung a probe past its watchdog. **Race every use**
  (`Promise.race([act.use(...), sleep(n)])`), and delete any template it leaves behind.
- **Party Camp's two Practice Dummy tokens SHARE ONE ACTOR**, so `getTargetDescriptors` keys
  them to a single uuid. Any "did the other target survive" assertion is unanswerable on that
  scene until a distinct throwaway bystander actor exists. Create one, delete it after.


### 📦 Deploy + battery state — v1.16.0 (2026-08-19, THIRD session)

✅ **PROD IS DEPLOYED.** The release is cut, tagged `v1.16.0`, the GitHub release carries zip
+ bare `module.json`, and prod received all 17 files byte-identical over WebDAV. Prod was IDLE
(0 users) — no live table was touched. `Riposte:ac` struck on prod as well; `verify-settings`
against prod reads CLEAN. The new code was verified **as served by the running box**, not just
as bytes on disk: `polish.js` and `ui.js` fetched through prod carry the target block, the
usage-dialog hook and the `hasPlayerOwner` quiet.

~~⚠⚠ **PROD'S PROCESS REGISTERS `1.14.0` AND WILL UNTIL SOMEBODY RESTARTS IT.**~~ ✅ **RESOLVED 2026-08-19 — the user bounced the box from the Molten panel and it now registers 1.17.0. Kept because the REASON still binds:** Not 1.15.0,
not 1.16.0 — that box has not booted through two releases. Foundry scans the package registry
at PROCESS BOOT, and **no tooling can bounce a Molten box**: `register-module.mjs` states it
plainly — a WebDAV drop plus a world shutdown/relaunch never registers. **Restarting it is a
Molten control-panel action and belongs to the user.** Nothing is broken by the staleness; the
code is live and serving. What it costs is the version STRING (and with it the manifest's idea
of what is installed).
⚠ **Every client that had the world open needs ONE HARD refresh** (Ctrl+Shift+R) — a window
runs whatever code it loaded, and a stale window holding the elect runs old code for everyone.

**The SANDBOX is fully on v1.16.0** — deployed byte-identical, process gracefully closed and
relaunched, world relaunched, and its registry verified reading `1.16.0` with the module
active. `interruptList` verified with Riposte gone.

**Battery on the sandbox at v1.16.0, all green:** battleflow ALL PASS · cast 17/17 ·
riders 8/8 · effects 46/46 · hold ALL PASS · concentration 47/47 · saves 49/49 ·
`verify-settings` **CLEAN**.

⚠ **THREE HARNESS TRAPS THIS SESSION COST REAL TIME — do not re-derive them:**
- **The local Foundry DIED TWICE mid-session**, both times under repeated Playwright probe
  connections, and both times it read as "my code is broken" before `curl /api/status` showed
  the process simply gone. **Check the sandbox is alive before believing a probe failure.**
  Relaunch is the documented dance: graceful `CloseMainWindow()` (never `Stop-Process`),
  relaunch MINIMIZED, then launch the world over HTTP.
- **A roll dialog takes ~9 SECONDS to auto-render in the Playwright sandbox** (Chrome
  throttles timers in a backgrounded page). Fixed waits of 700 ms and 3 s both found nothing
  and read exactly like a dead hook. **Poll, never sleep a guess.** Also
  `rollAttack(..., {configure:true}, ...)` never resolves — it is waiting for a human — so it
  must be fired and left pending.
- **Suites run BACK-TO-BACK with no gap corrupt each other.** A tight `for` loop produced
  `effects 43/46` twice; standalone it is `46/46` every time. Both `game.users` and
  `/api/status` count USERS not SOCKETS, so two overlapping suite sessions on the one
  `Tester Assistant` account are INVISIBLE and contest the elect. **Leave a settle gap
  between suites**, and re-run `smoke-battleflow` whenever another suite reports a missing
  fixture.

### 📦 Previous deploy state (v1.15.0)

**State at handoff (2026-08-19, end of the fix-pass session):** the v1.15.0 three-commit
train is pushed (test → feat tagged v1.15.0 → docs) and the GitHub release carries zip +
bare module.json. **PROD is deployed and byte-verified** — every script md5-matched against
the repo, `module.json` on the box reads 1.15.0 (the running process keeps vending the old
string until its next natural restart; expected, not a failure). Prod was idle at deploy —
no live table was touched. **The SANDBOX was then refreshed from the new prod**
(`pull-prod-to-local.mjs`: 382 files, 151 deletions, world DB integrity verified) and
relaunched; its registry and served manifest both read 1.15.0, `smoke-battleflow` ALL PASS
and `verify-settings` CLEAN on the refreshed copy.

Battery on the sandbox, all green at v1.15.0: battleflow ALL PASS · hold ALL PASS (incl. the
new §4a2) · cast 17/17 · riders 8/8 · concentration 47/47 · effects 46/46 · saves 49/49.
`shimFactor` still logs **1.400** on 14.365 — the upstream v14 region-shim defect reproduces
locally and has NOT healed.

⚠ **The walk session that followed changed NOTHING about the above** — no code, no deploy,
no version bump, no suite run. Prod and the sandbox are both still exactly as that fix-pass
session left them, and the battery numbers above are still the current ones. The only
artifacts of the walk are the closures and rulings recorded in this file.

⚠ **Loose ends the next session should know:**
- ~~**Thomas A. Invictus reads 16/36 HP**~~ — **CLOSED as GAMEPLAY (2026-08-19).** He is
  Life Drained and resolves it via plot. Not a `maintain-party.mjs` bug, not a tempmax
  interaction. ⚠ Do not "fix" it and do not re-flag it — a future session seeing a PC
  short of full HP after a rest should check the fiction before the code.
- The **BF Test Shielder fixture** had picked up the campaign's **Hollowed** effect
  (`hp.tempmax -3`), which made `hp.max` a lie about "whole" and failed two smoke-hold
  asserts for a night. Stripped from the FIXTURE only — the live PCs keep theirs, that
  call is the user's. smoke-hold now snapshots `effectiveMax`.
- The **upstream shim defect stays UNFILED as a RULING** (user, 2026-08-17: "no to
  upstream bug report, they will never read it") — do not offer again.
- **`keepId` is silently vetoed for the assistant-role bridge** and the create resolves
  null — a suite that trusts it asserts against phantoms (cost an hour on 2026-08-19).
  Same shape: an ActiveEffect create whose `origin` uuid does not resolve is nulled too.

### Where the plan points now (2026-08-19 — post-v1.15.0)

**Six feedback rounds are closed** — the sixth is the 2026-08-18 live session's ①–⑦ at
v1.15.0 (the disposition table above); the first five were
the dogfood sixteen at v1.9.5/v1.10.0, round two
at v1.10.0, the v1.10.0 walk's ①–⑥ at v1.11.0, the v1.11.0 walk's ②–④ at v1.12.0, the
v1.12.0 walk's ① at v1.13.0. Resolution maps live in this file's git history and in
design.md's amendments. Closed as a RULING, not code: **Ⓓ1 — GM required for full
functionality** (design.md §8 keeps the full itemization). **ALSO CLOSED as a RULING
(2026-08-19): the concentration ask popping the GM for offline-owner PCs.** It ran open
as a CHECK from 2026-08-17; the user ruled it *"fine"* and struck it from the list. The
asymmetry is now DELIBERATE and load-bearing: concentration.js gates on concMode +
canAnswerFor only, while the `isGM && hasPlayerOwner` quiet lives in saves.js and
mastery.js alone — three machines, two behaviours, on purpose. ⚠ Do not extend the gate
to concentration on a consistency argument; it was offered and declined. What
remains open:

- **⑭ The year-off timestamps — RETIRED** (user call, the v1.12.0 walk: "stop
  watching"; three sessions clean). Two cards on 2026-08-16 rendered "11m 364d ago"
  among correctly-stamped neighbors; the module passes NO timestamps (grep-verified),
  the bridge's clock measured exact, the probe could not reproduce, and it never
  recurred. Not carried on any walk list anymore. If it EVER resurfaces: hover the card
  for its real date and note which USER authored it — the message's creating client
  stamps the timestamp, so the author names the broken clock.
- **Phase 4 is now ON DECK as the next session's checklist** (see its section above) — it
  stays an EXPERIMENT first: cast Bless, watch ten rounds, likely zero code. It got the
  slot because the walk debt cleared and nothing else is owed. **Phase 5** stays the
  adopt-AC5e decision and follows Phase 4's verdict. **Two-client save coverage** is no
  longer hypothetical — `probe-popup-topology.mjs` (NEW at v1.11.0) is a working
  two-client harness (PC Assistant casts, the GM observer ledgers every hook, dialog
  render, and DOM state); growing it into a suite is the natural next step if
  cross-client regressions worry anyone.

⚠ **STALE HEADLINE, KEPT FOR ITS LIST** — "Tuesday is live play" meant 2026-08-18, which
has HAPPENED (it is the session whose ①–⑦ v1.15.0 answers). The changelog below is written
as of v1.13.0 and does not include v1.14.0's containment fix or v1.15.0's convergence
work; read it as a snapshot, not as current. What follows is still the best single list of
what the PLAYERS notice:

v1.13.0 clears battery-green. Player-facing changes since the
table last sat (cumulative v1.11.0 + v1.12.0 + v1.13.0): SELF abilities (Second Wind,
Divine Favor) apply to their user no matter what's targeted; every timer runs 15s; a
multi-target save card drains a bar under every pending row; Web-class spells no longer
roll their situational damage at cast; the pressed Prone chip names its attacker; an
area spell cast bare WAITS for its template and demands saves from whoever the placed
area contains (full window from placement) — and since v1.13.0 the plain TOOLBAR-drawn
cube/cone/line counts as that template (the walk's finding ①: only dialog-placed areas
ever tied before, and cubes had no geometry at all); every card button except Refund
Resource is hidden; and an offline player's PC resolves its saves by timer without
popping the GM.
**Every connected client needs to log back in** — the box was bounced for the install.

**World content, fixed this session (not module code):** Thomas's Divine Favor and
Salyth's Thaumaturgy both arrived from the DDB level-1 import with their embedded
ActiveEffects stripped (activity → ghost effect id). Both grafted back from the PHB
compendium (`dnd-players-handbook.spells`) — full party audited, 42 spell copies checked,
those two were the only casualties. The DDB import path is condemned: a standing TODO in
fvtt-mcp-molten5e (`docs/TODO-remove-ddb-import.md`) says remove it and refuse future
DDB requests. `tools/maintain-party.mjs` (NEW) strips temporary actor-level effects and
long-rests the five PCs — the post-testing reset, run on demand; the party was left
clean, rested, and full-HP.

**Struck: the second Molten box** (user, 2026-08-16: "we cant have a second box so strike
that for now"). The full provisioning plan lives in this file's git history (section "the
second Molten box", ≤ v1.6.0) if it ever returns. ⚠ **SUPERSEDED 2026-08-19:** suites no
longer run on prod by default — the LOCAL SANDBOX is the test environment (its own section
above), which is what the struck second box was ever needed for, at no cost. A prod run is
still possible with `BF_TARGET=prod` and still has to take turns with the table — check
who's connected before yanking clients.

**Leftovers, all deliberate, none blocking** — so the next session treats reports against
these as design conversations, not bugs: legendary resistance on a CONCENTRATION save
still arrives too late (2.5's recorded corner — the SAVE machine's LR overturn shipped at
v1.7.0, but concentration's fold is its own machine and still cascades before a flip);
a sheet-rolled concentration save's card colors against DC 10 while the verdict judges
the real DC; a human pressing the damage tray early still beats a pending hold (a
ruling); hopeless skips are silent by design (the dead, the speedless — twice mistaken
for bugs on 2026-08-16, so say so early if it recurs); the save machine's own corners
are standing item 15's list (multi-ability first-listed, consumed-item effects, dead
targets still roll, conc-ask deference, no announcement cards); a LISTED reaction never
self-aims (the v1.11.0 carve-out — Shield through the hold machinery only, so a
no-hold Shield cast is a tray click, by design); a never-placed template leaves its
demand quietly WAITING on the card forever (v1.12.0 — no rows, no clock, deliberate);
a token entering a STANDING area joins the demand only when a card re-render runs the
containment floor (semi-live, not turn-based — Phase 4 owns turn-time truth); the
toolbar claim (v1.13.0) serves the NEWEST waiting cast only — an older same-activity
bare cast waits forever even as areas land (one area, one demand); a claim reaches the
elect's CURRENT scene only (a toolbar draw on another scene adopts nothing — the
dialog-placement path still works cross-scene); a SECOND cube drawn while a claimed one
stands is ignored until the first is deleted (re-place or move the first instead); the
concentration ask still popups the GM for offline-owner PCs PER SOURCE (finding ④'s
deliberate non-extension — **RULED FINE and CLOSED 2026-08-19**: no longer a check, no
longer a candidate fix, do not offer the gate again); "cast with no GM logged in, nothing
applied" is the Ⓓ1 ruling working as designed; **a placed template DRAWS oversized on
this 140px grid** (the v14 shim renders the corrupted field — the DEMAND is spell-true
since v1.14.0, the PICTURE is upstream's lie: report "the cube looks fat" as known,
"the wrong people saved" as a bug); and **the dialog path and the toolbar path answer
different truths by design while the shim lies** (dialog = spell-truth via the honest
dimensions flag; toolbar = screen-truth — no flag exists to rescue it). *(Graduated at
v1.11.0: "self-buffs stay tray clicks" is DEAD — SELF-tagged activities self-aim now,
finding ①.)*

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
   ⚠ **Apply-before-answer, NARROWED at v1.6.0.** The promised "Phase 2/3 owning non-attack
   damage application" arrived: a damage-activity roll aimed at targets is claimed at birth
   (`spellDamage`; a BLOCKLISTED spell's roll also gets `spellHoldPending`) and the elect's
   applier (`applySpellDamage`, under Auto-Apply Damage) defers on the claim until the hold
   resolves, then applies per verdict — negated targets skipped, per-target independence.
   The caster clears the claim when no hold stamps (nobody eligible); a roll made AFTER
   resolution falls through and applies immediately. Only a HUMAN pressing the tray early
   still beats a pending verdict — a ruling, not a race — and the veto still refuses
   negated targets on any manual path (origin walk, plus a v1.6.0 whole-log fallback by
   spell + actor for unbridged rolls).
   ⚠ **The usage card is load-bearing again, and permanently (v1.10.0).** The v1.6.0
   replacement-bfCard bus (`postSpellHoldCard`) and its damage bridge existed only to
   survive suppression; with the machinery ripped out, the native card is ALWAYS the
   hold's home. What survives of that era: the claim/defer/release chain (`spellDamage` /
   `spellHoldPending`, released by the caster when nobody holds and by the resolution
   for chained rolls) and the veto's whole-log fallback for genuinely unbridged rolls.
   smoke-hold §6f now owns exactly that chain on the native card.

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
   three effect appliers — *that unification happened at v1.8.0 exactly as this review
   predicted*: grown out of `applyEffectRiders` (`applyEffectsTo` + `joinEffectReceipt`),
   with the reaction receipt/revert closed and only the mastery applier left separate, by
   recorded policy.
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
   ⚠ **SELF-tagged activities SELF-AIM since v1.11.0** (user call, finding ① — supersedes
   v1.5.1's "self-buffs stay tray clicks"): `affects.type: "self"` ⇒ the caster IS the
   target, the UI snapshot is ignored, no target is required (Second Wind heals its
   fighter, Divine Favor lands on its caster; the heal-roll stamp carries the self
   target on the flag). BLANK affects still disqualifies. The carve-out is what survives
   of v1.5.1: a LISTED reaction with holdApplyEffect on never self-aims — **Shield is a
   utility-with-effects cast**, and the first battery with castApply ON caught the slice
   stacking a second +5 on the reaction machinery's own application (+10 AC, two chips).
   smoke-hold pins castApply ON permanently as the coexistence net; smoke-cast §6 pins
   self-aim (wrong-target, bare-cast, utility) and the carve-out itself.
   ⚠ **Damage-spell cards are suppressible spam since v1.5.1 — ALL of them since v1.6.0.**
   The blocklist keep-gate is lifted: the re-plumb was built (standing item 2's v1.6.0
   notes — replacement card, damage bridge, veto fallback). A damage card carrying
   EFFECTS still survives: no automated path applies a damage-spell's effects.
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
   canAnswerFor) because **the native `[[/save]]` enricher rolls for whatever token is
   SELECTED** — which right after an attack is the ATTACKER, so the GM rolled Morgash's
   save at the dummy's topple and the fold rightly ignored it (bit live 2026-08-16; the
   evidence was trash-cleared chat, so it was reconstructed from the screenshot's
   selection ring). The enricher stays for tables that select first.
   ⚠ **The topple ask has its POPUP since v1.6.0** (user: "the GM didn't get a popup —
   the cards are difficult to follow"): the concentration ask's exact surface (situational
   bonus + Advantage/Normal/Disadvantage, every button rolls with `configure: false`,
   chained to the card), shown once per pending target on the decider's client
   (`shownToppleAsks`); the card's Roll button now RECALLS the popup — one input surface,
   the popup decides, the card recalls. No timer in v1: the GM's manual prone button is
   the backstop for paper rolls.
14b. **The verdict pause (v1.5.1).** `dramaticVerdictPause`: the concentration fold and
   the topple failure wait out Dice So Nice's animation (when present) plus the Dramatic
   Beat before their table-facing consequences — the break card, the cascade, the prone.
   The MECHANICS never wait: flags are written and timers disarmed first, so the buzzer
   cannot double-fire into the pause; the ask row's verdict text updating early is the
   accepted residue.
15. **The save machine (v1.7.0), and its recorded corners.** ⚠ Since v1.11.0 (finding ③):
   **`damage.onSave: "full"` on the save activity is RIDER damage** — the system's own
   PHB data nests situational damage there (Web's burn 2d4) — and the demand stamps NO
   damage dimension for it: `hasDamage: false`, no auto-roll, and the reconcile refuses
   ALL chained damage on such a demand (the enricher-click side door). The card's
   enricher stays clickable through the native tray. smoke-saves §9. Also since v1.11.0:
   a bar under EVERY pending row (finding ④ — same absolute deadline each). ⚠ Since
   v1.12.0: a targetless TEMPLATE cast stamps a WAITING demand (zero targets, window
   without deadline, `awaitingTemplate`; the card says so; adoption fills it and arms
   the clock from that moment — smoke-saves §10), and the GM's unsolicited popups are
   non-player-owned targets only (`isGM && hasPlayerOwner` gates the auto-show on save
   demands AND topple asks; the offline-owner PC rides the buzzer, the row reads
   "waiting on the timer (owner offline)" — smoke-saves §11).
   The flow: the casting client
   stamps `saves` on the save activity's own usage card (postUseActivity; DC, abilities,
   damageOnSave, effect names by outcome, per-target array) → popups on `canAnswerFor`
   clients (queued oldest-first per actor, like concentration; the per-client `saveAutoRoll`
   opt-out rolls silently on the deterministic roller instead) → the module's rolls answer
   by `respondsTo` + `saveFor` (exact — immune to the getSpeaker oldest-token trap); the
   native card's own buttons chain and fold; a bare sheet roll answers the oldest pending
   demand → the elect folds vs the STORED DC, waits out the verdict pause, then applies
   effects per outcome and damage per `damageOnSave` through the shared appliers.
   Consequences are per-target independent and order-independent: damage rolled early waits
   per target on its verdict; damage rolled late applies to already-done targets on arrival.
   ⚠ **The general damage-reconcile passes only touch targets whose consequence pass
   finished** (`applied`) — the verdict pause gates damage too; smoke-saves 3d caught the
   render path undercutting it pre-release. ⚠ **A manual receipt ↩ revert is never
   re-fought**: any receipt entry, reverted included, reads as "handled" — only the LR
   unwind re-applies, explicitly. Corners, all deliberate: multi-ability saves auto-roll
   the FIRST listed ability (the fold accepts any listed); a consumed item strands its
   effects; dead targets still roll (Phase 5 owns RAW auto-fail); bare rolls defer to a
   pending concentration ask; NO verdict announcement cards (the rows + receipts say it
   once); the demand's deadline is stamped on the caster's clock and the buzzer runs on the
   elect's — skew moves the buzzer, never the verdict.
14. **Mastery reminders (v1.5.0).** The elect posts a `masteryNotice` bfCard when Vex or
   Sap lands and when a Cleave-weapon hit lands (once per combat turn per attacker,
   in-memory latch on the elect; out of combat every hit reminds — the test range has no
   turns). The popup rides the card on whichever client `canAnswerFor` picks: ONE control
   (OK), hardcoded 15s auto-dismiss with the drain bar, `deadline` gating stale renders so
   an old log never nags. Not gated by `masteryAsk` — auto silences asks, not reminders.
   Design language recorded in design.md 1.9C: a reminder of a time-limited fact is a
   table moment; what stays banned is a fake choice and results dressed as popups.
16. **Cards keep their text; the machine keeps the workflow (v1.9.5 → completed
   v1.10.0, user calls).** The feedback walk recalibrated the suppression stance: the
   card's VALUE is its description, effects tray, and targets — its COST was the action
   buttons, a manual second path that forks the machine (a save button rolling for the
   SELECTED token; a damage button double-rolling). So `hideCardButtons` (world, default
   ON) hides every `.card-buttons button[data-action]` except the keep-list — **exactly
   `refundResource` since v1.12.0** (finding ②, the user's third ask: the v1.9.5 spec
   restored; the v1.10.0 `placeTemplate` exemption and v1.11.0's conditional
   template-standing machinery are deleted outright — the WAITING demand plus the
   cast-time placement prompt dissolved the containment-starvation rationale).
   Display-level and
   stateless; the handlers survive underneath, and the fold still ACCEPTS a native-button
   roll that sneaks through (popouts, other modules). The companion: the save machine
   auto-rolls its spell's damage at the stamp (chained to the card, so upcast scaling and
   `damageOnSave` ride the native plumbing) — with the button hidden, nothing else would.
   **At v1.10.0 the other half landed: the suppression machinery is deleted outright**
   (user: "we rip out the card suppression machinery, and we just have machinery to hide
   non-refund-resource buttons") — every use posts its first card, and `hideCardButtons`
   is the only card-shaping switch in the module. The settings collapse rode the same
   philosophy: ONE client checkbox (Center Popups), `holdView` and `saveAutoRoll`
   deleted outright, popups always the input surface, recall always fronts.
17. **Template containment is the target authority (v1.9.5, user call, both directions;
   made REAL on live clients at v1.10.0).** A save demand with a placed template takes
   its targets from the area: at the stamp (`results.templates` — postUseActivity fires
   after `_finalizeUsage`, so placement is already awaited), by ADOPTION when a
   matching-origin template appears later, and as the area moves/re-places — done entries
   keep their verdicts, pending entries outside drop **and their popups close (v1.10.0 —
   the close pass sweeps popups whose entry is gone and clears their shown-latches)**,
   arrivals join fresh. **A WAITING demand (zero targets — v1.12.0's targetless template
   stamp) is a customer too**: adoption fills it from the area and stamps the deadline
   from that moment (`window` was stored at cast, the clock starts when somebody can
   roll); a template over nobody leaves it waiting. ⚠⚠ **`results.templates` entries are ARRAYS, not documents**
   (5.3.3 ground truth, read from source after two live misfires): `#placeTemplate`
   pushes `drawPreview()`'s resolution — the raw `createEmbeddedDocuments` result — so
   the stamp must `.flat()` before the parent filter or every live placement silently
   falls back to the manual snapshot (that was the whole Shatter/Gren strand). ONE
   customer per refresh: the newest matching demand with undone targets (a demand's
   status never leaves "pending", so anything looser drags in every fossil card the same
   activity ever stamped — recast Moonbeam and yesterday's cards all match). Containment
   is center-point against the drawn shape when one exists, else document-geometry
   (ALL types since v1.13.0); `templated: true` marks adoption, `durationUnits` gates
   the spent-template sweep. Manual targeting stays the bus for template-less casts, and
   `tokensInTemplates` distinguishes "no template" (null → snapshot) from "empty
   template" ([] → nobody saves) on purpose.
   ⚠⚠ **v1.13.0 (the v1.12.0 walk's finding ①): every template type computes document
   geometry, and the toolbar draw is claimable.** Ground truths that were expensive:
   `templateShape`'s fallback was CIRCLE-only, and `createMeasuredTemplate` fires
   before the canvas computes `object.shape` EVEN ON A LIVE CLIENT — so a cube's rect
   had no shape at the only moment the fast-path looked, and the render floor never
   re-fired (renders only happen on re-render). The suite stayed green on its circle
   fixture while the live cube adopted nothing — §10 is recut to cube + origin-less
   rect so that gap cannot reopen. Geometry is CORE'S: the fallback calls the
   objectClass shape statics (grid-aware — this world runs `gridTemplates` ON, and the
   live re-test proved Euclidean math over-sweeps it: Salyth demanded from outside the
   drawn cube; deprecated since v14 until 16, one console warning per session, migrate
   to ShapeData when 16 lands; current-scene only — cross-scene falls to Euclidean).
   The CLAIM: a WAITING demand takes the newest
   origin-less template of its expected shape (`templateType` on the stamp →
   `CONFIG.DND5E.areaTargetTypes[type].template` — never hardcoded) on the elect's
   current scene, and WRITES `dnd5e.origin` onto it — stamp-once, then moves/re-place/
   spent-sweep ride the origin-tied path unchanged. `_stats.createdTime` READS NULL on
   this box (measured), so the created-after gate is best-effort and the current-scene
   restriction is the real fossil wall. The NEWEST-WAITING-CUSTOMER gate: among
   same-activity zero-target pending cards only the newest adopts (the walk's four bare
   casts × one cube = four popup sets without it). Pre-v1.13.0 cards carry no
   `templateType` and never claim — origin-tied adoption serves them unchanged.
   ⚠⚠ **v1.14.0 (the v1.13.0 walk's findings): SPELL-TRUTH supersedes drawn-shape-first
   while the v14 region shim lies.** The header's one-breath list and design.md's
   v1.14.0 amendment are the record: the CREATE round-trip scales stored `distance` by
   gridSize/100 and returns `width` as raw pixels, the renderer draws the same lie, so
   `honestDims` (flags.dnd5e.dimensions — shim-proof) now outranks the drawn shape and
   every doc-math branch for dnd5e-placed templates; adjustedSize emanations and
   toolbar draws keep the v1.13.0 ladder (screen-truth). Containment samples every
   occupied grid square per token (midi-qol's model). The spent sweep is a convergent
   done-card floor with a newest-cast fossil wall. smoke-saves §12 pins the geometry on
   a suite-built 140px scene (the 100px Test Range is the shim's exact blind spot —
   never trust a template-geometry assertion that only ran there), §13 pins the sweep.

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

⚠⚠ **The front cache serves module scripts briefly STALE after a WebDAV deploy — and the
cache key is the VENDED version string.** Foundry loads scripts as `saves.js?v=<version>`,
a front cache holds each key for minutes (measured >5), and the vended version only moves
on a process restart — so it sat at "1.3.1" from that release until v1.9.5's bounces,
meaning EVERY deploy all day shared one cache key and a suite launched seconds after a
deploy ran minutes-old code. This burned half a night chasing phantom failures (a
just-deployed fix "not working" = the previous build served; breadcrumbs "not printing" =
the pre-breadcrumb build served). Protocol now: **after a WebDAV deploy, wait a few
minutes before any suite, or use the staging install below when the result must be
deterministic.** Each fetch re-primes the TTL, so rapid deploy-test cycles never converge.

**The staging install** (the deterministic lever, proven v1.9.1–1.9.5): bump
`module.json`'s version, `tools/build-release.ps1`, upload zip + a manifest copy to the
box's own WebDAV under `Data/bf-staging/` (its `download` pointing at the zip's public
URL — Data files serve publicly at the world host root), then
`register-module.mjs --manifest https://<world-host>/bf-staging/module.staging.json`.
That is a REAL install through Foundry's own package installer + a world relaunch: new
version string ⇒ virgin cache key ⇒ guaranteed-fresh code, and the zip's own module.json
keeps the box tracking the GitHub manifest. Cost ~90s. Burn a patch number per diagnostic
build (v1.9.1–1.9.4 died this way, unreleased). The `bf-staging/` folder currently holds
the v1.9.5 copies; safe to delete or overwrite.

⚠ **Edit module.json with the editor tools ONLY** — a PowerShell `-replace`+`Set-Content`
pass mangled its em-dashes to mojibake mid-session (the ground truth about BOM/encoding,
re-learned); the Write tool restored it.

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

```bash
node tools/smoke-saves.mjs
```

⚠ **Run smoke-battleflow FIRST when in doubt**: it places the victim token the other
suites reuse, and smoke-effects §14's stray-token sweep — and smoke-saves' own sweep —
can legitimately have removed it ("BF Test Victim has no token" from smoke-hold means
exactly this, not a bug). Run smoke-saves LAST for the same reason.

⚠ **Every suite teardown restores SETTINGS FIRST, in its own guard** (fixed 2026-08-17
after it bit the user): the teardowns used to run one try/catch around the whole cleanup
sequence with the settings restore in the middle, so any earlier cleanup error silently
skipped it — a night of failed diagnostic runs left `autoDamage: off` + `dramaticBeat: 0`
residue on the live table, which then got mis-read as the user's own tuning. The user's
config is sacred; deletes and sweeps are best-effort. After ANY test session, verify the
world settings against the reference table above.

⚠⚠ **A crashed run LAUNDERS its pins into the NEXT run's "prior"** (measured 2026-08-17
evening, the v1.11.0 battery): smoke-concentration crashed early on a transient, its
pins stood, and the immediately-following green rerun snapshotted those pins as the
"prior" it faithfully restored — eleven settings drifted with every suite reporting
success. Settings-first restore cannot catch this; only an EXTERNAL reference can.
**`node tools/verify-settings.mjs` (NEW at v1.11.0) is the standing rule as a command**:
it diffs the live world against the reference table (mirrored in the script — update
BOTH when the user's taste changes) and `--fix` restores drift. Run it after every
battery; it ended this one CLEAN.

⚠ **A suite fixture that presses a status must plant CANONICAL-id carriers only**
(learned 2026-08-16, expensively): smoke-effects §14 plants a disabled Prone leftover as
④'s regression net, and its first version used a random id — which
`toggleStatusEffect(active:false)` (every cleanup in every suite) CANNOT REMOVE (it only
deletes the canonical-id effect). Once forceStatus enabled it, the victim was immortally
prone, the topple eligibility gate starved §7/14d/14e of cards ACROSS RUNS, and the
battery poisoned itself — cornered by `probe-topple-auto.mjs` (NEW: a 30s ledger of every
message + the victim's prone state around a topple-auto attack). The plant now creates
`_id: "dnd5eprone000000"` with `keepId: true`, which the existing cleanups clear.

⚠ **The `applied` receipts land AFTER the announcements** (topple press, concentration
cascade) — an assertion that reads `applied` the moment the card appears races the last
flag write and flakes. Wait for the receipt itself (both suites grew these waits;
the same-breath lesson, applied-side).

⚠ **smoke-saves §8 (templates) leans on primitives that WORK headless**: the adoption
floor is nudged via `ui.chat.updateMessage` renders (the CRUD hooks never dispatch here —
ground truths), the walk is expressed as delete + re-place (`tpl.update()` silently
no-ops here), and the fixture circle is radius **2.5 ft** (retuned v1.13.0 for core's
grid-aware shapes): the tokens stand 200px apart — ONE GRID SQUARE over — and a gridded
5 ft circle covers the whole adjacent square, exactly the way the old 10 ft Euclidean
rim (boundary-INCLUSIVE) once did; 2.5 ft is out-of-reach under BOTH branches of core's
`gridTemplates` setting, so "outside" stays testable whatever the world runs.

`tools/check-hook-order.mjs` (new at v1.6.1) is the split's static companion — run it
before the battery whenever a file, an import, or a same-hook registration was added; it
needs no Foundry and fails loudly if the load-bearing hook orderings regress.

⚠ **Paused announcements leak across suite section windows** (learned 2026-08-16, the
night the verdict pause landed): a holds/break card now trails its fold by dice-animation
seconds, so a section that flips a setting and opens a new observation window can catch
the PREVIOUS section's announcement wearing the old setting. smoke-conc §10 got a public
holds card in its private-mode window twice before the fix. The cure is both halves:
drain your own announcements before leaving a section, and attribute found cards by
content signature (total-vs-DC), never by keyword alone.

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

`tools/smoke-saves.mjs` (44 assertions at v1.13.0) proves the save machine, sections
(**9** new at v1.11.0: rider damage never rolls or applies + a bar per pending row;
**10** new at v1.12.0, RECUT at v1.13.0 to finding ①'s live shape: a CUBE activity cast
bare TWICE stamps WAITING demands [zero targets/no deadline/`templateType: "cube"`],
Place Template exists-and-hides [finding ②'s DOM pin, count-guarded], then an
origin-LESS RECT — the toolbar draw, geometry-fallback-only on the headless page — is
CLAIMED and fills the NEWEST demand, arms the clock from that moment, asks, and runs to
a receipt, while the OLDER waiting cast stays untouched [10d2, the newest-customer
gate's pin]. ⚠ 10d pins the FILL, not the origin write: template setFlag silently
no-ops on this page (§8's tpl.update() ground truth), so persistence is live-proven
instead (the 2026-08-17 re-test's claimed template read back origin-tied on the probe)
— a waiting demand filling from an origin-less rect is itself reachable only through
claimBareTemplate;
**11** new at v1.12.0: the GM popup filter — BF Test PC Attacker [player-owned, owner
offline] gets no popup while the NPC control's popup shows in the same breath, the row
names the timer, the buzzer resolves it marked):
⚠ **Match popups by the ENTRY's stored token name, never the actor name** (learned
v1.12.0, four failures in one run): adoption and the UI snapshot both name entries
after their TOKEN, and BF Test Victim's token is literally "Hobgoblin" — a matcher
looking for the actor name misses a popup that is correctly open. And give
pending-state assertions a window longer than their own polling patience (§11's first
run set a 4s buzzer, then polled 6s for a popup the buzzer had already closed —
`open=0` proved only that the machine had finished).
**1** the stamp + the auto-rolled damage (asserted then DELETED so §2's late-arrival
ordering stays constructible) + hidden card buttons at the DOM (count-guarded — a
zero-button card would pass vacuously) + two popup-clicked forced verdicts (±30 con save
bonuses) + effects by outcome (the `onSave` split), **2** damage after verdicts (full 10
vs exactly half 5, the multiplier + note on the receipt), **3** the auto-roll AS the
early damage (per-target independence — it waits) + the popup's controls, its
creature-first title, and their plumbing, **4** a bare sheet roll answers, judged vs the
stored DC, **5** the buzzer rolls (marked, straight) + a quiesce before leaving (the
auto-roll's late application otherwise lands inside §6's healed pool), **6** legendary
resistance overturns the folded failure via a bare-roll answer, **7** the exclusions
(setting off, targetless, self-aimed), **8** templates: adoption swings the demand both
ways (8a2: the dropped entry's POPUP CLOSES — the strand fix at the DOM), the walked
area retargets, the spent instantaneous template leaves the canvas, and 8d fires
postUseActivity by hand with the NESTED results.templates shape the live flow produces
— the stamp must contain, not snapshot (the `.flat()` regression net).
Its fixture is an in-suite innate save spell on BF Test Attacker (flat 10 damage so half
is exact; DC from a custom formula; `duration: inst` for §8's sweep; two effects, one
`onSave`). Forced outcomes via the targets' own `abilities.con.bonuses.save` (±30).

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
quietly; a bare sheet save answers; **14g–i at v1.10.0**: the demand stamps `saveTimer`'s
window+deadline, the card runs the bar — asserted at the DOM via `[data-bf-deadline]` —
and the buzzer rolls the unanswered save marked as the timer's press) and **15**
(vex/sap/cleave reminders + the receipt tooltip field; **15a2**: the reminder card runs
its 15s bar — the pairing rule at the DOM). ⚠ Outcomes are forced through the PER-ABILITY
`abilities.con.bonuses.save` (±30) since 2026-08-17 — the global
`system.bonuses.abilities.save` is NOT folded into `rollSavingThrow` at 5.3.3 (measured:
bonus "+30", save total 10), so §14's old forcing never forced and 14d was a coin flip
the whole time. The topple attacks also RETRY on a fumble: vs AC 1 only a nat-1 misses,
and a double-nat-1 under advantage (0.25%) hit twice in one afternoon.

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
`tools/probe-reaction-receipt.mjs` (v1.8.0) replays smoke-hold 4b with a pending-holds
ledger — the tool that proved the reaction receipt lands on the OLDEST pending hold the
cast answered (the suite's retry loop leaves strays older than the watched attack), which
re-aimed the fix at the assertion instead of the machine.

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

- ⚠⚠ **`toggleStatusEffect(id, { active: true })` NO-OPS when ANY effect carrying that
  status already exists — a DISABLED leftover included** — and `{ active: false }` only
  ever removes the CANONICAL-id effect (`dnd5eprone000000`-style), leaving custom-id
  carriers immortal. Both silences are table-facing: the live "topple failed but nothing
  fell prone" was a disabled leftover eating the press. Put statuses on actors through
  `forceStatus` (shared.js): enable a disabled carrier, verify the status landed, build
  the effect directly as the loud last resort.
- **An async hook handler's throw is INVISIBLE** — `Hooks.on("x", doc => { void f(doc) })`
  turns any rejection into an unhandled-rejection nobody logs. Anything that can fail in
  a fired-and-forgotten handler needs its own try/catch with a `console.error`.
- ⚠ **On the headless elect, embedded MeasuredTemplate plumbing is HALF-DEAD** (measured
  2026-08-17): `createMeasuredTemplate` never dispatches for an embedded create (a
  listener registered around the create counted zero fires — sequencer's included),
  `tpl.update()` resolves without applying, and template canvas objects never grow a
  `shape` (an await against one never returns — it killed the whole containment refresh
  silently). Consequences baked into saves.js: the RENDER hook is the refresh's
  reliability floor, CRUD hooks are fast-paths only, containment falls back to
  document-geometry (`templateShape`), and nothing ever awaits template canvas readiness.
- **`PIXI.Circle.contains` is boundary-INCLUSIVE** — a point exactly on the rim is
  inside. Fine and even table-friendly live; keep suite fixtures off the razor's edge.
- **Never key persisted data by uuid.** Foundry expands dotted keys on write, and every uuid
  contains dots: `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }` and the
  lookup misses silently forever. Per-target state is an **array of entries with a `uuid`
  field**. (Phase 1 receipts dodged this by accident — they were already an array.)
- **A message renders into several DOM trees** — chat log, the floating notifications pane,
  popouts. Any "do this once per message" latch in a render hook fires on a tree that gets
  replaced while the ones on screen skip. Render hooks must be **stateless**. (Also why a
  `querySelectorAll` over a message's controls returns each button more than once.)
- ⚠ **ESM evaluation order is import-graph order, not entry-list order** (the split,
  v1.6.1). A file's imports evaluate before its own body, so an "early" file importing a
  "late" one registers the late file's hooks FIRST — and `Hooks.call` stops at the first
  `false`, so relative order between same-hook registrations can be behavioral. The live
  case: the hold's `preApplyDamage` veto must register before concentration's cause
  capture, held by the lazy `import()` in `hold.js` (comment at the site). The cycles
  between split files (hold↔ui, hold↔auto-damage, mastery↔concentration, mastery↔
  auto-apply) are safe only because every crossing symbol is a hoisted `function`
  declaration called at hook time, never at module-eval time — keep new cross-file
  symbols to that shape or break the cycle.
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
- ⚠⚠ **`results.templates` entries are ARRAYS, not documents** (found 2026-08-17 after
  two live misfires): `#placeTemplate` (mixin.mjs:1111) does `templates.push(result)`
  where `result` is `await template.drawPreview()` — and drawPreview resolves with the
  raw `createEmbeddedDocuments` return, an array. Any consumer filtering entries by
  document fields (`t?.parent`) silently drops every live placement. `.flat()` first.
- ⚠ **The global `system.bonuses.abilities.save` is NOT folded into `rollSavingThrow`**
  (measured 2026-08-17: bonus "+30" on the actor, save total 10). Force save outcomes
  through the per-ability `system.abilities.<abl>.bonuses.save` — the channel
  smoke-saves always used and smoke-effects §14 now uses; the old global-bonus forcing
  made §14d a coin flip for its whole life.

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

**Sixteen ES modules under `scripts/`, no build step** (the split, v1.6.1; `saves.js`
joined at v1.7.0 — the split shape's first new-phase customer, landed exactly as
prescribed; `git show v1.6.0:scripts/battleflow.js` is the pre-split original when
archaeology needs it). `battleflow.js` (~102 lines) is the only `esmodules` entry: the
module doc comment plus fifteen imports — **`saves.js` sits BEFORE `receipts.js` on
purpose** (its verdict row must register first; see the import-order rule below).

| File | Lines | Holds |
| --- | --- | --- |
| `core.js` | 44 | MODULE_ID, TITLE, the `S` key map, `setting()`, `isActiveGM()` — the leaf everything imports |
| `settings.js` | 270 | registration + settings-sheet polish |
| `shared.js` | 94 | the hit test, the chain walk, and `forceStatus` (the verified status press) |
| `polish.js` | 145 | no-target gate, the cast-slice birth stamps, hidden card buttons (the keep-list), dialog centering — the suppression machinery died here at v1.10.0 |
| `auto-damage.js` | 66 | Phase 1a — auto-roll damage on hit |
| `hold.js` | 1050 | Phase 1.5 — the whole reaction-hold machine: eligibility, both triggers, answers, continuation, veto, spell-damage applier claim; the reaction effect's application + receipt (v1.8.0) |
| `ui.js` | 582 | popup lifecycle (`openManagedPopup`), the house card (`bfCard`), the countdown bar + `scheduleBarSync`, the hold's views + timers, the global delete sweep |
| `hit-riders.js` | 228 | Phase 1.75 — curated damage riders |
| `auto-apply.js` | 139 | Phase 1b — the elect's applier, `applyDamagesWithReceipt`, the payout pipeline |
| `effect-riders.js` | 166 | Phase 1.9A + the v1.8.0 convergence core: `applyEffectsTo` (THE application loop), `joinEffectReceipt` (THE receipt bookkeeping), `applyEffectsWithReceipt` |
| `mastery.js` | 905 | Phase 1.9B/C — mastery riders, the ask (`armAskTimer` twins), the topple fold + popup + its v1.10.0 buzzer (`saveTimer` semantics), reminders (+ the card bar); its applier stays separate BY POLICY (authored data — see the comment at the site) |
| `concentration.js` | 658 | Phase 2.5 — cause capture → ask → roll → fold → break, `dramaticVerdictPause` |
| `cast.js` | 93 | Phase 3 cast slice — the elect executes stamped payloads |
| `saves.js` | 950 | Phase 2 + Phase 3 save slice — demand stamp (+ the stamp's damage auto-roll + the results.templates `.flat()`), per-target popups/rolls, fold vs stored DC, consequences through the shared appliers, LR overturn, template containment (stamp/adopt/refresh/spent-sweep) + the strand close-pass |
| `receipts.js` | 280 | the receipt/revert views (`revertTarget` exported at v1.7.0 for the LR unwind) |

Cross-file symbols are plain named exports; the discipline that keeps hook ORDER sound is
in design.md §9 and enforced by comment at the two places it bites: **`hold.js` reaches
`auto-apply.js` through a lazy `import()`** (the hold's `preApplyDamage` veto must
register before concentration's cause capture) and **`saves.js` reaches `receipts.js` the
same way** (the save verdict row must register — so render — above the receipt rows; the
entry's saves-before-receipts position is what decides it). Do not make either edge
static, and when adding a same-hook registration in a new file, run
**`node tools/check-hook-order.mjs`** — it loads the graph with stubbed globals, prints
true registration order per hook, and asserts the four load-bearing orderings (no Foundry
needed). `saves.js` consumed exactly the advertised seams (`canAnswerFor`,
`openManagedPopup`, `holdBarHTML`, `armAskTimer`/`disarmAskTimer`,
`dramaticVerdictPause`, `applyDamagesWithReceipt` + `multiplier`,
`applyEffectsWithReceipt` + `revertEffect`, plus `revertTarget` newly exported from
receipts.js). Entry-point hooks check their feature toggle; view/continuation hooks check
flag presence (the cast slice's stamps are exactly this discipline); every feature ships
**off**.

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
| response message | `respondsTo`, `uuid`, `answer`, `ac`, `effectLanded`, `effectReceipt` | a player's answer traveling to the continuing client; since v1.8.0 the reaction effect's receipt rides here (the answering player owns this message and no other) |
| held message (attack / usage card) | `effectReceipt` | the reaction effect's receipt when the ANSWERING client owns the held message (GM answers, the safety net) — v1.8.0 |
| bfCard message | `topple` | the Topple demand: `dc`, `ability`, `weapon`, `window`/`deadline` (v1.10.0 — rides `saveTimer`; buzzer rolls at expiry), per-target `done` + `outcome` ("prone"/"saved"/"gone") + `timedOut` — the fold judges by this dc |
| usage card | `castApply` | the cast payload: activityUuid, concentration id, scaling, spellLevel, targets — the stamp IS the trigger (always the native card since v1.10.0) |
| save usage card (v1.9.5 additions) | `saves.templated`, `saves.durationUnits`, per-target `answeredAt`/`applied`/`total` | containment authority marker, the spent-template gate, and the crash-resume receipts |
| topple bfCard (v1.9.5 additions) | per-target `total`, `answeredAt`, `applied` | the fold's crash-resume contract — outcome without `applied` past 20s re-drives the press+announcement |
| conc ask (v1.9.5 additions) | `outcome.answeredAt`, `outcome.whisperIds`, `outcome.applied` | same contract for the break/holds consequence; whisper stored so a resume addresses the same ears |
| healing roll message | `healPending` | the initiating client's claim; the elect applies and the receipt marks it done |
| bfCard message | `masteryNotice` | the reminder: key, attacker, weapon, wording, deadline/window (popup auto-dismiss) |
| damage-activity roll | `spellDamage` | the auto-applier's birth claim (v1.6.0) — unstamped history is inert |
| damage-activity roll | `spellHoldPending` | a blocklisted spell's hold claim: true from birth, false = released (caster cleared it, or the hold resolved) — the applier acts on the release |
| ask message (bfCard) | `concentration` | the concentration ask: status, actor, ability, dc, damage, names, effectIds snapshot, cause, deadline, outcome |
| concentration roll message | `respondsTo`, `timedOut` | which ask this roll answers (the hold's answer-channel key, same meaning); whether the buzzer pressed it |
| save usage card | `saves` | the Phase 2 demand: status, abilities, dc, damageOnSave, hasDamage, effectNames by outcome, activityUuid, item, casterName, deadline, per-target array (done/outcome/total/rollMessageId/timedOut/forced/applied) |
| save roll message | `respondsTo`, `saveFor`, `timedOut` | which demand card and WHICH target this roll answers (exact — immune to the getSpeaker trap); whether the buzzer pressed it |
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
