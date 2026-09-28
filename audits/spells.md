# The PHB spells

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.spells`. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

391 rows · 240 with a family · 24 of those text-only · 50 named in the registry

Families: press-condition 138 · half-on-save 118 · rider-damage 78 · clock 43 · resist 24 · bend-save 17 · temp-hp 16 · volley 16 · bend-attack 14 · movement 12 · concentration 12 · aura 9 · reaction 9 · d20-fold 4 · use-chip 4 · interrupt 3 · ac-passive 1

## With a family (240)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 0 | **Acid Splash** | rider-damage, press-condition | save dmg action |  | You create an acidic bubble at a point within range, where it explodes in a 5-foot-radius Sphere. Each creatur… |
| 0 | **Chill Touch** | rider-damage, clock, temp-hp | fx1 atk dmg action | ✓ EFFECT_BENDS, EFFECT_BENDS.from | Channeling the chill of the grave, make a melee spell attack against a target within reach. On a hit, the targ… |
| 0 | **Eldritch Blast** | volley | atk dmg action | ✓ VOLLEY | You hurl a beam of crackling energy. Make a ranged spell attack against one creature or object in range. On a… |
| 0 | **Fire Bolt** | rider-damage | atk dmg action |  | You hurl a mote of fire at a creature or an object within range. Make a ranged spell attack against the target… |
| 0 | **Friends** | press-condition | fx1[charmed] save action |  | You magically emanate a sense of friendship toward one creature you can see within range. The target must succ… |
| 0 | **Mind Sliver** | rider-damage | fx1 save dmg action |  | You try to temporarily sliver the mind of one creature you can see within range. The target must succeed on an… |
| 0 | **Poison Spray** | rider-damage | atk dmg action |  | You spray toxic mist at a creature within range. Make a ranged spell attack against the target. On a hit, the… |
| 0 | **Prestidigitation** | clock | action **TEXT** |  | You create a magical effect within range. Choose the effect from the options below. If you cast this spell mul… |
| 0 | **Produce Flame** | rider-damage | atk dmg bonus |  | A flickering flame appears in your hand and remains there for the duration. While there, the flame emits no he… |
| 0 | **Ray of Frost** | rider-damage, clock | fx1 atk dmg action |  | A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against t… |
| 0 | **Resistance** | clock | fx11 action |  | You touch a willing creature and choose a damage type: Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Pie… |
| 0 | **Sacred Flame** | rider-damage, press-condition | save dmg action |  | Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexteri… |
| 0 | **Shocking Grasp** | rider-damage, clock, movement | fx1 atk dmg action | ✓ EFFECT_BENDS, EFFECT_BENDS.from | Lightning springs from you to a creature that you try to touch. Make a melee spell attack against the target.… |
| 0 | **Sorcerous Burst** | rider-damage, d20-fold | atk dmg action |  | You cast sorcerous energy at one creature or object within range. Make a ranged attack roll against the target… |
| 0 | **Starry Wisp** | rider-damage, clock | fx1 atk dmg action |  | You launch a mote of light at one creature or object within range. Make a ranged spell attack against the targ… |
| 0 | **Thorn Whip** | rider-damage | atk dmg action |  | You create a vine-like whip covered in thorns that lashes out at your command toward a creature in range. Make… |
| 0 | **Thunderclap** | rider-damage, press-condition | save dmg action |  | Each creature in a 5-foot Emanation originating from you must succeed on a Constitution saving throw or take 1… |
| 0 | **Toll the Dead** | rider-damage, press-condition | save dmg action |  | You point at one creature you can see within range, and the single chime of a dolorous bell is audible within… |
| 0 | **Vicious Mockery** | bend-attack, rider-damage, use-chip, press-condition | fx1 save dmg action | ✓ EFFECT_BENDS.from, EFFECT_BENDS | You unleash a string of insults laced with subtle enchantments at one creature you can see or hear within rang… |
| 0 | **Word of Radiance** | rider-damage, press-condition | save dmg action | ✓ CHOSEN_AREAS | Burning radiance erupts from you in a 5-foot Emanation. Each creature of your choice that you can see in it mu… |
| 1 | **Animal Friendship** | press-condition, half-on-save | fx1[charmed] save action |  | Target a Beast that you can see within range. The target must succeed on a Wisdom saving throw or have the Ref… |
| 1 | **Armor of Agathys** | temp-hp | dmg bonus | ✓ DAMAGE_SHIELDS | Protective magical frost surrounds you. You gain 5 Temporary Hit Points. If a creature hits you with a melee a… |
| 1 | **Arms of Hadar** | rider-damage, clock, press-condition, half-on-save | fx1 save dmg action |  | Invoking Hadar, you cause tendrils to erupt from yourself. Each creature in a 10-foot Emanation originating fr… |
| 1 | **Bane** | half-on-save | fx1 save action |  | Up to three creatures of your choice that you can see within range must each make a Charisma saving throw. Whe… |
| 1 | **Burning Hands** | rider-damage, press-condition, half-on-save | save dmg action |  | A thin sheet of flames shoots forth from you. Each creature in a 15-foot Cone makes a Dexterity saving throw,… |
| 1 | **Charm Person** | press-condition, half-on-save | fx1[charmed] save action |  | One Humanoid you can see within range makes a Wisdom saving throw. It does so with Advantage if you or your al… |
| 1 | **Chromatic Orb** | rider-damage | atk dmg action |  | You hurl an orb of energy at a target within range. Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for… |
| 1 | **Color Spray** | clock, press-condition, half-on-save | fx1[blinded] save action |  | You launch a dazzling array of flashing, colorful light. Each creature in a 15-foot Cone originating from you… |
| 1 | **Command** | press-condition, half-on-save, aura | save action |  | You speak a one-word command to a creature you can see within range. The target must succeed on a Wisdom savin… |
| 1 | **Compelled Duel** | bend-attack, press-condition, half-on-save | fx1 save bonus | ✓ EFFECT_BENDS.from | You try to compel a creature into a duel. One creature that you can see within range makes a Wisdom saving thr… |
| 1 | **Cure Wounds** | temp-hp | action |  | A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier. Usin… |
| 1 | **Dissonant Whispers** | rider-damage, press-condition, half-on-save | save dmg action |  | One creature of your choice that you can see within range hears a discordant melody in its mind. The target ma… |
| 1 | **Divine Favor** | rider-damage | fx1 bonus |  | Until the spell ends, your attacks with weapons deal an extra 1d4 Radiant damage on a hit. |
| 1 | **Divine Smite** | rider-damage | dmg bonus |  | The target takes an extra 2d8 Radiant damage from the attack. The damage increases by 1d8 if the target is a F… |
| 1 | **Ensnaring Strike** | rider-damage, press-condition, half-on-save | fx1[restrained] save dmg bonus |  | As you hit the target, grasping vines appear on it, and it makes a Strength saving throw. A Large or larger cr… |
| 1 | **Entangle** | press-condition, half-on-save | fx1[restrained] save action |  | Grasping plants sprout from the ground in a 20-foot square within range. For the duration, these plants turn t… |
| 1 | **Faerie Fire** | half-on-save | fx1 save action | ✓ SPENT_AREAS | Objects in a 20-foot Cube within range are outlined in blue, green, or violet light (your choice). Each creatu… |
| 1 | **False Life** | temp-hp | action |  | You gain 2d4 + 4 Temporary Hit Points. Using a Higher-Level Spell Slot. You gain 5 additional Temporary Hit Po… |
| 1 | **Feather Fall** | interrupt, reaction | reaction **TEXT** |  | Choose up to five falling creatures within range. A falling creature’s rate of descent slows to 60 feet per ro… |
| 1 | **Find Familiar** | clock, reaction, aura | hour **TEXT** |  | You gain the service of a familiar, a spirit that takes an animal form you choose: Bat , Cat , Frog , Hawk , L… |
| 1 | **Grease** | press-condition, half-on-save | save action | ✓ SAVE_PRESSES | Nonflammable grease covers the ground in a 10-foot square centered on a point within range and turns it into R… |
| 1 | **Guiding Bolt** | rider-damage, use-chip, volley | fx1[marked] atk dmg action | ✓ EFFECT_BENDS, EFFECT_BENDS.from | You hurl a bolt of light toward a creature within range. Make a ranged spell attack against the target. On a h… |
| 1 | **Hail of Thorns** | rider-damage, press-condition, half-on-save | save dmg bonus |  | As you hit the creature, this spell creates a rain of thorns that sprouts from your Ranged weapon or ammunitio… |
| 1 | **Healing Word** | temp-hp | bonus |  | A creature of your choice that you can see within range regains Hit Points equal to 2d4 plus your spellcasting… |
| 1 | **Hellish Rebuke** | rider-damage, interrupt, reaction, press-condition, half-on-save | save dmg reaction | ✓ REBUKES | The creature that damaged you is momentarily surrounded by green flames. It makes a Dexterity saving throw, ta… |
| 1 | **Heroism** | temp-hp, resist | fx1 action |  | A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to the Frigh… |
| 1 | **Hex** | rider-damage, concentration | fx6[cursed] dmg bonus | ✓ RIDER | You place a curse on a creature that you can see within range. Until the spell ends, you deal an extra 1d6 Nec… |
| 1 | **Hunter's Mark** | rider-damage, concentration | fx1[marked] dmg bonus | ✓ RIDER | You magically mark one creature you can see within range as your quarry. Until the spell ends, you deal an ext… |
| 1 | **Ice Knife** | rider-damage, press-condition | save atk dmg action |  | You create a shard of ice and fling it at one creature within range. Make a ranged spell attack against the ta… |
| 1 | **Inflict Wounds** | rider-damage, press-condition, half-on-save | save dmg action |  | A creature you touch makes a Constitution saving throw, taking 2d10 Necrotic damage on a failed save or half a… |
| 1 | **Longstrider** | movement | fx1 action |  | You touch a creature. The target’s Speed increases by 10 feet until the spell ends. Using a Higher-Level Spell… |
| 1 | **Mage Armor** | ac-passive | fx1 action |  | You touch a willing creature who isn’t wearing armor. Until the spell ends, the target’s base AC becomes 13 pl… |
| 1 | **Magic Missile** | volley | dmg action | ✓ VOLLEY | You create three glowing darts of magical force. Each dart strikes a creature of your choice that you can see… |
| 1 | **Protection from Evil and Good** | bend-attack, bend-save | fx1 action | ✓ EFFECT_BENDS.from, EFFECT_BENDS | Until the spell ends, one willing creature you touch is protected against creatures that are Aberrations, Cele… |
| 1 | **Ray of Sickness** | rider-damage, clock, volley | fx1[poisoned] atk dmg action |  | You shoot a greenish ray at a creature within range. Make a ranged spell attack against the target. On a hit,… |
| 1 | **Searing Smite** | rider-damage, press-condition | fx1 save dmg bonus |  | As you hit the target, it takes an extra 1d6 Fire damage from the attack. At the start of each of its turns un… |
| 1 | **Shield** | clock, interrupt, reaction | fx1 reaction | ✓ LIST:INTERRUPTS, BLOCKS | An imperceptible barrier of magical force protects you. Until the start of your next turn, you have a +5 bonus… |
| 1 | **Sleep** | bend-save, clock, press-condition, half-on-save, resist | fx1[incapacitated] save action | ✓ SPENT_AREAS, CHOSEN_AREAS | Each creature of your choice in a 5-foot-radius Sphere centered on a point within range must succeed on a Wisd… |
| 1 | **Tasha's Hideous Laughter** | press-condition, half-on-save | fx1[incapacitated,prone] save action |  | One creature of your choice that you can see within range makes a Wisdom saving throw. On a failed save, it ha… |
| 1 | **Tenser's Floating Disk** | aura | action **TEXT** |  | This spell creates a circular, horizontal plane of force, 3 feet in diameter and 1 inch thick, that floats 3 f… |
| 1 | **Thunderous Smite** | rider-damage, press-condition | fx1[prone] save dmg bonus |  | Your strike rings with thunder that is audible within 300 feet of you, and the target takes an extra 2d6 Thund… |
| 1 | **Thunderwave** | rider-damage, press-condition, half-on-save | save dmg action |  | You unleash a wave of thunderous energy. Each creature in a 15-foot Cube originating from you makes a Constitu… |
| 1 | **Unseen Servant** | clock, movement | action **TEXT** |  | This spell creates an Invisible, mindless, shapeless, Medium force that performs simple tasks at your command… |
| 1 | **Witch Bolt** | rider-damage, volley | fx1 atk dmg action |  | A beam of crackling energy lances toward a creature within range, forming a sustained arc of lightning between… |
| 1 | **Wrathful Smite** | rider-damage, press-condition | fx1[frightened] save dmg bonus |  | The target takes an extra 1d6 Necrotic damage from the attack, and it must succeed on a Wisdom saving throw or… |
| 2 | **Alter Self** | movement | fx3 atk dmg action |  | You alter your physical form. Choose one of the following options. Its effects last for the duration, during w… |
| 2 | **Animal Messenger** | bend-save, press-condition, half-on-save | fx1 save action |  | A Tiny Beast of your choice that you can see within range must succeed on a Charisma saving throw, or it attem… |
| 2 | **Arcane Vigor** | temp-hp | bonus |  | You tap into your life force to heal yourself. Roll one or two of your unexpended Hit Point Dice, and regain a… |
| 2 | **Blindness/Deafness** | press-condition, half-on-save | fx2[blinded,deafened] save action |  | One creature that you can see within range must succeed on a Constitution saving throw, or it has the Referenc… |
| 2 | **Blur** | bend-attack, resist | fx1 action | ✓ EFFECT_BENDS.from | Your body becomes blurred. For the duration, any creature has Disadvantage on attack rolls against you. An att… |
| 2 | **Calm Emotions** | press-condition, half-on-save, resist | fx2 save action | ✓ SPENT_AREAS | Each Humanoid in a 20-foot-radius Sphere centered on a point you choose within range must succeed on a Charism… |
| 2 | **Cloud of Daggers** | rider-damage, clock | dmg action |  | You conjure spinning daggers in a 5-foot Cube centered on a point within range. Each creature in that area tak… |
| 2 | **Cordon of Arrows** | press-condition, volley | save dmg uses action |  | You touch up to four nonmagical Arrows or Bolts and plant them in the ground in your space. Until the spell en… |
| 2 | **Crown of Madness** | press-condition, half-on-save | fx1[charmed] save action |  | One creature that you can see within range must succeed on a Wisdom saving throw or have the Charmed condition… |
| 2 | **Detect Thoughts** | press-condition, half-on-save | save action |  | You activate one of the effects below. Until the spell ends, you can activate either effect as a Magic action… |
| 2 | **Dragon's Breath** | rider-damage, press-condition, half-on-save | save dmg bonus |  | You touch one willing creature, and choose Acid, Cold, Fire, Lightning, or Poison. Until the spell ends, the t… |
| 2 | **Enlarge/Reduce** | rider-damage, half-on-save | fx2 save action |  | For the duration, the spell enlarges or reduces a creature or an object you can see within range (see the chos… |
| 2 | **Enthrall** | bend-save, press-condition, half-on-save | fx1 save action |  | You weave a distracting string of words, causing creatures of your choice that you can see within range to mak… |
| 2 | **Flame Blade** | rider-damage | atk dmg bonus |  | You evoke a fiery blade in your free hand. The blade is similar in size and shape to a scimitar, and it lasts… |
| 2 | **Flaming Sphere** | rider-damage, press-condition, half-on-save | save dmg action |  | You create a 5-foot-diameter sphere of fire in an unoccupied space on the ground within range. It lasts for th… |
| 2 | **Gust of Wind** | press-condition, half-on-save | save action |  | A Line of strong wind 60 feet long and 10 feet wide blasts from you in a direction you choose for the duration… |
| 2 | **Heat Metal** | bend-attack, rider-damage, clock, press-condition | fx1 save dmg action | ✓ EFFECT_BENDS.from, DAMAGE_SAVES | Choose a manufactured metal object, such as a metal weapon or a suit of Heavy or Medium metal armor, that you… |
| 2 | **Hold Person** | press-condition, half-on-save | fx1[paralyzed] save action |  | Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or have the… |
| 2 | **Levitate** | half-on-save | fx1 save action |  | One creature or loose object of your choice that you can see within range rises vertically up to 20 feet and r… |
| 2 | **Magic Weapon** | d20-fold | fx3 bonus |  | You touch a nonmagical weapon. Until the spell ends, that weapon becomes a magic weapon with a +1 bonus to att… |
| 2 | **Mind Spike** | rider-damage, press-condition, half-on-save | fx1 save dmg action |  | You drive a spike of psionic energy into the mind of one creature you can see within range. The target makes a… |
| 2 | **Moonbeam** | rider-damage, clock, press-condition, half-on-save, volley | save dmg action |  | A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high Cylinder centered on a point within… |
| 2 | **Phantasmal Force** | press-condition | fx1 save dmg action |  | You attempt to craft an illusion in the mind of a creature you can see within range. The target makes an Intel… |
| 2 | **Protection from Poison** | bend-save, resist | fx1 action |  | You touch a creature and end the Reference[poisoned] condition on it. For the duration, the target has Advanta… |
| 2 | **Ray of Enfeeblement** | bend-attack, clock, use-chip, press-condition, half-on-save, volley | fx2 save action | ✓ EFFECT_BENDS.from | A beam of enervating energy shoots from you toward a creature within range. The target must make a Constitutio… |
| 2 | **Scorching Ray** | volley | atk dmg action | ✓ VOLLEY | You hurl three fiery rays. You can hurl them at one target within range or at several. Make a ranged spell att… |
| 2 | **Shatter** | rider-damage, press-condition, half-on-save | save dmg action |  | A loud noise erupts from a point of your choice within range. Each creature in a 10-foot-radius Sphere centere… |
| 2 | **Shining Smite** | bend-attack, rider-damage | fx1[marked] dmg bonus | ✓ EFFECT_BENDS.from | The target hit by the strike takes an extra 2d6 Radiant damage from the attack. Until the spell ends, the targ… |
| 2 | **Silence** | resist | fx1[deafened,silenced] action |  | For the duration, no sound can be created within or pass through a 20-foot-radius Sphere centered on a point y… |
| 2 | **Spike Growth** | movement | dmg action |  | The ground in a 20-foot-radius Sphere centered on a point within range sprouts hard spikes and thorns. The are… |
| 2 | **Spiritual Weapon** | rider-damage | bonus **TEXT** |  | You create a floating, spectral force that resembles a weapon of your choice and lasts for the duration. The f… |
| 2 | **Suggestion** | press-condition, half-on-save | fx1[charmed] save action |  | You suggest a course of activity—described in no more than 25 words—to one creature you can see within range t… |
| 2 | **Warding Bond** | aura | fx1 action |  | You touch another creature that is willing and create a mystic connection between you and the target until the… |
| 2 | **Web** | press-condition | save dmg action | ✓ SAVE_PRESSES | You conjure a mass of sticky webbing at a point within range. The webs fill a 20-foot Cube there for the durat… |
| 2 | **Zone of Truth** | press-condition, half-on-save | fx1 save action |  | You create a magical zone that guards against deception in a 15-foot-radius Sphere centered on a point within… |
| 3 | **Beacon of Hope** | bend-save | fx1 action |  | Choose any number of creatures within range. For the duration, each target has Advantage on Wisdom saving thro… |
| 3 | **Bestow Curse** | bend-attack, rider-damage, press-condition, half-on-save, concentration | fx9[cursed] save dmg action | ✓ EFFECT_BENDS.from | You touch a creature, which must succeed on a Wisdom saving throw or become cursed for the duration. Until the… |
| 3 | **Blinding Smite** | rider-damage | fx1[blinded] save dmg bonus |  | The target hit by the strike takes an extra 3d8 Radiant damage from the attack, and the target has the Referen… |
| 3 | **Call Lightning** | rider-damage, press-condition, half-on-save, volley | save dmg action |  | A storm cloud appears at a point within range that you can see above yourself. It takes the shape of a Cylinde… |
| 3 | **Conjure Animals** | bend-save, rider-damage, clock, press-condition, half-on-save | save dmg action |  | You conjure nature spirits that appear as a Large pack of spectral, intangible animals in an unoccupied space… |
| 3 | **Conjure Barrage** | rider-damage, press-condition, half-on-save | save dmg action | ✓ CHOSEN_AREAS | You brandish the weapon used to cast the spell and conjure similar spectral weapons (or ammunition appropriate… |
| 3 | **Counterspell** | reaction, press-condition, half-on-save | save reaction |  | You attempt to interrupt a creature in the process of casting a spell. The creature makes a Constitution savin… |
| 3 | **Crusader's Mantle** | rider-damage | fx1 action | ✓ EMANATIONS | You radiate a magical aura in a 30-foot Emanation. While in the aura, you and your allies each deal an extra 1… |
| 3 | **Elemental Weapon** | rider-damage, d20-fold | fx15 action |  | A nonmagical weapon you touch becomes a magic weapon. Choose one of the following damage types: Acid, Cold, Fi… |
| 3 | **Fear** | press-condition, half-on-save | fx1[frightened] save action | ✓ SPENT_AREAS | Each creature in a 30-foot Cone must succeed on a Wisdom saving throw or drop whatever it is holding and have… |
| 3 | **Feign Death** | resist | fx1[blinded,incapacitated] action |  | You touch a willing creature and put it into a cataleptic state that is indistinguishable from death. For the… |
| 3 | **Fireball** | rider-damage, press-condition, half-on-save | save dmg action |  | A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a f… |
| 3 | **Gaseous Form** | resist | fx1[transformed] action |  | A willing creature you touch shape-shifts, along with everything it’s wearing and carrying, into a misty cloud… |
| 3 | **Glyph of Warding** | half-on-save | save dmg hour |  | You inscribe a glyph that later unleashes a magical effect. You inscribe it either on a surface (such as a tab… |
| 3 | **Haste** | bend-save, clock | fx2[incapacitated] action |  | Choose a willing creature that you can see within range. Until the spell ends, the target’s Speed is doubled,… |
| 3 | **Hunger of Hadar** | press-condition | save dmg action |  | You open a gateway to the Far Realm, a region infested with unspeakable horrors. A 20-foot-radius Sphere of Re… |
| 3 | **Hypnotic Pattern** | press-condition, half-on-save | fx1[charmed,incapacitated] save action | ✓ SPENT_AREAS | You create a twisting pattern of colors in a 30-foot Cube within range. The pattern appears for a moment and v… |
| 3 | **Lightning Arrow** | press-condition, half-on-save | save dmg bonus |  | As your attack hits or misses the target, the weapon or ammunition you’re using transforms into a lightning bo… |
| 3 | **Lightning Bolt** | rider-damage, press-condition, half-on-save | save dmg action |  | A stroke of lightning forming a 100-foot-long, 5-foot-wide Line blasts out from you in a direction you choose.… |
| 3 | **Magic Circle** | bend-attack, half-on-save | save minute |  | You create a 10-foot-radius, 20-foot-tall Cylinder of magical energy centered on a point on the ground that yo… |
| 3 | **Major Image** | concentration | action **TEXT** |  | You create the image of an object, a creature, or some other visible phenomenon that is no larger than a 20-fo… |
| 3 | **Mass Healing Word** | temp-hp | bonus |  | Up to six creatures of your choice that you can see within range regain Hit Points equal to 2d4 plus your spel… |
| 3 | **Protection from Energy** | resist | fx5 action |  | For the duration, the willing creature you touch has Resistance to one damage type of your choice: Acid, Cold,… |
| 3 | **Sleet Storm** | press-condition, half-on-save, concentration | save action | ✓ SAVE_PRESSES | Until the spell ends, sleet falls in a 40-foot-tall, 20-foot-radius Cylinder centered on a point you choose wi… |
| 3 | **Slow** | press-condition, half-on-save | fx1 save action | ✓ MASTERY, SPENT_AREAS, CHOSEN_AREAS | You alter time around up to six creatures of your choice in a 40-foot Cube within range. Each target must succ… |
| 3 | **Speak with Plants** | movement | fx1 action |  | You imbue plants in an immobile 30-foot Emanation with limited sentience and animation, giving them the abilit… |
| 3 | **Spirit Guardians** | rider-damage, clock, press-condition, half-on-save | fx1 save dmg action | ✓ EMANATIONS | Protective spirits flit around you in a 15-foot Emanation for the duration. If you are good or neutral, their… |
| 3 | **Stinking Cloud** | clock, use-chip, press-condition | fx1[poisoned] save action |  | You create a 20-foot-radius Sphere of yellow, nauseating gas centered on a point within range. The cloud is Re… |
| 3 | **Vampiric Touch** | rider-damage, temp-hp | atk dmg action |  | The touch of your shadow-wreathed hand can siphon life force from others to heal your wounds. Make a melee spe… |
| 3 | **Wind Wall** | press-condition, half-on-save | save dmg action |  | A wall of strong wind rises from the ground at a point you choose within range. You can make the wall up to 50… |
| 4 | **Aura of Life** | resist | fx1 action | ✓ EMANATIONS | An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have… |
| 4 | **Aura of Purity** | bend-save, resist | fx1 action | ✓ EFFECT_BENDS, EFFECT_BENDS.from, EMANATIONS | An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have… |
| 4 | **Banishment** | press-condition, half-on-save | fx1[incapacitated] save action |  | One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harm… |
| 4 | **Blight** | bend-save, rider-damage, press-condition, half-on-save | save dmg action |  | A creature that you can see within range makes a Constitution saving throw, taking 8d8 Necrotic damage on a fa… |
| 4 | **Charm Monster** | press-condition, half-on-save | fx1[charmed] save action |  | One creature you can see within range makes a Wisdom saving throw. It does so with Advantage if you or your al… |
| 4 | **Compulsion** | press-condition, half-on-save | fx1[charmed] save action |  | Each creature of your choice that you can see within range must succeed on a Wisdom saving throw or have the C… |
| 4 | **Confusion** | press-condition, half-on-save | fx1 save action | ✓ SPENT_AREAS | Each creature in a 10-foot-radius Sphere centered on a point you choose within range must succeed on a Wisdom… |
| 4 | **Conjure Minor Elementals** | rider-damage | dmg action |  | You conjure spirits from the Elemental Planes that flit around you in a 15-foot Emanation for the duration. Un… |
| 4 | **Conjure Woodland Beings** | rider-damage, clock, press-condition, half-on-save | save dmg action |  | You conjure nature spirits that flit around you in a 10-foot Emanation for the duration. Whenever the Emanatio… |
| 4 | **Control Water** | half-on-save | save dmg action |  | Until the spell ends, you control any water inside an area you choose that is a Cube up to 100 feet on a side,… |
| 4 | **Dominate Beast** | reaction, press-condition, half-on-save, concentration | fx1[charmed] save action |  | One Beast you can see within range must succeed on a Wisdom saving throw or have the Reference[Charmed apply=f… |
| 4 | **Evard's Black Tentacles** | clock, press-condition, half-on-save | fx1[restrained] save dmg action |  | Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, th… |
| 4 | **Fire Shield** | resist | fx2 dmg action | ✓ DAMAGE_SHIELDS, EFFECT_CHOICES | Wispy flames wreathe your body for the duration, shedding Bright Light in a 10-foot radius and Dim Light for a… |
| 4 | **Fount of Moonlight** | rider-damage, clock, reaction, press-condition, half-on-save, resist | fx2[blinded] save action | ✓ REBUKES | A cool light wreathes your body for the duration, emitting Bright Light in a 20-foot radius and Dim Light for… |
| 4 | **Freedom of Movement** | movement | fx1 action |  | You touch a willing creature. For the duration, the target’s movement is unaffected by Reference[DifficultTerr… |
| 4 | **Greater Invisibility** | press-condition | fx1[invisible] action |  | A creature you touch has the Invisible condition until the spell ends. |
| 4 | **Guardian of Faith** | press-condition, half-on-save | save dmg action |  | A Large spectral guardian appears and hovers for the duration in an unoccupied space that you can see within r… |
| 4 | **Ice Storm** | rider-damage, clock, press-condition, half-on-save | save dmg action |  | Hail falls in a 20-foot-radius, 40-foot-high Cylinder centered on a point within range. Each creature in the C… |
| 4 | **Mordenkainen's Faithful Hound** | press-condition | action **TEXT** |  | You conjure a phantom watchdog in an unoccupied space that you can see within range. The hound remains for the… |
| 4 | **Otiluke's Resilient Sphere** | press-condition, half-on-save, resist | fx1 save action |  | A shimmering sphere encloses a Large or smaller creature or object within range. An unwilling creature must su… |
| 4 | **Phantasmal Killer** | bend-attack, rider-damage, press-condition, half-on-save | fx1 save dmg action |  | You tap into the nightmares of a creature you can see within range and create an illusion of its deepest fears… |
| 4 | **Polymorph** | press-condition, half-on-save, temp-hp | save action |  | You attempt to transform a creature that you can see within range into a Beast. The target must succeed on a W… |
| 4 | **Staggering Smite** | rider-damage, clock, press-condition | save dmg bonus |  | The target takes an extra 4d6 Psychic damage from the attack, and the target must succeed on a Wisdom saving t… |
| 4 | **Vitriolic Sphere** | rider-damage, press-condition, half-on-save | fx1 save dmg action |  | You point at a location within range, and a glowing, 1-foot-diameter ball of acid streaks there and explodes i… |
| 4 | **Wall of Fire** | rider-damage, press-condition, half-on-save | save dmg action |  | You create a wall of fire on a solid surface within range. You can make the wall up to 60 feet long, 20 feet h… |
| 5 | **Animate Objects** | rider-damage | action **TEXT** |  | Objects animate at your command. Choose a number of nonmagical objects within range that aren’t being worn or… |
| 5 | **Banishing Smite** | rider-damage, press-condition | fx1[incapacitated] save dmg bonus |  | The target hit by the attack roll takes an extra 5d10 Force damage from the attack. If the attack reduces the… |
| 5 | **Circle of Power** | bend-save, half-on-save | fx1 action | ✓ EFFECT_BENDS.from, EMANATIONS | An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have… |
| 5 | **Cloudkill** | rider-damage, clock, press-condition, half-on-save | save dmg action |  | You create a 20-foot-radius Sphere of yellow-green fog centered on a point within range. The fog lasts for the… |
| 5 | **Cone of Cold** | rider-damage, press-condition, half-on-save | save dmg action |  | You unleash a blast of cold air. Each creature in a 60-foot Cone originating from you makes a Constitution sav… |
| 5 | **Conjure Elemental** | rider-damage, press-condition | action **TEXT** |  | You conjure a Large, intangible spirit from the Elemental Planes that appears in an unoccupied space within ra… |
| 5 | **Conjure Volley** | press-condition, half-on-save | save dmg action | ✓ CHOSEN_AREAS | You brandish the weapon used to cast the spell and choose a point within range. Hundreds of similar spectral w… |
| 5 | **Contact Other Plane** | press-condition, half-on-save | save dmg minute |  | You mentally contact a demigod, the spirit of a long-dead sage, or some other knowledgeable entity from anothe… |
| 5 | **Contagion** | bend-save, press-condition | fx6[poisoned] save dmg action |  | Your touch inflicts a magical contagion. The target must succeed on a Constitution saving throw or take 11d8 N… |
| 5 | **Destructive Wave** | press-condition, half-on-save | fx1[prone] save dmg action | ✓ CHOSEN_AREAS | Destructive energy ripples outward from you in a 30-foot Emanation. Each creature you choose in the Emanation… |
| 5 | **Dispel Evil and Good** | bend-attack, press-condition, half-on-save | save action | ✓ EFFECT_BENDS.from | For the duration, Celestials, Elementals, Fey, Fiends, and Undead have Disadvantage on attack rolls against yo… |
| 5 | **Dominate Person** | reaction, press-condition, half-on-save, concentration | fx1[charmed] save action |  | One Humanoid you can see within range must succeed on a Wisdom saving throw or have the Reference[Charmed appl… |
| 5 | **Dream** | press-condition, half-on-save | fx1[incapacitated] save dmg minute |  | You target a creature you know on the same plane of existence. You or a willing creature you touch enters a tr… |
| 5 | **Flame Strike** | press-condition, half-on-save | save dmg action |  | A vertical column of brilliant fire roars down from above. Each creature in a 10-foot-radius, 40-foot-high Cyl… |
| 5 | **Geas** | bend-save, press-condition | fx1[charmed] save dmg minute |  | You give a verbal command to a creature that you can see within range, ordering it to carry out some service o… |
| 5 | **Hold Monster** | press-condition, half-on-save | fx1[paralyzed] save action |  | Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or have the… |
| 5 | **Insect Plague** | rider-damage, clock, press-condition, half-on-save | save dmg action |  | Swarming locusts fill a 20-foot-radius Sphere centered on a point you choose within range. The Sphere remains… |
| 5 | **Jallarzi's Storm of Radiance** | clock, press-condition, half-on-save | fx1[blinded,deafened,silenced] save dmg action |  | You unleash a storm of flashing light and raging thunder in a 10-foot-radius, 40-foot-high Cylinder centered o… |
| 5 | **Mass Cure Wounds** | temp-hp | action |  | A wave of healing energy washes out from a point you can see within range. Choose up to six creatures in a 30-… |
| 5 | **Mislead** | movement | fx1[invisible] action |  | You gain the Reference[Invisible apply=false] condition at the same time that an illusory double of you appear… |
| 5 | **Modify Memory** | press-condition, half-on-save | fx1[charmed,incapacitated] save action |  | You attempt to reshape another creature’s memories. One creature that you can see within range makes a Wisdom… |
| 5 | **Planar Binding** | press-condition, half-on-save | fx1 save hour |  | You attempt to bind a Celestial, an Elemental, a Fey, or a Fiend to your service. The creature must be within… |
| 5 | **Raise Dead** | bend-save | fx4 hour |  | With a touch, you revive a dead creature if it has been dead no longer than 10 days and it wasn’t Undead when… |
| 5 | **Scrying** | press-condition, half-on-save | save minute |  | You can see and hear a creature you choose that is on the same plane of existence as you. The target makes a W… |
| 5 | **Seeming** | half-on-save | fx1 save action |  | You give an illusory appearance to each creature of your choice that you can see within range. An unwilling ta… |
| 5 | **Swift Quiver** | volley | fx1 bonus |  | When you cast the spell and as a Bonus Action until it ends, you can make two attacks with a weapon that fires… |
| 5 | **Synaptic Static** | press-condition, half-on-save, concentration | fx1 save dmg action |  | You cause psychic energy to erupt at a point within range. Each creature in a 20-foot-radius Sphere centered o… |
| 5 | **Telekinesis** | clock, press-condition | save action |  | You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell and as a M… |
| 5 | **Teleportation Circle** | clock | minute **TEXT** |  | As you cast the spell, you draw a 5-foot-radius circle on the ground inscribed with sigils that link your loca… |
| 5 | **Tree Stride** | clock | action **TEXT** |  | You gain the ability to enter a tree and move from inside it to inside another tree of the same kind within 50… |
| 5 | **Wall of Force** | resist | action **TEXT** |  | An Invisible wall of force springs into existence at a point you choose within range. The wall appears in any… |
| 5 | **Wall of Stone** | resist, movement | action **TEXT** |  | A nonmagical wall of solid stone springs into existence at a point you choose within range. The wall is 6 inch… |
| 5 | **Yolande's Regal Presence** | clock, press-condition, half-on-save | save dmg action |  | You surround yourself with unearthly majesty in a 10-foot Emanation. Whenever the Emanation enters the space o… |
| 6 | **Arcane Gate** | aura | action **TEXT** |  | You create linked teleportation portals. Choose two Large, unoccupied spaces on the ground that you can see, o… |
| 6 | **Blade Barrier** | clock, press-condition, half-on-save, movement | save dmg action |  | You create a wall of whirling blades made of magical energy. The wall appears within range and lasts for the d… |
| 6 | **Chain Lightning** | press-condition, half-on-save, volley | save dmg action |  | You launch a lightning bolt toward a target you can see within range. Three bolts then leap from that target t… |
| 6 | **Circle of Death** | rider-damage, press-condition, half-on-save | save dmg action |  | Negative energy ripples out in a 60-foot-radius Sphere from a point you choose within range. Each creature in… |
| 6 | **Conjure Fey** | rider-damage, clock | action **TEXT** |  | You conjure a Medium spirit from the Feywild in an unoccupied space you can see within range. The spirit lasts… |
| 6 | **Disintegrate** | rider-damage, press-condition, volley | save dmg action |  | You launch a green ray at a target you can see within range. The target can be a creature, a nonmagical object… |
| 6 | **Eyebite** | press-condition, half-on-save, aura | fx3[unconscious,frightened,poisoned] save action |  | For the duration, your eyes become an inky void. One creature of your choice within 60 feet of you that you ca… |
| 6 | **Flesh to Stone** | bend-save, clock, press-condition, half-on-save, concentration | fx2[restrained] save action |  | You attempt to turn one creature that you can see within range into stone. The target makes a Constitution sav… |
| 6 | **Guards and Wards** | resist | hour **TEXT** |  | You create a ward that protects up to 2,500 square feet of floor space. The warded area can be up to 20 feet t… |
| 6 | **Harm** | press-condition, half-on-save | save dmg action |  | You unleash virulent magic on a creature you can see within range. The target makes a Constitution saving thro… |
| 6 | **Heroes' Feast** | resist | fx1 uses minute |  | You conjure a feast that appears on a surface in an unoccupied 10-foot Cube next to you. The feast takes 1 hou… |
| 6 | **Magic Jar** | press-condition, aura | fx2[silenced,incapacitated] save minute |  | Your body falls into a catatonic state as your soul leaves it and enters the container you used for the spell’… |
| 6 | **Mass Suggestion** | press-condition | fx1[charmed] save action |  | You suggest a course of activity—described in no more than 25 words—to twelve or fewer creatures you can see w… |
| 6 | **Otiluke's Freezing Sphere** | rider-damage, half-on-save | fx1[restrained] save dmg uses action |  | A frigid globe streaks from you to a point of your choice within range, where it explodes in a 60-foot-radius… |
| 6 | **Otto's Irresistible Dance** | bend-attack, bend-save, clock, press-condition | fx2[charmed] save action |  | One creature that you can see within range must make a Wisdom saving throw. On a successful save, the target d… |
| 6 | **Sunbeam** | clock, press-condition, half-on-save | fx1[blinded] save dmg action |  | You launch a sunbeam in a 5-foot-wide, 60-foot-long Line. Each creature in the Line makes a Constitution savin… |
| 6 | **Tasha's Bubbling Cauldron** | aura | uses action **TEXT** |  | You conjure a claw-footed cauldron filled with bubbling liquid. The cauldron appears in an unoccupied space on… |
| 6 | **Wall of Ice** | press-condition, half-on-save, resist | save dmg action |  | You create a wall of ice on a solid surface within range. You can form it into a hemispherical dome or a globe… |
| 6 | **Wall of Thorns** | clock, press-condition, half-on-save | save dmg action |  | You create a wall of tangled brush bristling with needle-sharp thorns. The wall appears within range on a soli… |
| 6 | **Wind Walk** | resist | fx1[transformed] minute |  | You and up to ten willing creatures of your choice within range assume gaseous forms for the duration, appeari… |
| 7 | **Conjure Celestial** | clock, press-condition, half-on-save, temp-hp | save dmg action |  | You conjure a spirit from the Upper Planes, which manifests as a pillar of light in a 10-foot-radius, 40-foot-… |
| 7 | **Delayed Blast Fireball** | rider-damage, press-condition, half-on-save, volley | save dmg uses action |  | A beam of yellow light flashes from you, then condenses at a chosen point within range as a glowing bead for t… |
| 7 | **Divine Word** | press-condition | fx4[dead,blinded,deafened,stunned] save bonus |  | You utter a word imbued with power from the Upper Planes. Each creature of your choice in range makes a Charis… |
| 7 | **Finger of Death** | press-condition, half-on-save | save dmg action |  | You unleash negative energy toward a creature you can see within range. The target makes a Constitution saving… |
| 7 | **Fire Storm** | press-condition, half-on-save | save dmg action |  | A storm of fire appears within range. The area of the storm consists of up to ten 10-foot Cubes, which you arr… |
| 7 | **Forcecage** | press-condition | action **TEXT** |  | An immobile, Invisible, Cube-shaped prison composed of magical force springs into existence around an area you… |
| 7 | **Mirage Arcane** | movement | minute **TEXT** |  | You make terrain in an area up to 1 mile square look, sound, smell, and even feel like some other sort of terr… |
| 7 | **Power Word Fortify** | temp-hp | uses action **TEXT** |  | You fortify up to six creatures you can see within range. The spell bestows 120 Temporary Hit Points, which yo… |
| 7 | **Prismatic Spray** | half-on-save, volley | fx2[restrained,blinded] save dmg action |  | Eight rays of light flash from you in a 60-foot Cone. Each creature in the Cone makes a Dexterity saving throw… |
| 7 | **Sequester** | press-condition | fx1[invisible,unconscious] action |  | With a touch, you magically sequester an object or a willing creature. For the duration, the target has the In… |
| 7 | **Simulacrum** | aura | hour **TEXT** |  | You create a simulacrum of one Beast or Humanoid that is within 10 feet of you for the entire casting of the s… |
| 7 | **Symbol** | half-on-save | fx5[frightened,incapacitated,unconscious,stunned] save dmg minute |  | You inscribe a harmful glyph either on a surface (such as a section of floor or wall) or within an object that… |
| 8 | **Animal Shapes** | temp-hp | action **TEXT** |  | Choose any number of willing creatures that you can see within range. Each target shape-shifts into a Large or… |
| 8 | **Antipathy/Sympathy** | half-on-save, resist | fx4[frightened,charmed] save hour |  | As you cast the spell, choose whether it creates antipathy or sympathy, and target one creature or object that… |
| 8 | **Befuddlement** | press-condition, half-on-save | fx1 save dmg action |  | You blast the mind of a creature that you can see within range. The target makes an Intelligence saving throw.… |
| 8 | **Dominate Monster** | reaction, press-condition, half-on-save, concentration | fx1[charmed] save action |  | One creature you can see within range must succeed on a Wisdom saving throw or have the Reference[Charmed appl… |
| 8 | **Earthquake** | press-condition, half-on-save, concentration, movement | fx1[prone] save dmg action |  | Choose a point on the ground that you can see within range. For the duration, an intense tremor rips through t… |
| 8 | **Holy Aura** | bend-attack, bend-save, clock, press-condition, half-on-save | fx2[blinded] save action | ✓ EFFECT_BENDS.from, EMANATIONS | For the duration, you emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Ad… |
| 8 | **Incendiary Cloud** | clock, press-condition, half-on-save | save dmg action |  | A swirling cloud of embers and smoke fills a 20-foot-radius Sphere centered on a point within range. The cloud… |
| 8 | **Mind Blank** | resist | fx1 action |  | Until the spell ends, one willing creature you touch has Immunity to Psychic damage and the Charmed condition.… |
| 8 | **Power Word Stun** | clock, press-condition | fx2[stunned] action |  | You overwhelm the mind of one creature you can see within range. If the target has 150 Hit Points or fewer, it… |
| 8 | **Sunburst** | press-condition, half-on-save | fx1[blinded] save dmg action |  | Brilliant sunlight flashes in a 60-foot-radius Sphere centered on a point you choose within range. Each creatu… |
| 8 | **Tsunami** | press-condition, half-on-save | save dmg uses minute |  | A wall of water springs into existence at a point you choose within range. You can make the wall up to 300 fee… |
| 9 | **Foresight** | bend-attack | fx1 minute | ✓ EFFECT_BENDS, EFFECT_BENDS.from | You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration,… |
| 9 | **Imprisonment** | press-condition, half-on-save, resist | fx5[restrained,unconscious] save minute |  | You create a magical restraint to hold a creature that you can see within range. The target must make a Wisdom… |
| 9 | **Meteor Swarm** | press-condition, half-on-save | save dmg action |  | Blazing orbs of fire plummet to the ground at four different points you can see within range. Each creature in… |
| 9 | **Prismatic Wall** | press-condition, half-on-save | fx3[blinded,restrained] save dmg action |  | A shimmering, multicolored plane of light forms a vertical opaque wall—up to 90 feet long, 30 feet high, and 1… |
| 9 | **Shapechange** | temp-hp | action **TEXT** |  | You shape-shift into another creature for the duration or until you take a Magic action to shape-shift into a… |
| 9 | **Storm of Vengeance** | press-condition, half-on-save, volley | fx1[deafened] save dmg action |  | A churning storm cloud forms for the duration, centered on a point within range and spreading to a radius of 3… |
| 9 | **True Polymorph** | concentration, temp-hp | save action |  | Choose one creature or nonmagical object that you can see within range. The creature shape-shifts into a diffe… |
| 9 | **Weird** | press-condition, half-on-save | fx1[frightened] save dmg action | ✓ CHOSEN_AREAS | You try to create illusory terrors in others’ minds. Each creature of your choice in a 30-foot-radius Sphere c… |
| 9 | **Wish** | d20-fold, resist | fx1 action |  | Wish is the mightiest spell a mortal can cast. By simply speaking aloud, you can alter reality itself. The bas… |

## No family (151)

L0 Blade Ward · L0 Dancing Lights · L0 Druidcraft · L0 Elementalism · L0 Guidance · L0 Light · L0 Mage Hand · L0 Mending · L0 Message · L0 Minor Illusion · L0 Shillelagh · L0 Spare the Dying · L0 Thaumaturgy · L0 True Strike · L1 Alarm · L1 Bless · L1 Comprehend Languages · L1 Create or Destroy Water · L1 Detect Evil and Good · L1 Detect Magic · L1 Detect Poison and Disease · L1 Disguise Self · L1 Expeditious Retreat · L1 Fog Cloud · L1 Goodberry · L1 Identify · L1 Illusory Script · L1 Jump · L1 Purify Food and Drink · L1 Sanctuary · L1 Shield of Faith · L1 Silent Image · L1 Speak with Animals · L2 Aid · L2 Arcane Lock · L2 Augury · L2 Barkskin · L2 Beast Sense · L2 Continual Flame · L2 Darkness · L2 Darkvision · L2 Enhance Ability · L2 Find Steed · L2 Find Traps · L2 Gentle Repose · L2 Invisibility · L2 Knock · L2 Lesser Restoration · L2 Locate Animals or Plants · L2 Locate Object · L2 Magic Mouth · L2 Melf's Acid Arrow · L2 Mirror Image · L2 Misty Step · L2 Nystul's Magic Aura · L2 Pass without Trace · L2 Prayer of Healing · L2 Rope Trick · L2 See Invisibility · L2 Spider Climb · L2 Summon Beast · L3 Animate Dead · L3 Aura of Vitality · L3 Blink · L3 Clairvoyance · L3 Create Food and Water · L3 Daylight · L3 Dispel Magic · L3 Fly · L3 Leomund's Tiny Hut · L3 Meld into Stone · L3 Nondetection · L3 Phantom Steed · L3 Plant Growth · L3 Remove Curse · L3 Revivify · L3 Sending · L3 Speak with Dead · L3 Summon Fey · L3 Summon Undead · L3 Tongues · L3 Water Breathing · L3 Water Walk · L4 Arcane Eye · L4 Death Ward · L4 Dimension Door · L4 Divination · L4 Fabricate · L4 Giant Insect · L4 Grasping Vine · L4 Hallucinatory Terrain · L4 Leomund's Secret Chest · L4 Locate Creature · L4 Mordenkainen's Private Sanctum · L4 Stone Shape · L4 Stoneskin · L4 Summon Aberration · L4 Summon Construct · L4 Summon Elemental · L5 Antilife Shell · L5 Awaken · L5 Bigby's Hand · L5 Commune · L5 Commune with Nature · L5 Creation · L5 Greater Restoration · L5 Hallow · L5 Legend Lore · L5 Passwall · L5 Rary's Telepathic Bond · L5 Reincarnate · L5 Steel Wind Strike · L5 Summon Celestial · L5 Summon Dragon · L6 Contingency · L6 Create Undead · L6 Drawmij's Instant Summons · L6 Find the Path · L6 Forbiddance · L6 Globe of Invulnerability · L6 Heal · L6 Move Earth · L6 Planar Ally · L6 Programmed Illusion · L6 Summon Fiend · L6 Transport via Plants · L6 True Seeing · L6 Word of Recall · L7 Etherealness · L7 Mordenkainen's Magnificent Mansion · L7 Mordenkainen's Sword · L7 Plane Shift · L7 Project Image · L7 Regenerate · L7 Resurrection · L7 Reverse Gravity · L7 Teleport · L8 Antimagic Field · L8 Clone · L8 Control Weather · L8 Demiplane · L8 Glibness · L8 Maze · L8 Telepathy · L9 Astral Projection · L9 Gate · L9 Mass Heal · L9 Power Word Heal · L9 Power Word Kill · L9 Time Stop · L9 True Resurrection
