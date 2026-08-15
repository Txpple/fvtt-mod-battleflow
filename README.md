# Battle Flow

**Battles, flowing.** Attack → hit → damage → save → effect resolves itself, and the table only
touches the moments that are theirs.

A house combat-resolution module for Foundry VTT (v14) + dnd5e (5.3.x, 2024 rules). The system
already owns all the math — hit determination, resistance-correct damage, real saves, effect
application, concentration — but every link ends at a button. Battle Flow presses the buttons
whose outcomes are already determined, pauses at the one moment a human gets a say (the
reaction window), announces what matters, and leaves a receipt (with a revert) everywhere it
acts. The native buttons are never removed — vanilla stays the substrate and the fallback.

**Zero dependencies. No sockets. No patching.** Clients coordinate by reading the same chat
log, not by messaging each other; the only `relationships` entry is a version pin on dnd5e.

## Status

**Phase 1 built — the attack resolver.** Auto-roll damage on hit (attacker's client),
auto-apply to hit targets (active-GM client), and per-target receipts with one-click revert
on every damage card. Every feature is behind its own world setting and ships **off**; the
dogfood ladder is walked one setting at a time. The binding design is [design.md](design.md) (mission,
principles, architecture, the phase ladder, settings, verified dnd5e 5.3.3 hook seams, and
permanent non-goals). The source-level research that justifies it — a dissection of midi-qol
(50k lines; why not), DAE (why it isn't needed), dnd5e 5.3.3 native automation, and the
2025–2026 ecosystem — is preserved in [RESEARCH.md](RESEARCH.md).

Rollout (each phase behind its own setting, default off):

| Phase | Feature |
| --- | --- |
| **1 ✓** | Attack resolver: auto-roll damage on hit, auto-apply to hit targets, revert receipts |
| 1.5 | Reaction hold: Shield-window pause with popup + countdown (a pause, not a system) |
| 2 | Saves: auto-roll for everyone, half-damage-on-save made real |
| 2.5 | Concentration assist: un-buryable prompt + break-on-failure |
| 3 | Effect application on hit / failed save |
| 3.5 | Curated damage riders (Hunter's Mark tier) |
| 4 | Effect expiry (likely native on v14 core — verify first) |
| 5 | Conditions layer (AC5e adoption candidate) |

## Family

Sibling of [Combat Plus](https://github.com/Txpple/fvtt-mod-combatplus) — Combat Plus is combat
*UX* (music, gates, cues); Battle Flow is combat *resolution* (dice consequences). Separate so
dnd5e churn can never take down the initiative gate mid-campaign.

Built for one table. Public because there's no reason not to be, but generality is a non-goal —
see design.md §8.

## License

MIT
