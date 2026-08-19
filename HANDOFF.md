# HANDOFF.md — picking this up cold

> ⚠⚠ **NEXT SESSION IS A TESTING WALK — START BY DOING NOTHING.** The user's standing
> protocol (proven FIVE walks running): open by presenting THE v1.14.0 WALK checklist
> below, then wait. Do not connect the bridge, run suites, read the world, or touch
> code. The user works the list at the table and reports; you AGGREGATE — number the
> findings as they arrive, restate the FULL list state after every update (so they
> never scroll), confirm/close items as they say so — and you ACT only when they say
> go. Then: evidence first, one battery-green fix pass, release. Exactly the pattern.
> ⚠ FREEZE (user, 2026-08-17 pre-walk): **no more changes until after Tuesday night's
> live session (2026-08-19).** Walk findings get numbered and recorded; the fix pass
> and release wait for Wednesday. Tuesday plays v1.14.0 exactly as deployed.
> ⚠ NEW OPERATIONAL LESSON, learned the hard way this walk: **connecting bridge/probe
> GM sessions DURING a walk steals the apply/sweep ELECT from the user's window**
> (isActiveGM sorts DM Assistant ahead of Matt) — a probe mid-walk can strand
> one-shots mid-chain. Probe between walk items only if unavoidable, and expect elect
> churn in what you observe afterward.

