# The PHB spells — the register

> Generated 2026-09-28 by `tools/audit-spells-register.mjs` from the corpus scan (`dnd-players-handbook.spells`, 391 spells, dnd5e 6.0.5) joined
> with `scripts/decide/registry.js`, RULINGS' walk tables and bend registers, and the drawing's hand verdicts
> ([drawings/spells.md](drawings/spells.md) *Register verdicts*). Never edited by hand: change the drawing or the code and re-run.
>
> **In scope**: NATIVE — the pack and the platform resolve it (the saves machine, the applier, the gate and the receipts
> already cover it); MODULE — a registry table names it (the table, its machine and the RULINGS section to read);
> TEXT — the pack ships a paragraph only, no combat mechanism to play; OUT — held out by the drawing or a ruling, the
> reason in *Why not*. **Rule of cool / bend**: a row in RULINGS *Where the table bends the rule* (bend) or *Bent by
> choice* (rule of cool) names it. **Walked**: the RULINGS walk table the spell sits in (the walks of Tiers 1–4 are
> deferred by the user — the tier is where it WILL be walked).

**391 spells: 177 NATIVE · 83 MODULE · 99 TEXT · 32 OUT.**

| L | Spell | School | C | In scope | Why not / how | Rule of cool / bend | Walked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | **Acid Splash** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 0 | **Blade Ward** | Abjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Chill Touch** | Necromancy |  | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 0 | **Dancing Lights** | Illusion | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Druidcraft** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Eldritch Blast** | Evocation |  | NATIVE | the pack resolves it: an attack, damage | — | — |
| 0 | **Elementalism** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Fire Bolt** | Evocation |  | NATIVE | the pack resolves it: an attack, damage | — | — |
| 0 | **Friends** | Enchantment | C | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| 0 | **Guidance** | Divination | C | NATIVE | the pack resolves it: 18 effects | — | — |
| 0 | **Light** | Evocation |  | MODULE | `TOKEN_LIGHTS` (token-lights.js; RULINGS *The species walk, continued*) | — | — |
| 0 | **Mage Hand** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Mending** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Message** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Mind Sliver** | Enchantment |  | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| 0 | **Minor Illusion** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Poison Spray** | Necromancy |  | NATIVE | the pack resolves it: an attack, damage | — | — |
| 0 | **Prestidigitation** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 0 | **Produce Flame** | Conjuration |  | NATIVE | the pack resolves it: an attack, damage | — | — |
| 0 | **Ray of Frost** | Evocation |  | NATIVE | the pack resolves it: 1 effect, an attack, damage | — | — |
| 0 | **Resistance** | Abjuration | C | NATIVE | the pack resolves it: 11 effects | — | — |
| 0 | **Sacred Flame** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 0 | **Shillelagh** | Transmutation |  | NATIVE | the pack resolves it: 4 effects | — | — |
| 0 | **Shocking Grasp** | Evocation |  | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 0 | **Sorcerous Burst** | Evocation |  | NATIVE | measured 2026-09-28: the pack's `1d8x@mod=8` is Foundry's capped explode | — | Tier 1 |
| 0 | **Spare the Dying** | Necromancy |  | NATIVE | the pack resolves it: 1 effect [stable], healing | — | — |
| 0 | **Starry Wisp** | Evocation |  | NATIVE | the pack resolves it: 1 effect, an attack, damage | — | — |
| 0 | **Thaumaturgy** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 0 | **Thorn Whip** | Transmutation |  | NATIVE | the pack resolves it: an attack, damage | — | — |
| 0 | **Thunderclap** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 0 | **Toll the Dead** | Necromancy |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 0 | **True Strike** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 0 | **Vicious Mockery** | Enchantment |  | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 0 | **Word of Radiance** | Evocation |  | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*) | — | — |
| 1 | **Alarm** | Abjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Animal Friendship** | Enchantment |  | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| 1 | **Armor of Agathys** | Abjuration |  | MODULE | `DAMAGE_SHIELDS` (damage-shields.js; RULINGS *Damage shields*) | — | — |
| 1 | **Arms of Hadar** | Conjuration |  | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| 1 | **Bane** | Enchantment | C | NATIVE | the pack resolves it: 1 effect, a save | — | — |
| 1 | **Bless** | Enchantment | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Burning Hands** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 1 | **Charm Person** | Enchantment |  | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| 1 | **Chromatic Orb** | Evocation |  | NATIVE | the pack resolves it: an attack, damage | — | — |
| 1 | **Color Spray** | Illusion |  | NATIVE | the pack resolves it: 1 effect [blinded], a save | — | — |
| 1 | **Command** | Enchantment |  | MODULE | `SAVE_PRESSES` (saves/; RULINGS *Rulings the code carried · Save demands*) | bend | Tier 1 |
| 1 | **Compelled Duel** | Enchantment | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 1 | **Comprehend Languages** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Create or Destroy Water** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Cure Wounds** | Abjuration |  | NATIVE | the pack resolves it: healing | — | — |
| 1 | **Detect Evil and Good** | Divination | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Detect Magic** | Divination | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Detect Poison and Disease** | Divination | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Disguise Self** | Illusion |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Dissonant Whispers** | Enchantment |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 1 | **Divine Favor** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Divine Smite** | Evocation |  | OUT | a Bonus Action cast after the hit in 2024, never a rider on it (the user, 2026-09-03); the pack's damage on use resolves it | — | — |
| 1 | **Ensnaring Strike** | Conjuration | C | NATIVE | the pack resolves it: 1 effect [restrained], a save, damage | — | — |
| 1 | **Entangle** | Conjuration | C | NATIVE | the pack resolves it: 1 effect [restrained], a save | — | — |
| 1 | **Expeditious Retreat** | Transmutation | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Faerie Fire** | Evocation | C | MODULE | `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | — | — |
| 1 | **False Life** | Necromancy |  | NATIVE | the pack resolves it: healing | — | — |
| 1 | **Feather Fall** | Transmutation |  | OUT | no falling moment the module meets | — | — |
| 1 | **Find Familiar** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Fog Cloud** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Goodberry** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Grease** | Conjuration |  | MODULE | `SAVE_PRESSES` (saves/; RULINGS *Rulings the code carried · Save demands*) | — | — |
| 1 | **Guiding Bolt** | Evocation |  | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 1 | **Hail of Thorns** | Conjuration |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 1 | **Healing Word** | Abjuration |  | NATIVE | the pack resolves it: healing | — | — |
| 1 | **Hellish Rebuke** | Evocation |  | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | bend | — |
| 1 | **Heroism** | Enchantment | C | MODULE | `TURN_GRANTS` (turn-grants.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | Tier 1 |
| 1 | **Hex** | Enchantment | C | MODULE | `RIDERS` (hit-riders.js; RULINGS *Rulings the code carried*) | — | — |
| 1 | **Hunter's Mark** | Divination | C | MODULE | `RIDERS` (hit-riders.js; RULINGS *Rulings the code carried*) | — | — |
| 1 | **Ice Knife** | Conjuration |  | NATIVE | the pack resolves it: a save, an attack, damage | — | — |
| 1 | **Identify** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Illusory Script** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Inflict Wounds** | Necromancy |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 1 | **Jump** | Transmutation |  | MODULE | `TWINNED_EXCEPTIONS` (metamagic.js; RULINGS *Metamagic*) | — | — |
| 1 | **Longstrider** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Mage Armor** | Abjuration |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Magic Missile** | Evocation |  | MODULE | `BLOCKS` (hold/; RULINGS *The reaction hold*); `TWINNED_EXCEPTIONS` (metamagic.js; RULINGS *Metamagic*) | — | — |
| 1 | **Protection from Evil and Good** | Abjuration | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 1 | **Purify Food and Drink** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Ray of Sickness** | Necromancy |  | NATIVE | the pack resolves it: 1 effect [poisoned], an attack, damage | — | — |
| 1 | **Sanctuary** | Abjuration |  | MODULE | `WARDS` (wards.js; RULINGS *The spells slice — Tier 3*) | bend | Tier 3 |
| 1 | **Searing Smite** | Evocation |  | OUT | a smite: a Bonus Action cast after the hit (2026-09-03) | — | — |
| 1 | **Shield** | Abjuration |  | MODULE | `INTERRUPTS` (hold/; RULINGS *The reaction hold*); `BLOCKS` (hold/; RULINGS *The reaction hold*) | bend | — |
| 1 | **Shield of Faith** | Abjuration | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Silent Image** | Illusion | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Sleep** | Enchantment | C | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*); `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | — | — |
| 1 | **Speak with Animals** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 1 | **Tasha's Hideous Laughter** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 1 | **Tenser's Floating Disk** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Thunderous Smite** | Evocation |  | OUT | a smite: a Bonus Action cast after the hit (2026-09-03) | — | — |
| 1 | **Thunderwave** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 1 | **Unseen Servant** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 1 | **Witch Bolt** | Evocation | C | NATIVE | the pack resolves it: 1 effect, an attack, damage | — | — |
| 1 | **Wrathful Smite** | Necromancy |  | OUT | a smite: a Bonus Action cast after the hit (2026-09-03) | — | — |
| 2 | **Aid** | Abjuration |  | NATIVE | the pack resolves it: 8 effects, healing | — | — |
| 2 | **Alter Self** | Transmutation | C | NATIVE | the pack resolves it: 3 effects, an attack, damage | — | — |
| 2 | **Animal Messenger** | Enchantment |  | OUT | the save bend turns on "fighting" — the GM's judgment; no combat moment | — | — |
| 2 | **Arcane Lock** | Abjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Arcane Vigor** | Abjuration |  | NATIVE | the pack resolves it: healing | — | — |
| 2 | **Augury** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Barkskin** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 2 | **Beast Sense** | Divination | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Blindness/Deafness** | Transmutation |  | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 2 | **Blur** | Illusion | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 2 | **Calm Emotions** | Enchantment | C | MODULE | `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | — | — |
| 2 | **Cloud of Daggers** | Conjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | Tier 3 |
| 2 | **Continual Flame** | Evocation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Cordon of Arrows** | Transmutation |  | OUT | `TWINNED_EXCEPTIONS` (metamagic.js; RULINGS *Metamagic*) | — | — |
| 2 | **Crown of Madness** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 2 | **Darkness** | Evocation | C | OUT | a ring that carries no effect (the sight rules are the table's) | — | — |
| 2 | **Darkvision** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 2 | **Detect Thoughts** | Divination | C | NATIVE | the pack resolves it: a save | — | — |
| 2 | **Dragon's Breath** | Transmutation | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 2 | **Enhance Ability** | Transmutation | C | NATIVE | the pack resolves it: 5 effects | — | — |
| 2 | **Enlarge/Reduce** | Transmutation | C | MODULE | `TOKEN_SIZES` (effect-riders.js; RULINGS *The species walk, continued*) | — | — |
| 2 | **Enthrall** | Enchantment | C | OUT | the save bend turns on "fighting" — the GM's judgment | — | — |
| 2 | **Find Steed** | Conjuration |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 2 | **Find Traps** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Flame Blade** | Evocation | C | NATIVE | the pack resolves it: an attack, damage | — | — |
| 2 | **Flaming Sphere** | Conjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | Tier 3 |
| 2 | **Gentle Repose** | Necromancy |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Gust of Wind** | Evocation | C | NATIVE | the pack resolves it: a save | — | — |
| 2 | **Heat Metal** | Transmutation | C | MODULE | `DAMAGE_SAVES` (damage-casts.js; RULINGS *Damage casts*); `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 2 | **Hold Person** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 2 | **Invisibility** | Illusion | C | NATIVE | the pack resolves it: 1 effect [invisible] | — | — |
| 2 | **Knock** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Lesser Restoration** | Abjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Levitate** | Transmutation | C | NATIVE | the pack resolves it: 1 effect, a save | — | — |
| 2 | **Locate Animals or Plants** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Locate Object** | Divination | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Magic Mouth** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Magic Weapon** | Transmutation |  | NATIVE | the pack resolves it: 3 effects | — | — |
| 2 | **Melf's Acid Arrow** | Evocation |  | NATIVE | the pack resolves it: 1 effect, an attack, damage | — | — |
| 2 | **Mind Spike** | Divination | C | OUT | the audit's false press; the pack resolves the damage, the tracking is the table's | — | — |
| 2 | **Mirror Image** | Illusion |  | MODULE | `DUPLICATES` (hold/; RULINGS *The spells slice — Tier 3*) | bend | Tier 3 |
| 2 | **Misty Step** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Moonbeam** | Evocation | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | Tier 3 |
| 2 | **Nystul's Magic Aura** | Illusion |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 2 | **Pass without Trace** | Abjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 2 | **Phantasmal Force** | Illusion | C | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| 2 | **Prayer of Healing** | Abjuration |  | NATIVE | the pack resolves it: 1 effect, healing | — | — |
| 2 | **Protection from Poison** | Abjuration |  | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | Tier 1 |
| 2 | **Ray of Enfeeblement** | Necromancy | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 2 | **Rope Trick** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Scorching Ray** | Evocation |  | MODULE | `TWINNED_EXCEPTIONS` (metamagic.js; RULINGS *Metamagic*) | — | — |
| 2 | **See Invisibility** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 2 | **Shatter** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 2 | **Shining Smite** | Transmutation | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 2 | **Silence** | Illusion | C | NATIVE | the pack resolves it: 1 effect [deafened, silenced] | — | — |
| 2 | **Spider Climb** | Transmutation | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 2 | **Spike Growth** | Transmutation | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | bend | Tier 4 |
| 2 | **Spiritual Weapon** | Evocation | C | OUT | a summon: its attacks are the attacks machine's | — | — |
| 2 | **Suggestion** | Enchantment | C | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| 2 | **Summon Beast** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 2 | **Warding Bond** | Abjuration |  | MODULE | `DAMAGE_SHARES` (damage-shares.js; RULINGS *The spells slice — the held spells*) | bend | Tier 4 |
| 2 | **Web** | Conjuration | C | MODULE | `SAVE_PRESSES` (saves/; RULINGS *Rulings the code carried · Save demands*) | — | — |
| 2 | **Zone of Truth** | Enchantment |  | NATIVE | the pack resolves it: 1 effect, a save | — | — |
| 3 | **Animate Dead** | Necromancy |  | MODULE | `TWINNED_EXCEPTIONS` (metamagic.js; RULINGS *Metamagic*) | — | — |
| 3 | **Aura of Vitality** | Abjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 3 | **Beacon of Hope** | Abjuration | C | MODULE | `HEAL_REROLLS` (heal-rerolls.js · cast.js; RULINGS *The spells slice — Tiers 1 and 2*) | bend | Tier 1 |
| 3 | **Bestow Curse** | Necromancy | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 3 | **Blinding Smite** | Evocation |  | OUT | a smite: a Bonus Action cast after the hit (2026-09-03) | — | — |
| 3 | **Blink** | Transmutation |  | NATIVE | the pack resolves it: 1 effect [ethereal] | — | — |
| 3 | **Call Lightning** | Conjuration | C | NATIVE | each strike is a use; the demand at the targets covers it | — | — |
| 3 | **Clairvoyance** | Divination | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Conjure Animals** | Conjuration | C | OUT | a summon: the summoned actor's own attacks are the attacks machine's already | — | — |
| 3 | **Conjure Barrage** | Conjuration |  | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*) | — | — |
| 3 | **Counterspell** | Abjuration |  | NATIVE | the caster targets the creature and the saves machine demands its Constitution save; nothing watches the cast (the user, 2026-09-28 — RULINGS *Bent by choice*) | rule of cool | Tier 4 |
| 3 | **Create Food and Water** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Crusader's Mantle** | Evocation | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 3 | **Daylight** | Evocation |  | OUT | a ring that carries no effect | — | — |
| 3 | **Dispel Magic** | Abjuration |  | OUT | reads a spell's level on the sheet — the table's call | — | — |
| 3 | **Elemental Weapon** | Transmutation | C | NATIVE | the pack resolves it: 15 effects | — | — |
| 3 | **Fear** | Illusion | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | bend | — |
| 3 | **Feign Death** | Necromancy |  | NATIVE | the pack resolves it: 1 effect [blinded, incapacitated] | — | — |
| 3 | **Fireball** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 3 | **Fly** | Transmutation | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 3 | **Gaseous Form** | Transmutation | C | NATIVE | the pack resolves it: 1 effect [transformed], healing | — | — |
| 3 | **Glyph of Warding** | Abjuration |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 3 | **Haste** | Transmutation | C | NATIVE | measured 2026-09-28: Hasted carries the Dexterity save mode; the AC and the action are the pack's | — | Tier 1 |
| 3 | **Hunger of Hadar** | Conjuration | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 3 | **Hypnotic Pattern** | Illusion | C | MODULE | `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | — | — |
| 3 | **Leomund's Tiny Hut** | Evocation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Lightning Arrow** | Transmutation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 3 | **Lightning Bolt** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 3 | **Magic Circle** | Abjuration |  | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | bend | Tier 4 |
| 3 | **Major Image** | Illusion | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Mass Healing Word** | Abjuration |  | NATIVE | the pack resolves it: healing | — | — |
| 3 | **Meld into Stone** | Transmutation |  | NATIVE | the pack resolves it: damage | — | — |
| 3 | **Nondetection** | Abjuration |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 3 | **Phantom Steed** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Plant Growth** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Protection from Energy** | Abjuration | C | NATIVE | the pack resolves it: 5 effects | — | — |
| 3 | **Remove Curse** | Abjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Revivify** | Necromancy |  | NATIVE | the pack resolves it: damage | — | — |
| 3 | **Sending** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Sleet Storm** | Conjuration | C | MODULE | `SAVE_PRESSES` (saves/; RULINGS *Rulings the code carried · Save demands*) | — | — |
| 3 | **Slow** | Transmutation | C | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*); `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | — | — |
| 3 | **Speak with Dead** | Necromancy |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Speak with Plants** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 3 | **Spirit Guardians** | Conjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 3 | **Stinking Cloud** | Conjuration | C | NATIVE | the pack resolves it: 1 effect [poisoned], a save | — | — |
| 3 | **Summon Fey** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Summon Undead** | Necromancy | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 3 | **Tongues** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 3 | **Vampiric Touch** | Necromancy | C | MODULE | `HEAL_ON_HIT` (heal-on-hit.js; RULINGS *The spells slice — the held spells*) | — | Tier 4 |
| 3 | **Water Breathing** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 3 | **Water Walk** | Transmutation |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 3 | **Wind Wall** | Evocation | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 4 | **Arcane Eye** | Divination | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Aura of Life** | Abjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 4 | **Aura of Purity** | Abjuration | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*); `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 4 | **Banishment** | Abjuration | C | NATIVE | the pack resolves it: 1 effect [incapacitated], a save | — | — |
| 4 | **Blight** | Necromancy |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 4 | **Charm Monster** | Enchantment |  | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| 4 | **Compulsion** | Enchantment | C | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| 4 | **Confusion** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | — | — |
| 4 | **Conjure Minor Elementals** | Conjuration | C | NATIVE | the pack resolves it: damage | — | — |
| 4 | **Conjure Woodland Beings** | Conjuration | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 4 | **Control Water** | Transmutation | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 4 | **Death Ward** | Abjuration |  | MODULE | `DROP_TO_ONE` (drop-to-one.js; RULINGS *The species walk, continued*) | bend | — |
| 4 | **Dimension Door** | Conjuration |  | NATIVE | the pack resolves it: damage | — | — |
| 4 | **Divination** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Dominate Beast** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 4 | **Evard's Black Tentacles** | Conjuration | C | NATIVE | the pack resolves it: 1 effect [restrained], a save, damage | — | — |
| 4 | **Fabricate** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Fire Shield** | Evocation |  | MODULE | `DAMAGE_SHIELDS` (damage-shields.js; RULINGS *Damage shields*); `EFFECT_CHOICES` (cast.js; RULINGS *Effect choices*) | — | — |
| 4 | **Fount of Moonlight** | Evocation | C | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | bend | — |
| 4 | **Freedom of Movement** | Abjuration |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 4 | **Giant Insect** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Grasping Vine** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Greater Invisibility** | Illusion | C | NATIVE | the pack resolves it: 1 effect [invisible] | — | — |
| 4 | **Guardian of Faith** | Conjuration |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 4 | **Hallucinatory Terrain** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Ice Storm** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 4 | **Leomund's Secret Chest** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Locate Creature** | Divination | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Mordenkainen's Faithful Hound** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Mordenkainen's Private Sanctum** | Abjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Otiluke's Resilient Sphere** | Abjuration | C | NATIVE | the pack resolves it: 1 effect, a save | — | — |
| 4 | **Phantasmal Killer** | Illusion | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 4 | **Polymorph** | Transmutation | C | OUT | a shape change: the platform's transformation | — | — |
| 4 | **Staggering Smite** | Enchantment |  | OUT | a smite: a Bonus Action cast after the hit (2026-09-03) | — | — |
| 4 | **Stone Shape** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Stoneskin** | Transmutation | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 4 | **Summon Aberration** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Summon Construct** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Summon Elemental** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 4 | **Vitriolic Sphere** | Evocation |  | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| 4 | **Wall of Fire** | Evocation | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | bend | Tier 4 |
| 5 | **Animate Objects** | Transmutation | C | OUT | a summon | — | — |
| 5 | **Antilife Shell** | Abjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 5 | **Awaken** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Banishing Smite** | Conjuration | C | OUT | a smite: a Bonus Action cast after the hit (2026-09-03) | — | — |
| 5 | **Bigby's Hand** | Evocation | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Circle of Power** | Abjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*); `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 5 | **Cloudkill** | Conjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 5 | **Commune** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Commune with Nature** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Cone of Cold** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 5 | **Conjure Elemental** | Conjuration | C | OUT | a summon | — | — |
| 5 | **Conjure Volley** | Conjuration |  | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*) | — | — |
| 5 | **Contact Other Plane** | Divination |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 5 | **Contagion** | Necromancy |  | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 5 | **Creation** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Destructive Wave** | Evocation |  | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*) | — | — |
| 5 | **Dispel Evil and Good** | Abjuration | C | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 5 | **Dominate Person** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 5 | **Dream** | Illusion |  | NATIVE | the pack resolves it: 1 effect [incapacitated], a save, damage | — | — |
| 5 | **Flame Strike** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 5 | **Geas** | Enchantment |  | NATIVE | the pack resolves it: 1 effect [charmed], a save, damage | — | — |
| 5 | **Greater Restoration** | Abjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Hallow** | Abjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Hold Monster** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 5 | **Insect Plague** | Conjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| 5 | **Jallarzi's Storm of Radiance** | Evocation | C | NATIVE | the pack resolves it: 1 effect [blinded, deafened, silenced], a save, damage | — | — |
| 5 | **Legend Lore** | Divination |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Mass Cure Wounds** | Abjuration |  | NATIVE | the pack resolves it: healing | — | — |
| 5 | **Mislead** | Illusion | C | NATIVE | the pack resolves it: 1 effect [invisible] | — | — |
| 5 | **Modify Memory** | Enchantment | C | NATIVE | the pack resolves it: 1 effect [charmed, incapacitated], a save | — | — |
| 5 | **Passwall** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Planar Binding** | Abjuration |  | NATIVE | the pack resolves it: 1 effect, a save | — | — |
| 5 | **Raise Dead** | Necromancy |  | OUT | its penalty is a downtime clock, no combat moment | — | — |
| 5 | **Rary's Telepathic Bond** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 5 | **Reincarnate** | Necromancy |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Scrying** | Divination | C | NATIVE | the pack resolves it: a save | — | — |
| 5 | **Seeming** | Illusion |  | NATIVE | the pack resolves it: 1 effect, a save | — | — |
| 5 | **Steel Wind Strike** | Conjuration |  | NATIVE | the pack resolves it: an attack, damage | — | — |
| 5 | **Summon Celestial** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Summon Dragon** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Swift Quiver** | Transmutation | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 5 | **Synaptic Static** | Enchantment |  | NATIVE | measured 2026-09-28: Muddled Thoughts carries the −1d6 | — | Tier 1 |
| 5 | **Telekinesis** | Transmutation | C | NATIVE | the pack resolves it: a save | — | — |
| 5 | **Teleportation Circle** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Tree Stride** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 5 | **Wall of Force** | Evocation | C | OUT | terrain — a region the table honours, no mechanism to play | — | — |
| 5 | **Wall of Stone** | Evocation | C | OUT | terrain | — | — |
| 5 | **Yolande's Regal Presence** | Enchantment | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 6 | **Arcane Gate** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Blade Barrier** | Evocation | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 6 | **Chain Lightning** | Evocation |  | NATIVE | the leaps are the cast's own targets: the demand at the targets covers them | — | — |
| 6 | **Circle of Death** | Necromancy |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 6 | **Conjure Fey** | Conjuration | C | OUT | a summon | — | — |
| 6 | **Contingency** | Abjuration |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 6 | **Create Undead** | Necromancy |  | MODULE | `TWINNED_EXCEPTIONS` (metamagic.js; RULINGS *Metamagic*) | — | — |
| 6 | **Disintegrate** | Transmutation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 6 | **Drawmij's Instant Summons** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Eyebite** | Necromancy | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 6 | **Find the Path** | Divination | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Flesh to Stone** | Transmutation | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 6 | **Forbiddance** | Abjuration |  | NATIVE | the pack resolves it: damage | — | — |
| 6 | **Globe of Invulnerability** | Abjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Guards and Wards** | Abjuration |  | OUT | terrain and a suite of effects the table plays | — | — |
| 6 | **Harm** | Necromancy |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 6 | **Heal** | Abjuration |  | NATIVE | the pack resolves it: healing | — | — |
| 6 | **Heroes' Feast** | Conjuration |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 6 | **Magic Jar** | Necromancy |  | NATIVE | the pack resolves it: 2 effects [silenced, incapacitated], a save | — | — |
| 6 | **Mass Suggestion** | Enchantment |  | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| 6 | **Move Earth** | Transmutation | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Otiluke's Freezing Sphere** | Evocation |  | NATIVE | the pack resolves it: 1 effect [restrained], a save, damage | — | — |
| 6 | **Otto's Irresistible Dance** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | Tier 1 |
| 6 | **Planar Ally** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Programmed Illusion** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Summon Fiend** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Sunbeam** | Evocation | C | NATIVE | the pack resolves it: 1 effect [blinded], a save, damage | — | — |
| 6 | **Tasha's Bubbling Cauldron** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **Transport via Plants** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 6 | **True Seeing** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 6 | **Wall of Ice** | Evocation | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 6 | **Wall of Thorns** | Conjuration | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 6 | **Wind Walk** | Transmutation |  | NATIVE | the pack resolves it: 1 effect [transformed] | — | — |
| 6 | **Word of Recall** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Conjure Celestial** | Conjuration | C | OUT | a summon | — | — |
| 7 | **Delayed Blast Fireball** | Evocation | C | OUT | the pack's uses model the growing bead; the detonation is the table's | — | — |
| 7 | **Divine Word** | Evocation |  | NATIVE | the pack resolves it: 4 effects [dead, blinded, deafened, stunned], a save, healing | — | — |
| 7 | **Etherealness** | Conjuration |  | NATIVE | the pack resolves it: 1 effect [ethereal] | — | — |
| 7 | **Finger of Death** | Necromancy |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 7 | **Fire Storm** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 7 | **Forcecage** | Evocation | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | bend | Tier 4 |
| 7 | **Mirage Arcane** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Mordenkainen's Magnificent Mansion** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Mordenkainen's Sword** | Evocation | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Plane Shift** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Power Word Fortify** | Enchantment |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Prismatic Spray** | Evocation |  | MODULE | `RAY_TABLES` (prismatic.js; RULINGS *The spells slice — the held spells*); `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | bend | Tier 4 |
| 7 | **Project Image** | Illusion | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Regenerate** | Transmutation |  | NATIVE | the pack resolves it: 1 effect, healing | — | — |
| 7 | **Resurrection** | Necromancy |  | NATIVE | the pack resolves it: 5 effects, healing | — | — |
| 7 | **Reverse Gravity** | Transmutation | C | NATIVE | the pack resolves it: a save | — | — |
| 7 | **Sequester** | Transmutation |  | NATIVE | the pack resolves it: 1 effect [invisible, unconscious] | — | — |
| 7 | **Simulacrum** | Illusion |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 7 | **Symbol** | Abjuration |  | NATIVE | the pack resolves it: 5 effects [frightened, incapacitated, unconscious, stunned], a save, damage | — | — |
| 7 | **Teleport** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 8 | **Animal Shapes** | Transmutation |  | OUT | a shape change: the platform's transformation | — | — |
| 8 | **Antimagic Field** | Abjuration | C | OUT | a ring that carries no effect (RULINGS *Emanations*: left out) | — | — |
| 8 | **Antipathy/Sympathy** | Enchantment |  | NATIVE | the pack resolves it: 4 effects [frightened, charmed], a save | — | — |
| 8 | **Befuddlement** | Enchantment |  | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| 8 | **Clone** | Necromancy |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 8 | **Control Weather** | Transmutation | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 8 | **Demiplane** | Conjuration |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 8 | **Dominate Monster** | Enchantment | C | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| 8 | **Earthquake** | Transmutation | C | NATIVE | the pack resolves it: 1 effect [prone], a save, damage | — | — |
| 8 | **Glibness** | Enchantment |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 8 | **Holy Aura** | Abjuration | C | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*); `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 8 | **Incendiary Cloud** | Conjuration | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 8 | **Maze** | Conjuration | C | NATIVE | the pack resolves it: 1 effect | — | — |
| 8 | **Mind Blank** | Abjuration |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 8 | **Power Word Stun** | Enchantment |  | NATIVE | the pack resolves it: 2 effects [stunned], healing | — | — |
| 8 | **Sunburst** | Evocation |  | NATIVE | the pack resolves it: 1 effect [blinded], a save, damage | — | — |
| 8 | **Telepathy** | Divination |  | NATIVE | the pack resolves it: 1 effect | — | — |
| 8 | **Tsunami** | Conjuration | C | NATIVE | the pack resolves it: a save, damage | — | — |
| 9 | **Astral Projection** | Necromancy |  | NATIVE | the pack resolves it: 1 effect [unconscious] | — | — |
| 9 | **Foresight** | Divination |  | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| 9 | **Gate** | Conjuration | C | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 9 | **Imprisonment** | Abjuration |  | NATIVE | the pack resolves it: 5 effects [restrained, unconscious], a save | — | — |
| 9 | **Mass Heal** | Abjuration |  | NATIVE | the pack resolves it: healing | — | — |
| 9 | **Meteor Swarm** | Evocation |  | NATIVE | the pack resolves it: a save, damage | — | — |
| 9 | **Power Word Heal** | Enchantment |  | NATIVE | the pack resolves it: healing | — | — |
| 9 | **Power Word Kill** | Enchantment |  | NATIVE | the pack resolves it: damage | — | — |
| 9 | **Prismatic Wall** | Abjuration |  | NATIVE | the pack resolves it: 3 effects [blinded, restrained], a save, damage | — | — |
| 9 | **Shapechange** | Transmutation | C | OUT | a shape change: the platform's transformation | — | — |
| 9 | **Storm of Vengeance** | Conjuration | C | NATIVE | the pack resolves it: 1 effect [deafened], a save, damage | — | — |
| 9 | **Time Stop** | Transmutation |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 9 | **True Polymorph** | Transmutation | C | OUT | a shape change: the platform's transformation | — | — |
| 9 | **True Resurrection** | Necromancy |  | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| 9 | **Weird** | Illusion | C | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*) | — | — |
| 9 | **Wish** | Conjuration |  | OUT | the table's, entirely | — | — |
