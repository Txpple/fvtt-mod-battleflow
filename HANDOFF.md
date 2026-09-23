# HANDOFF — after the Session 8 fix pass (2026-09-23)

> A commission file, not a standing one: retire it (delete, in the commit that says so) when
> the items below are delivered or ruled. The repo docs are the state; this file only says
> where to look and what is waiting on the user.

## Where things stand

- **Three repos, committed LOCALLY on `main`, NOT pushed, NOT released, NOT deployed:**
  - **Battle Flow** `10ef252` — Session 8's bugs (the commit message is the full account).
  - **fvtt-mcp-dnd5e** `db1cf19` — `send-chat-message` speaks as the narrator, `speakerAlias`;
    `dist/` rebuilt. The running MCP servers pick it up only when they restart.
  - **fvtt-mod-miscpatches** `d2be809` — shim chains (Roving's "3510", Half Speed never halving).
- **Prod:** untouched — Battle Flow **v2.0.3** on Foundry 14.368 / dnd5e 6.0.3; Misc Patches is
  installed there but **disabled** (FX Studio owns teleports now).
- **Sandbox (localhost:30000):** Battle Flow's working tree deployed (module.json still says
  2.0.3), the BF Test fixtures present (no longer an exact prod copy), Misc Patches disabled,
  settings CLEAN against `tools/verify-settings.mjs`.
- **Proof:** `npm run verify` green (663 unit tests). Full battery 19/22 green, settings clean;
  the three reds explained — smoke-saves §2 was the Shielder fixture inheriting Gren's drunk
  Poison Resistance (fixed in `tools/fixture-suite.mjs`, 9/9 after), smoke-d20-folds §10's
  receipt read and smoke-twoclient relay/2-3 are timing (76/76 and 13/13 re-run alone).

## Read first

- [BACKLOG.md](BACKLOG.md) — *From play — Session 8*: what the pass left for a ruling.
- [NOTES.md](NOTES.md) — §1 *A dialog's DEFAULT button takes the keyboard*, *An attached
  emanation is RE-BASED only when its base matches*; §2 *An applied copy carries its TEMPLATE'S
  lineage*, *6.0's moved-key table follows ONE hop*; §4 the two new lessons.
- [ARCHITECTURE.md](ARCHITECTURE.md) §5 presentation law 12 (a moment never takes the keyboard).

## Waiting on the user (nothing here starts without their word)

1. **The aura on a scene nobody activated** — a RULING. Feature auras stand on the active scene
   only (their 2026-09-04 rule, against 17× stacking); Session 8 played on scenes that were
   never activated, so the +2 was missing. Proposed: also raise on every scene a connected
   user is VIEWING, one member effect per (source, aura) on an ally so two scenes can never
   stack. DESIGN §6 first, then code.
2. **Push / release / deploy.** Battle Flow as the next patch release (the release chain is in
   memory, *battleflow-prod-freeze*); push the MCP and Misc Patches commits.
3. **Misc Patches on prod** — only if they want Roving and Half Speed fixed at the table: deploy,
   enable the module, **turn its Teleports switch OFF**, process restart (theirs).
4. **Restart the Claude sessions' MCP servers** for the speaker fix.
5. *Optional:* a TRAY-applied effect still names the pack as its source to the platform's own
   clock (`sourceStart`/`sourceEnd` end on the wrong turn edge) — a Misc Patches patch or a
   one-time data sweep of the 207 stale templates; neither built.
6. *Optional:* Tactical Mind used from the SHEET after a passed offer does not add its d10 to
   the check (native behaviour; buildable on the ARMED pattern, wants a ruling on the look-back).

## Small, unowed

- Harden the two timing checks: smoke-d20-folds §10 finds its receipt by slicing the log at a
  pre-click COUNT (a deletion shifts it — match by content since a timestamp instead);
  smoke-twoclient relay/2 polls 8 s for the player's own message.
- ⚠ **Parallel sessions share the sandbox.** A Loot Shelf session ran on it on 2026-09-23
  (as Tester Assistant + Open Player 1); `ListAgents` / `SendMessage` to coordinate before a
  battery or a restart.