> Current at 2026-08-17 night — **v1.14.0 shipped: the v1.13.0 walk's two findings,
> closed in one pass.** The walk (afternoon/evening) put v1.13.0's fix in front of live
> dialog-placed areas and it demanded the WRONG PEOPLE — Salyth from outside every
> drawn cube/square (Web, Entangle) and marginally at Fireball — plus instantaneous
> areas stopped sweeping. Eleven read-only probes (`tools/probe-template-geometry*.mjs`
> and friends, all committed) ran the diagnosis to bedrock, the user said "go", and
> the fix pass ran: code, suite recut, battery 49/49, release. Read
> [design.md](design.md) first — it is binding and has absorbed everything through
> v1.14.0. This file is only *where things stand* and *what already bit us*.
>
> **v1.14.0 in one breath (the walk's findings ① + ②):**
> - **① THE v14 REGION-SHIM CORRUPTION (upstream, probe-proven).** Foundry 14 shims
>   MeasuredTemplates onto Regions, and this box's CREATE round-trip scales the stored
>   `distance` by **gridSize/100** (×1.4 on Party Camp's 140px grid; ×0.7 on 70px;
>   exactly ×1.0 on the 100px Test Range — which is why every battery was structurally
>   blind) and returns `width` as RAW PIXELS. Two human clients + the bridge produced
>   identical corruption; the client pipeline is exonerated (probe 8: local
>   clean/validate is a no-op; no hooks, no wrappers); the renderer draws from the same
>   lying field, so the oversized area is what the table SEES too. dnd5e sends honest
>   values (`fromActivity` read from live source) — the corruption is server-side.
>   **The fix is SPELL-TRUTH: containment builds geometry from
>   `flags.dnd5e.dimensions` first** (honest, shim-proof, stamped by every dialog
>   placement), superseding drawn-shape-first while the doc lies; self-healing when
>   upstream fixes the shim. Toolbar draws (no dimensions flag) and adjustedSize
>   emanations keep the v1.13.0 ladder — a toolbar area therefore demands
>   SCREEN-truth (what you drew, possibly oversized), a dialog area demands
>   SPELL-truth. Plus: containment now samples EVERY occupied grid square per token
>   (midi-qol's model) — a 2×2 body half inside the area saves. ⚠ v1.13.0's
>   "gridTemplates ON" was a MISREAD — the setting is OFF on this box (probe 1); the
>   over-sweep that looked like grid-polygon math was this shim all along.
> - **② THE SPENT SWEEP CONVERGES.** Stale Fireball circles stood with every target
>   `applied: true` — the completion one-shot got lost (prime suspect: the probe
>   sessions' elect steal, the header's new lesson). The sweep is a convergent
>   render/update FLOOR on done cards now, guarded by the NEWEST-CAST FOSSIL WALL: a
>   newer same-activity card disarms an old card's sweep forever (a recast reuses the
>   activity uuid; history must never delete the current cast's area).
> - smoke-saves §12 (suite-built 140px scene, factor-proof spell-truth assert,
>   `shimFactor` logged each run so an upstream fix announces itself) and §13 (sweep
>   one-shot + floor + fossil wall). Battery 49/49; verify-settings CLEAN.

## Where things stand

**Shipped and live** in *The Broken Heart of Greenrest* (Foundry 14.364 + dnd5e 5.3.3,
Molten-hosted). Latest release **v1.14.0** (2026-08-17 night — the v1.13.0 walk's two
findings, above). Before it, all 2026-08-17: v1.13.0 (afternoon), v1.12.0 (night
prior, the v1.11.0 walk's findings), v1.11.0 (evening), v1.10.0 (afternoon; v1.9.6
burned as its staging diagnostic), v1.9.5 (the dogfood sixteen, small hours); and on
2026-08-16: v1.8.0 (the Phase 3 convergence), v1.7.0 (Phase 2 saving throws + the save
slice), v1.6.1 (the split), v1.6.0, v1.5.1, v1.5.0, v1.4.0, v1.3.x. Deployed, tags
pushed, GitHub releases carry zip + manifest. **The box tracks the GitHub manifest.**
⚠ Current deploy state: the box runs the v1.13.0 INSTALL with **v1.14.0 scripts
hot-deployed over WebDAV** (fresh-served, probe-verified `honestDims` on the wire);
module.json vends 1.13.0 until the next process restart, at which point the manifest
pulls the real v1.14.0 install. No bounce was performed — the table was live.

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
| Reaction List | `Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, Riposte:ac, Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage` | user-expanded 2026-08-17 — nine new entries beyond the original four |
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

### 🔴 THE 2026-08-18 LIVE SESSION (session 4, the Hollow) — findings recorded under the FREEZE

Recorded live from the user's table reports, per the standing protocol; **no fix ships
before Wednesday.** Numbered here for the fix pass; the campaign-side ledger is
`fvtt-campaign-greenrest/todo.md` §0 (same items, table-workaround framing).

> ⚠⚠ **FINDING ⓪ FIRST — EVERY FINDING BELOW IS ELECT-CONTAMINATED, and the assistant
> did the contaminating.** The header's elect-steal lesson (probe GM sessions steal the
> apply/sweep elect from the user's window) applied ALL NIGHT and was only recognized at
> ~21:45: two one-off volume scripts connected as DM Assistant pre-session and their
> processes never exited — **two zombie headless GM clients held the elect from ~20:20
> to 21:05 of live play** — and after they were killed, the assistant's MCP bridge
> reconnected repeatedly mid-session (loot minting, item fixes), stealing the elect
> again in stretches. Battleflow popups landing on an invisible headless window and
> one-shots stranding on a dead elect are the KNOWN symptoms of exactly this. So:
> **every finding below must re-verify in a clean single-GM room on Wednesday before
> any code is touched** — the module may be innocent of most of tonight.
> **New standing rule (extends the header's walk lesson): the bridge NEVER connects
> during live play** — not for scripts, not for MCP content edits; loot and fixes wait
> for a break or the morning. If the table asks for a live change anyway, warn that it
> costs the elect, connect, do it, disconnect immediately.

- **① Faerie Fire's template region outlived the spell** — no sweep at duration end
  (a duration/concentration area, so the spent-sweep correctly ignored it; whatever
  should clear it at END never fired), and the user deleting the region by hand
  **stripped the Faerie Fire chips off the marked targets** (region-linked application
  linking working as built, but it turns the manual cleanup into a debuff wipe
  mid-fight). Elect-suspect: concentration-linked cleanup runs on the activeGM.
- **② Double application, four independent sightings** — Hunter's Mark chip x2 and
  Slow mastery chip x2 (Jetten vs a wight), Topple x2 on a swing (Morgash), and
  Entangle pressing double Restrained on a failed save. If any of it reproduces clean,
  the suspect is two apply paths coexisting per source (cast slice / effect riders /
  save machine / native tray); under tonight's elect churn, two GM-capable clients is
  the cheaper explanation.
- **③ Life Drain demanded its save TWICE** — the wight save feature prompted Morgash's
  roll two times ("weird double up").
- **④ The two table-moment machines collided** — one hit (Morgash on Edda) raised the
  Topple ask AND her concentration ask; resolving the concentration roll made the
  Topple popup vanish unresolved (no recall, save never rolled). The asks queue
  per-machine, not per-actor-across-machines.
- **⑤ Topple verdicts with no follow-through** — repeated (Osric and others): target
  rolls, pass/fail marks, and a failure never presses Prone. The user pressed Prone by
  hand all night. Elect-suspect (the fold's press step runs on the elect), but note ②'s
  double-Topple sighting means the topple path misbehaved in BOTH directions tonight.
- **⑥ Shield held while Shield was already up** — Gren, arrow from a Skeletal Archer:
  the hold re-prompted while his +5 was active (and his reaction spent). Expected:
  reactionSpent suppression + an active-Shield gate = no hold. Re-verify clean;
  reactionSpent clears are turn-hook-driven and elect churn could have eaten the spend.
- **⑦ Innate Sorcery applies nothing on use** (Gren) — no chip, honor-system buff.
  Wednesday check: does the PHB compendium item even carry an ActiveEffect (item-data
  gap → world-content fix, not module), and if it does, why the SELF-aim cast slice
  didn't land it (the world copy may predate v1.11.0 self-aim).

**World content, fixed live tonight (not module code):** Gren's Wand of the War Mage +1
was a raw DMG enchant-TEMPLATE copy (riders never fire unapplied) — shimmed with a plain
transferring +1 msak/rsak effect (`Tu0htbQAllmONqwv`); Wednesday: apply the real
enchantment or strip the template cruft, and sweep other actors for the same silent
pattern. Adrenaline Rush's activity renamed + chat flavor now says Temp HP (mechanics
were already correct). Wight "Necrotic Sword" minted as loot (world item + party-stash
copy, qty 2). Hollow soundscape volumes re-tuned (campaign todo has the mix).

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

### 🚶 THE v1.14.0 WALK — the user's checklist for the next testing session

The session protocol is the header's ⚠⚠ block: present this, wait, aggregate, act only
on "go" — amended this round by the FREEZE: findings are recorded, but no fix ships
until after Tuesday night (2026-08-19). Suite-proven (smoke-saves §12/§13 pin the exact fixes); the walk is the live
confirmation. The settings table above is law — no settings changes needed. **Every
client should F5 once before starting** (v1.14.0 went out over WebDAV; a stale window
as elect runs old code).

1. **The Salyth re-test, dialog path** — at Party Camp, dialog-place Web (or Entangle
   or Fireball) so the drawn area sits NEAR Salyth-the-way-it-was: rows must be
   SPELL-TRUE — only tokens within the real 20 ft area demanded, the bystander a
   square outside stays out. ⚠ Expect the DRAWN texture/highlight to still LOOK
   oversized (~40% on this grid) — that is the upstream shim drawing the corrupted
   field, not the module; the demand follows the spell, not the picture. If rows match
   the spell while the picture is fat, that is the fix WORKING.
2. **Instantaneous cleanup** — Fireball/Shatter: after every save resolves and damage
   lands, the template leaves the canvas by itself (finding ②'s floor). A Web/Entangle
   area (duration spells) correctly stays.
3. **The TOOLBAR half of the old item 1** (still unwalked live) — cast Web bare
   (card says "waiting for the template's area"), then draw a 20 ft cube from the
   canvas template controls over the dummy + somebody: rows appear for whoever stands
   in the DRAWN area, full 15s bar from the draw moment. ⚠ The toolbar path is
   SCREEN-truth (no dimensions flag to rescue it — if the drawn cube stores oversized,
   the rows follow the oversized drawing; that mismatch with the dialog path is the
   recorded upstream-defect residue, not a module bug).
4. **Big-token sampling, if convenient** — drop a 2×2 creature half inside an area:
   it should be demanded now (center-only testing missed it before v1.14.0).

**State at handoff:** working tree clean, the v1.14.0 three-commit train pushed (test →
feat tagged v1.14.0 → docs); the GitHub release carries zip + bare module.json; the box
runs the v1.13.0 install with v1.14.0 scripts hot-deployed (probe-verified fresh on the
wire; module.json vends 1.13.0 until the next natural restart, which will pull the real
v1.14.0 install from the manifest — no bounce was performed, the table was live); world
up, bridge disconnected; settings verified drift-free after the battery
(`verify-settings.mjs` CLEAN). Battery 49/49 with the new §12/§13. ⚠ Loose ends the
next session should know: (a) **four stale WAITING demand cards from the user's walk
testing stand in chat** (19:42–19:51 — zero targets, `templateType` present, so they
CAN claim/adopt future matching areas; deletion was proposed but NOT approved — ask
the user, or let them clear chat); (b) the **upstream shim defect stays UNFILED as a RULING** (user, 2026-08-17 night:
"no to upstream bug report, they will never read it") — do not offer again; the probe
evidence stays committed in tools/ if the stance ever changes;
(c) the user hand-deleted walk-debris templates mid-session — canvas deletions around
19:40 are theirs, not the sweep's.

### Where the plan points now (2026-08-17 — post-v1.13.0)

**Five feedback rounds are closed** (the dogfood sixteen at v1.9.5/v1.10.0, round two
at v1.10.0, the v1.10.0 walk's ①–⑥ at v1.11.0, the v1.11.0 walk's ②–④ at v1.12.0, the
v1.12.0 walk's ① at v1.13.0 — resolution maps live in this file's git history and in
design.md's amendments). Closed as a RULING, not code: **Ⓓ1 — GM required for full
functionality** (design.md §8 keeps the full itemization). Open as a QUESTION, not a
bug — REOPENED as a post-Tuesday CHECK (user, 2026-08-17 pre-walk): **does the
concentration ask still popup the GM for offline-owner PCs?** The user reports not
seeing it lately and likes the quiet ("fine and good"), but the SOURCE carries no
filter — concentration.js:550 gates on concMode + canAnswerFor only; finding ④'s
`isGM && hasPlayerOwner` quiet lives in saves.js:1113 and mastery.js:880 alone — so
the non-sightings are probably the probe sessions' elect steal (the popup landing on
the bridge page, not the user's window) or the scenario simply not arising. VERIFY
live after Tuesday, then rule: if it still pops and the user wants it gone, the fix
is the same two-line gate (the conc buzzer already ROLLS on expiry, nothing goes
unresolved). What
remains open:

- **⑭ The year-off timestamps — RETIRED** (user call, the v1.12.0 walk: "stop
  watching"; three sessions clean). Two cards on 2026-08-16 rendered "11m 364d ago"
  among correctly-stamped neighbors; the module passes NO timestamps (grep-verified),
  the bridge's clock measured exact, the probe could not reproduce, and it never
  recurred. Not carried on any walk list anymore. If it EVER resurfaces: hover the card
  for its real date and note which USER authored it — the message's creating client
  stamps the timestamp, so the author names the broken clock.
- **Phase 4** stays an experiment first (cast Bless, watch ten rounds — likely zero
  code); **Phase 5** stays the adopt-AC5e decision; **two-client save coverage** is no
  longer hypothetical — `probe-popup-topology.mjs` (NEW at v1.11.0) is a working
  two-client harness (PC Assistant casts, the GM observer ledgers every hook, dialog
  render, and DOM state); growing it into a suite is the natural next step if
  cross-client regressions worry anyone.

⚠ Tuesday is live play. v1.13.0 clears battery-green. Player-facing changes since the
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
second Molten box", ≤ v1.6.0) if it ever returns. Suites keep running on prod, taking
turns with live sessions — check who's connected before yanking clients.

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
deliberate non-extension — reopened 2026-08-17 as a post-Tuesday CHECK: the user
stopped seeing it, probably the elect steal; verify live, then rule); "cast with no GM logged in, nothing
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
