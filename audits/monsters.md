# The Monster Manual's traits

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-monster-manual.features` (the SRD 2024 subset deduplicated under it). Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

675 rows · 251 with a family · 64 of those text-only · 35 named in the registry

Families: half-on-save 84 · clock 73 · reaction 35 · resist 29 · bend-attack 23 · temp-hp 19 · movement 10 · press-condition 10 · bend-save 7 · concentration 7 · interrupt 7 · use-chip 4 · volley 2 · crit 2 · d20-fold 1

## With a family (251)

| Type | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
|  | **Aberrant Ground** | movement | **TEXT** |  | The ground in a [[lookup @target.template.size activity=zVznqPXgYjETqpQz]]-foot Emanation originating from the… |
|  | **Absorb Body** | bend-save | fx1[restrained] save |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=YqWqaRXxaKFCH6P8]], one [[lookup @target.affects.sp… |
|  | **Acid Absorption** | temp-hp | fx1 |  | Whenever the [[lookup @name lowercase]] is subjected to Reference[Acid] damage, it takes no damage and instead… |
|  | **Acid Breath** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=qNI6W02jCUQbPpYE]], each [[lookup @target.affects.… |
|  | **Acid Spray** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=20GU2JBM5zJfNPD1]], each [[lookup @target.affects.… |
|  | **Agile** | movement | **TEXT** |  | The [[lookup @name lowercase]] doesn’t provoke an Reference[opportunityattacks]{Opportunity Attack} when it mo… |
|  | **Aim** | bend-attack, use-chip | fx1 | ✓ EFFECT_BENDS.from | The [[lookup @name lowercase]] has Advantage on the next attack roll it makes during the current turn. |
|  | **Animal Spirit** | bend-attack, clock, half-on-save, temp-hp | fx2[marked] save dmg |  | The [[lookup @name lowercase]] conjures an animal spirit that strikes at a creature and then disappears. Dexte… |
|  | **Antennae** | half-on-save | fx1 save |  | The [[lookup @name lowercase]] targets one [[lookup @target.affects.special activity=dcSC7EuknnM0uoqY]] object… |
|  | **Aura of Authority** | bend-attack | **TEXT** |  | While in a [[lookup @target.template.size activity=dE4lg9tZyXtoCb5x]]-foot Emanation originating from the [[lo… |
|  | **Aura of Bravery** | resist | fx1[charmed,frightened] |  | Creatures of the [[lookup @name lowercase]]'s choice in a [[lookup @target.template.size activity=N8uK4xdPCXdk… |
|  | **Avoidance** | press-condition, half-on-save | **TEXT** |  | If the [[lookup @name lowercase]] is subjected to an effect that allows it to make a saving throw to take only… |
|  | **Beard** | temp-hp | fx1[poisoned] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] con… |
|  | **Beguile** | clock | **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCommand000] , req… |
|  | **Beguiling Song** | half-on-save | fx1[charmed] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=rbe2FvPTepUsO4GL]], each creature in a [[lookup @targ… |
|  | **Berserk** | clock | fx1 |  | Whenever the [[lookup @name lowercase]] starts its turn Reference[Bloodied], roll [[/r 1d6]]. On a 6, the [[lo… |
|  | **Blinding Breath** | half-on-save | fx1[blinded] save uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=soAO2jRWos8FsxeU]], each creature in a [[lookup @t… |
|  | **Blinding Flash** | half-on-save | fx1[blinded] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=Onad9uNiCzAMfuwf]], each creature in a [[lookup… |
|  | **Blinding Gaze** | clock, half-on-save | fx1[blinded] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=B6xM8C2pABIb5o7y]], one creature the [[lookup @… |
|  | **Blood Frenzy** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | The [[lookup @name lowercase]] has Advantage on attack rolls against any creature that doesn’t have all its Hi… |
|  | **Bloodied Frenzy** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | While Reference[Bloodied], the [[lookup @name lowercase]] has Advantage on attack rolls and saving throws. |
|  | **Bloodied Fury** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | While Reference[Bloodied], the [[lookup @name lowercase]] has Advantage on attack rolls. |
|  | **Blurred Form** | press-condition | **TEXT** |  | Attack rolls against the [[lookup @name lowercase]] are made with Disadvantage unless the [[lookup @name lower… |
|  | **Bolster** | clock, temp-hp | fx1 |  | The [[lookup @name lowercase]] gains [[lookup @healing.formula activity=v5km8Vio4N6HgkF6]] Temporary Hit Point… |
|  | **Boulder Toss** | half-on-save | save dmg uses |  | The [[lookup @name lowercase]] hurls a boulder at a point it can see within [[lookup @range.value activity=jpC… |
|  | **Bubble Dash** | movement | **TEXT** |  | While underwater, the [[lookup @name lowercase]] moves up to its Swim Speed without provoking Reference[Opport… |
|  | **Burst of Ingenuity** | reaction | uses **TEXT** |  | Trigger: The [[lookup @name]] or another creature within [[lookup @range.value activity=AyYipNx3cFaXA0LU]] fee… |
|  | **Cacophony** | half-on-save | fx1[deafened] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=pyvvXqoxJsjkkP38]], one creature in the [[lookup @nam… |
|  | **Captain's Charm** | half-on-save | fx1[charmed] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=3o27u4Ww7SmCgc8k]], one creature the [[lookup @name l… |
|  | **Captain’s Charm** | half-on-save | fx1[charmed] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=3o27u4Ww7SmCgc8k]], one creature the [[lookup @name l… |
|  | **Captivated** | clock | fx1[charmed,incapacitated] |  | The target has the Reference[Charmed apply=false] condition until the end of its next turn. While Charmed, the… |
|  | **Cataclysmic Event** | clock, half-on-save | fx5[burning,blinded,deafened,prone,coverTotal,restrained,suffocation] save dmg uses |  | The [[lookup @name lowercase]] creates one of the following effects at random (roll [[/r 1d4#Cataclysmic Event… |
|  | **Charging Horn** | movement | **TEXT** |  | The [[lookup @name lowercase]] moves up to half its Speed without provoking Reference[Opportunity Attacks], an… |
|  | **Chill** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses [[/item Spellcasting]] to cast @UUID[Compendium.dnd-players-handbook.spell… |
|  | **Chilling Gaze** | resist | fx1[paralyzed] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=EREXmcv7YU7T9pj6]], one creature the [[lookup @… |
|  | **Cinder Breath** | half-on-save | fx1[blinded] save uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=tb7VfYTYKzOxuE5S]], one creature the [[lookup @nam… |
|  | **Cloaked Flight** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses [[/item Spellcasting]] to cast @UUID[Compendium.dnd-players-handbook.spell… |
|  | **Cloud of Insects** | bend-save, clock, concentration | fx1 save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=0OkFhjOM80ipoNKy]], one creature the [[lookup @nam… |
|  | **Cold Breath** | half-on-save | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=8P7hmd3Nron4RAIv]], each [[lookup @target.affec… |
|  | **Cold Gale** | clock, half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=pVs8BTVDNh54CZ0a]], each creature in a [[lookup @t… |
|  | **Commanding Presence** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses [[/item Spellcasting]] to cast @UUID[Compendium.dnd-players-handbook.spell… |
|  | **Confer Fire Resistance** | resist | fx1 |  | The [[lookup @name lowercase]] can grant Resistance to Fire damage to a rider while it is on the [[lookup @nam… |
|  | **Conjured Dragon’s Breath** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=kONz26XFQN0nYcDS]], each [[lookup @target.affects.… |
|  | **Consume Memories** | half-on-save | save dmg |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=uI3HDQ1grN123Or3]], [[lookup @target.affects.la… |
|  | **Counterattack** | reaction | fx1 | ✓ LIST:INTERRUPTS | Trigger : The [[lookup @name lowercase]] is hit by an attack roll. Response: The [[lookup @name lowercase]] ad… |
|  | **Counterspell** | reaction | uses **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCounterspe]{Count… |
|  | **Crackling Wave** | half-on-save | fx1[cursed] save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=ZtSx3SmaUHh2Ws7L]], each creature in a [[lookup @t… |
|  | **Create Whirlwind** | clock, concentration | fx1[restrained] save dmg |  | The [[lookup @name lowercase]] conjures a whirlwind at a point it can see within 120 feet. The whirlwind fills… |
|  | **Crush** | bend-attack | fx2[blinded,suffocation] atk |  | [[/attack extended]]. [[/damage average extended]], and the [[lookup @name lowercase]] attaches to the target.… |
|  | **Darkness Aura** | concentration | uses **TEXT** |  | Magical Darkness fills a [[lookup @target.template.size activity=amat5Ii4NydseA0h]]-foot Emanation originating… |
|  | **Deadly Aim** | bend-attack, use-chip | fx1 dmg | ✓ EFFECT_BENDS.from | The [[lookup @name lowercase]] gives itself Advantage on the next attack roll it makes during the current turn… |
|  | **Deadly Leap** | half-on-save | fx1[prone] save dmg |  | The [[lookup @name lowercase]] spends 5 feet of movement to jump to a space within 15 feet that contains one o… |
|  | **Death Burst** | half-on-save | save dmg |  | The [[lookup @name lowercase]] explodes [[lookup @activation.condition activity=1SfqWSp7RSyHgG4b]]. Dexterity… |
|  | **Decay** | clock | dmg |  | The [[lookup @name lowercase]] deals [[/damage average]] damage [[lookup @target.affects.special activity=Seq1… |
|  | **Defensive Stance** | clock, reaction | fx1 | ✓ LIST:INTERRUPTS | Trigger: The [[lookup @name lowercase]] is hit by a melee attack roll while holding a weapon. Response: The [[… |
|  | **Deflect Missile** | interrupt, reaction | save dmg uses |  | Trigger: The [[lookup @name lowercase]] is [[lookup @activation.condition activity=9T8cNbSBVACrrmRI]]. Respons… |
|  | **Displacement** | press-condition | **TEXT** |  | Attack rolls against the [[lookup @name lowercase]] have Disadvantage, since it projects an illusion that make… |
|  | **Disrupt Life** | clock, half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=qSz7l1czwIc5j9gP]], each [[lookup @target.affec… |
|  | **Divine Beam** | half-on-save, volley | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=MM0CWfZkvWYQQt2f]], each [[lookup @target.affects.… |
|  | **Dominate Mind** | half-on-save | fx1[charmed] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=zdXAMnjaOcsVmLZP]], one [[lookup @target.affects.type… |
|  | **Dragon's Breath** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=YfxQb5tcONgLb2nD]], each [[lookup @target.affects.… |
|  | **Dragon’s Breath** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=YfxQb5tcONgLb2nD]], each [[lookup @target.affects.… |
|  | **Draining Kiss** | half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=kFyuof0SS3nohP0f]], one [[lookup @target.affect… |
|  | **Dread Authority** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses Spellcasting to cast @UUID[Compendium.dnd-players-handbook.spells.Item.phb… |
|  | **Dread Command** | clock | **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCommand000]{Comma… |
|  | **Dread Scythe** | clock, temp-hp | fx1 atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target can’t regain Hit Points until the end of it… |
|  | **Dreadful Glare** | resist | fx1[frightened] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=8LmlZfevSQkOxGSN]], one [[lookup @target.affects.type… |
|  | **Dreadful Howl** | half-on-save | fx1[frightened] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=xToMbcg9i9oSf06f]], each [[lookup @target.affects.typ… |
|  | **Drone** | bend-save, resist | fx1[unconscious] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=zHx1Cn6jyRMmYxir]], each [[lookup @target.affec… |
|  | **Elemental Absorption** | reaction, resist | fx5 uses |  | Trigger: The [[lookup @name lowercase]] [[lookup @activation.condition activity=5HvUimjPYvPVM4g7]]. Response:… |
|  | **Energy Drain** | clock | save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=3jwFie9se3ZA1RvG]], one [[lookup @target.affect… |
|  | **Entangling Trail** | clock | fx1[restrained] save dmg uses |  | The [[lookup @name lowercase]] moves up to its Speed without provoking Reference[OpportunityAttacks]. Each [[l… |
|  | **Euphoria Breath** | half-on-save | fx1[incapacitated] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=Q6P0Nz8WgIKLlnNT]], each [[lookup @target.affects.typ… |
| 7 | **Evasion** | press-condition, half-on-save | **TEXT** | ✓ EVASION | If the [[lookup @name lowercase]] is subjected to an effect that allows it to make a Dexterity saving throw to… |
|  | **Extract Brain** | half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=DinjHW2u6r40l57Y]], [[lookup @target.affects.la… |
|  | **Eye Rays** | clock, half-on-save, d20-fold, volley | fx9[charmed,paralyzed,frightened,poisoned,unconscious,restrained,petrified] save dmg |  | The [[lookup @name lowercase]] randomly shoots one of the following magical rays at a target it can see within… |
|  | **Fear Aura** | clock, resist | fx1[frightened] save |  | The [[lookup @name lowercase]] emanates an aura in a [[lookup @target.template.size activity=oT8238p9jXwVy76c]… |
|  | **Fear of Fire** | bend-attack, clock | fx1 | ✓ EFFECT_BENDS.from | If the [[lookup @name lowercase]] takes Fire damage, it has Disadvantage on attack rolls and ability checks un… |
|  | **Fearful** | clock | fx1[frightened] |  | The target has the Reference[Frightened apply=false] condition until the end of its next turn. |
|  | **Fell Word** | clock | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=S5DW2VUgJWNBmquE]], [[lookup @target.affects.la… |
|  | **Fetid Aura** | clock | fx1[poisoned] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=viDmXaiaC23yBh98]], any creature that starts it… |
|  | **Fetid Cloud** | clock | fx1[poisoned] save uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=vRnhmBCQqIwIlfS4]], each creature in a [[lookup… |
|  | **Fiendish Blood** | reaction | fx1[cursed] save dmg |  | Trigger: The [[lookup @name lowercase]] takes Piercing or Slashing damage. Response—Constitution Saving Throw:… |
|  | **Fiery Rays** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses [[/item Spellcasting]] to cast @UUID[Compendium.dnd-players-handbook.spell… |
|  | **Fire Absorption** | temp-hp | **TEXT** |  | Whenever the [[lookup @name lowercase]] is subjected to Fire damage, it regains a number of Hit Points equal t… |
|  | **Fire Breath** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=bDqgmtLG3zcVuqdi]], each [[lookup @target.affects.… |
|  | **Flash of Light** | bend-attack | fx1 atk | ✓ EFFECT_BENDS.from | [[/attack extended]]. [[/damage average extended]], and the target has Disadvantage on attack rolls until the… |
|  | **Fling** | half-on-save | fx1[prone] save dmg |  | The [[lookup @name lowercase]] throws a [[lookup @target.affects.special activity=E7YKnUIWsavrnNzK]] Grappled… |
|  | **Flyby** | movement | **TEXT** |  | The [[lookup @name lowercase]] doesn’t provoke an Reference[OpportunityAttacks]{Opportunity Attack} when it fl… |
|  | **Freeze** | clock | fx1 |  | If the [[lookup @name lowercase]] takes Cold damage, its Speed decreases by 20 feet until the end of its next… |
|  | **Freezing Burst** | clock | fx1 save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=U2i9u4ELjeLQfePP]], each [[lookup @target.affec… |
|  | **Frenzied Rush** | movement | **TEXT** |  | Each [[lookup @target.affects.type activity=1t3bIyTSzFgXzzCb]] within [[lookup @range.value activity=1t3bIyTSz… |
|  | **Frightening Gaze** | clock | **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplFear000000]{Fear}… |
|  | **Frightful Presence** | clock | **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplFear000000]{Fear}… |
|  | **Frost Breath** | half-on-save | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=ChLJgxjftTSMSRHe]], each [[lookup @target.affec… |
|  | **Giggling Magic** | clock, half-on-save | fx1 save dmg |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=Ttrajc4RC5Ut7pkj]], [[lookup @target.affects.labels… |
|  | **Gnash** | half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=CNoawEWxNhs5HRIk]], [[lookup @target.affects.label… |
|  | **Gouge** | clock | fx1[poisoned] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] con… |
|  | **Grasping Glob** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses Restraining Glob. The [[lookup @name lowercase]] can’t take this action ag… |
|  | **Grasping Root** | half-on-save | fx1[grappled] save dmg |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=t4WdQWTV3tN4xcdO]], [[lookup @target.affects.specia… |
|  | **Grave-Dust Flight** | clock | fx1[blinded] save |  | The [[lookup @name lowercase]] flies up to its Fly Speed, shedding grave dust. Each [[lookup @target.affects.t… |
|  | **Great Bow** | clock | fx1 atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target’s Speed decreases by 10 feet until the end… |
|  | **Greater Magic Resistance** | bend-save | **TEXT** |  | The [[lookup @name lowercase]] automatically succeeds on saving throws against spells and other magical effect… |
|  | **Hail of Stone** | half-on-save | fx1[prone] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=wVQbYLwPnJlczoss]], each [[lookup @target.affec… |
|  | **Hammer Throw** | bend-attack, use-chip | fx1 atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target is pushed up to 15 feet straight away from… |
|  | **Heart Sight** | bend-save, press-condition | save |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=NqVrZShDV1L3zBA3]], one [[lookup @target.affects.ty… |
|  | **Hellfire Orb** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=q3tW0wl3eLe2rDU9]], each [[lookup @target.affects.… |
|  | **Hellish Rebuke** | reaction | uses **TEXT** | ✓ REBUKES | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplHellishReb]{Helli… |
|  | **Holy Burst** | half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=HrgMO1rsQla47fff]], each [[lookup @target.affects.… |
|  | **Holy Word** | half-on-save | fx1[stunned] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=hDo31s3Eg9EW7GUZ]], each [[lookup @target.affects.typ… |
|  | **Horrific Necrosis** | clock | fx1[frightened] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Frightened apply=false] c… |
|  | **Horrific Visage** | resist | fx1[frightened] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=v8KiqUloIE5eocSu]], each creature in a [[lookup @targ… |
|  | **Horrify** | resist | fx1[frightened] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=HLddTFpf4viIdEOL]], [[lookup @target.affects.labels.s… |
|  | **Horror Nimbus** | resist | fx1[frightened] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=GP5MnIyXCVZ4ZMTQ]], each [[lookup @target.affects.typ… |
|  | **Hunger of Yeenoghu** | half-on-save, concentration | fx1[concentrating] save dmg uses |  | The [[lookup @name lowercase]] conjures a [[lookup @target.template.size activity=sIJYYjLHqCAPxOLm]]-[[lookup… |
|  | **Hypnotic Gaze** | resist | fx1[stunned] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=Sc5RbdImboeEd4zt]], each [[lookup @target.affects.typ… |
|  | **Ice Spear** | clock | fx1 atk dmg |  | [[/attack extended]]. Hit: [[/damage average]] damage. Until the end of its next turn, the target can’t take a… |
|  | **Ice Walk** | movement | **TEXT** |  | The [[lookup @name lowercase]] can move across and climb icy surfaces without needing to make an ability check… |
|  | **Incorporeal Movement** | movement | **TEXT** |  | The [[lookup @name lowercase]] can move through other creatures and objects as if they were Reference[Difficul… |
|  | **Infernal Sting** | temp-hp | fx1[poisoned] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] con… |
|  | **Inferno Blast** | half-on-save | fx1[exhaustion] save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=ta7GjruJh1oJ4cz3]], each [[lookup @target.affects.… |
|  | **Ink Cloud** | reaction | fx1[blinded] |  | Trigger : The [[lookup @name lowercase]] takes damage while underwater. Response : The [[lookup @name lowercas… |
|  | **Jinx** | interrupt, reaction | save |  | Trigger: A creature the [[lookup @name lowercase]] can see hits it with an attack roll. Response—Wisdom Saving… |
|  | **Life Suppression** | temp-hp | **TEXT** |  | Creatures within [[lookup @target.template.size activity=n7LC7M3BMXe8n2Ro]] feet of the [[lookup @name lowerca… |
|  | **Life-Draining Root** | temp-hp | fx1[grappled,restrained] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=3wTX71UEAiIZ5cr4]], [[lookup @target.affects.sp… |
|  | **Light Sensitivity** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | While in Bright Light, the [[lookup @name lowercase]] has Disadvantage on attack rolls. |
|  | **Lightning Absorption** | temp-hp | **TEXT** |  | Whenever the [[lookup @name lowercase]] is subjected to Lightning damage, it regains a number of Hit Points eq… |
|  | **Lightning Breath** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=LpjgVwftzGNMgTUJ]], each [[lookup @target.affects.… |
|  | **Lightning Storm** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=YVri6iuieFUUiO1d]], each creature in a [[lookup @t… |
|  | **Lightning Strike** | half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=v39JwGqgfaKiA4vc]], one [[lookup @target.affects.t… |
|  | **Limited Foresight** | bend-attack, reaction | uses **TEXT** |  | Trigger: A creature the [[lookup @name lowercase]] can see makes an attack roll against it. Response: The [[lo… |
|  | **Living Shadow** | resist | fx1 |  | While in Dim Light or Darkness, the [[lookup @name lowercase]] has Resistance to damage that isn’t Force, Psyc… |
|  | **Loathsome Limbs** | temp-hp | fx6[exhaustion] uses |  | If the [[lookup @name lowercase]] ends any turn Bloodied and took 15+ Slashing damage during that turn, one of… |
|  | **Lordly Presence** | clock | fx3[charmed,incapacitated,frightened] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=IlmzjggKrDB1c9dr]], any [[lookup @target.affects.type… |
|  | **Luring Song** | concentration, resist | fx1[charmed,incapacitated] save |  | The [[lookup @name lowercase]] sings a magical melody, which lasts until the [[lookup @name lowercase]]’s Conc… |
|  | **Magic Resistance** | bend-save | **TEXT** |  | The [[lookup @name lowercase]] has Advantage on saving throws against spells and other magical effects. |
|  | **Magic Rope** | resist | **TEXT** |  | The [[lookup @name lowercase]] has a magic rope. While bearing it, the [[lookup @name lowercase]] can use the… |
|  | **Magical Backlash** | reaction | save dmg |  | Trigger: A [[lookup @target.affects.type activity=Xo0DP0xMs25LpqJ6]] within [[lookup @range.value activity=Xo0… |
|  | **Majestic Song** | half-on-save | fx2[charmed,frightened] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=6TeipSZlJHOJTSZQ]], each [[lookup @target.affects.typ… |
|  | **Malicious Magic** | clock | **TEXT** |  | Malicious Magic. The [[lookup @name lowercase]] uses Spellcasting to cast @UUID[Compendium.dnd-players-handboo… |
|  | **Maneuver** | reaction, movement | **TEXT** |  | One [[lookup @target.affects.type activity=WMz2y2H5SLCDAxCF]] who can see or hear the [[lookup @name lowercase… |
|  | **Marked as Prey** | bend-attack | fx1 | ✓ EFFECT_BENDS.from | The [[lookup @name lowercase]] has Advantage on attack rolls against the target until the start of the [[looku… |
|  | **Marshal Undead** | bend-attack, press-condition | fx1 | ✓ EFFECT_BENDS.from | [[lookup @target.affects.special activity=WbzFmVAOPQ7eL6IW]] creatures of the [[lookup @name lowercase]]’s cho… |
|  | **Mind Blast** | half-on-save | fx1[stunned] save dmg uses |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=lHIQgEzz6hc3hjWx]], each [[lookup @target.affec… |
|  | **Mind Burst** | half-on-save | fx1[stunned] save dmg uses |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=T0ybbd1ZrLCdEXsW]], [[lookup @target.affects.la… |
|  | **Mind Corrosion** | reaction | dmg |  | Trigger: The [[lookup @name lowercase]] fails a saving throw against a spell or another magical effect created… |
|  | **Mind Jolt** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses Spellcasting to cast @UUID[Compendium.dnd-players-handbook.spells.Item.phb… |
|  | **Mind Rot** | half-on-save | fx1[poisoned] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=DvEIJK7HFwBWNpkq]], [[lookup @target.affects.labels.s… |
|  | **Mired** | clock | fx1 dmg |  | The target takes [[/damage average]] damage, and the target is magically bewildered until the end of its next… |
|  | **Moan** | resist | fx1[frightened] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=Mng39fcFDc4I1AzY]], each [[lookup @target.affects.typ… |
|  | **Mucus Cloud** | temp-hp | fx1[cursed] save dmg |  | While underwater, the [[lookup @name lowercase]] is surrounded by mucus. Constitution Saving Throw: DC 14, eac… |
|  | **Multiple Heads** | temp-hp | **TEXT** |  | The [[lookup @name lowercase]] has five heads. Whenever the [[lookup @name lowercase]] takes 25 damage or more… |
|  | **Mutating Claw** | temp-hp | fx1[cursed] save atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Humanoid not cursed by a slaad, it is s… |
|  | **Necrotic Breath** | half-on-save | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=3LncbUYMp4rOrQ3U]], each [[lookup @target.affec… |
|  | **Negative Energy Cone** | temp-hp | **TEXT** |  | The [[lookup @name lowercase]]’s central eye emits an imperceptible, magical wave of negative energy in a [[lo… |
|  | **Noxious Miasma** | clock | fx1 save dmg | ✓ SPENT_AREAS | Constitution Saving Throw: DC [[lookup @save.dc.value activity=Blm8nddvCOH69bL8]], each [[lookup @target.affec… |
|  | **Ocean Spear** | clock | fx1 atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a creature, its Speed decreases by 10 fee… |
|  | **Ooze Cube** | bend-save | fx1[coverTotal] dmg |  | The [[lookup @name lowercase]] fills its entire space and is transparent. Other creatures can enter that space… |
|  | **Pack Tactics** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | The [[lookup @name lowercase]] has Advantage on an attack roll against a creature if at least one of the [[loo… |
|  | **Paralyzing Breath** | clock | fx2[incapacitated,paralyzed] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=r4MGqEq5U9aaseBh]], each [[lookup @target.affec… |
|  | **Parry** | reaction | **TEXT** | ✓ LIST:INTERRUPTS | Trigger: The [[lookup @name lowercase]] is [[lookup @activation.condition activity=aLG3BRZL7P6OEjwd]]. Respons… |
|  | **Pesky Swarm** | bend-attack, clock | fx1 | ✓ EFFECT_BENDS.from | The target has Disadvantage on attack rolls and ability checks until the end of its next turn. |
|  | **Poison Breath** | half-on-save | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=lnabW9bM51HoluPp]], each creature in a [[lookup… |
|  | **Poison Spray** | half-on-save | fx1[blinded,poisoned] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=Ab1fnEh4JGShDFte]], each [[lookup @target.affec… |
|  | **Poisonous Spittle** | half-on-save | fx1[blinded] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=r4plP8QiJxzFZZO7]], [[lookup @target.affects.la… |
| 3 | **Portent** | reaction | uses **TEXT** |  | Trigger: The [[lookup @name lowercase]] [[lookup @target.affects.special activity=uGaJoaDIgntkFbDg]] it can se… |
|  | **Possession** | resist | fx1[incapacitated] save |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=7gmNBVjwuYTyANMe]], one [[lookup @target.affects.sp… |
|  | **Protection** | interrupt, reaction | fx1 | ✓ EFFECT_BENDS.from, LIST:INTERRUPTS | Trigger: An attack roll hits the wearer of the [[lookup @name lowercase]]’s amulet while the wearer is within… |
|  | **Protective Magic** | reaction | uses **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCounterspe]{Count… |
|  | **Psionic Defense** | reaction | uses **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplFeatherFal]{Feath… |
|  | **Pummel** | half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=aae828c0Hue0XOMP]], one creature Grappled by the [… |
|  | **Pursuit** | reaction | **TEXT** |  | Trigger: Another creature the [[lookup @name lowercase]] can see ends its move within [[lookup @range.value ac… |
|  | **Radiant Teleport** | half-on-save | save dmg |  | The [[lookup @name lowercase]] teleports up to [[lookup @range.value activity=HtsFBK1PYKjvy9mn]] feet to an un… |
|  | **Rally** | bend-attack | fx1 uses | ✓ EFFECT_BENDS.from | The [[lookup @name lowercase]] chooses up to three other creatures it can see within 30 feet. Until the start… |
|  | **Redirect Attack** | reaction | **TEXT** |  | Trigger: A creature the [[lookup @name lowercase]] can see makes an attack roll against it. Response: The [[lo… |
|  | **Reflexive Antennae** | reaction | **TEXT** |  | Trigger: An attack roll hits the [[lookup @name lowercase]]. Response: The [[lookup @name lowercase]] uses Ant… |
|  | **Restraining Glob** | clock, half-on-save | fx1[restrained] save dmg |  | The [[lookup @name lowercase]] lobs a slimy glob at [[lookup @target.affects.special activity=P1YLDUEKG7baOYir… |
|  | **Riposte** | reaction | fx1 | ✓ LIST:MANEUVER_FOLDS | Trigger: The [[lookup @name lowercase]] is hit by a melee attack roll while holding a weapon. Response: The [[… |
|  | **Roar** | half-on-save | fx3[frightened,paralyzed,prone] save dmg uses |  | The sphinx emits a magical roar. Whenever it roars, the roar has a different effect, as detailed below (the se… |
|  | **Rotting Fist** | temp-hp | fx1[cursed] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a creature, it is cursed. While cursed, t… |
|  | **Rotting Gaze** | half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=k4jetEkSCPApNFgz]], [[lookup @target.affects.la… |
|  | **Rumbling Movement** | clock | fx1[prone] save |  | The [[lookup @name lowercase]] moves up to its Speed, Fly Speed, or Swim Speed without provoking Reference[Opp… |
|  | **Sanguine Drain** | temp-hp | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=zw4GduIbxRyUVb1Y]], one [[lookup @target.affect… |
|  | **Sap** | bend-attack, use-chip | fx1 | ✓ EFFECT_BENDS.from, MASTERY | The target has Disadvantage on its next attack roll before the start of the [[lookup @name lowercase]]'s' next… |
|  | **Scorching Sands** | clock, half-on-save | fx1 save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=g5fxAWhrpwohtETl]], [[lookup @target.affects.label… |
|  | **Screech** | clock, half-on-save | fx1[incapacitated] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=mXGsh0QEm9aKiHKn]], each [[lookup @target.affec… |
|  | **Shadow Breath** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=hvGQg4CsoCNgrjGy]], each creature in a [[lookup @t… |
|  | **Shield** | reaction | uses **TEXT** | ✓ LIST:INTERRUPTS, BLOCKS | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplShield0000]{Shiel… |
|  | **Shimmering Shield** | clock | fx1 |  | The [[lookup @name lowercase]] targets itself or one [[lookup @target.affects.type activity=sl8NoPhB0e5z6jmK]]… |
|  | **Shockwave of Glory** | clock | fx1[prone] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=D9xmcR92PLqyk6bZ]], each [[lookup @target.affec… |
|  | **Shriek** | reaction | **TEXT** |  | Trigger: A [[lookup @target.affects.type activity=Tlv3gcYk5KfdtV7c]] or a source of Bright Light moves within… |
|  | **Sickening Ray** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses Spellcasting to cast @UUID[Compendium.dnd-players-handbook.spells.Item.phb… |
|  | **Sickening Vapors** | clock, resist | fx1[incapacitated] save |  | Sickening Vapors. Constitution Saving Throw: DC [[lookup @save.dc.value activity=a9NAwfq8B1qvfEi7]], each crea… |
|  | **Silver Sword** | crit | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. Critical Hit: If the target is in an astral body (as with… |
|  | **Slaying Bow** | half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=C7BMf8hIfCjxRSWC]], one [[lookup @target.affects.t… |
|  | **Sleep Breath** | clock | fx2[incapacitated,unconscious] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=6ce9oevQRWomSVSF]], each [[lookup @target.affec… |
|  | **Sleep Gaze** | resist | fx1[unconscious] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=TXstlDE42CZicPAk]], [[lookup @target.affects.labels.s… |
|  | **Slowing Breath** | clock, half-on-save | fx1 save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=teMMQNDDIE9XkPN3]], each creature in a [[lookup… |
|  | **Smelting Charge** | half-on-save | fx2[grappled,restrained,prone] save dmg uses |  | The [[lookup @name lowercase]] moves up to its Speed without provoking Reference[OpportunityAttacks] and [[loo… |
|  | **Smoke Bomb** | half-on-save | fx1[blinded] save dmg uses |  | The [[lookup @name lowercase]] throws a bomb to a point it can see within [[lookup @range.value activity=nk7wJ… |
|  | **Sonic Boom** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses Spellcasting to cast @UUID[Compendium.dnd-players-handbook.spells.Item.phb… |
|  | **Soul Bag** | resist | **TEXT** |  | The [[lookup @name lowercase]] has a soul bag. While holding or carrying the bag, the [[lookup @name lowercase… |
|  | **Soul Gem** | resist | **TEXT** |  | The [[lookup @name lowercase]] has a magical gem. If the [[lookup @name lowercase]] is destroyed while the gem… |
|  | **Soul Tome** | resist | **TEXT** |  | The [[lookup @name lowercase]] has a magic tome. While holding or carrying the tome, the [[lookup @name lowerc… |
|  | **Spell Immunity** | resist | **TEXT** |  | The [[lookup @name lowercase]] is immune to three spells chosen by its creator. Typical choices include @UUID[… |
|  | **Spell Reflection** | reaction | save dmg |  | Trigger: The [[lookup @name lowercase]] [[lookup @activation.condition activity=ZYmB6aUHCqkMh0Ji]] Response—De… |
|  | **Spirit Wail** | clock, half-on-save | fx1[frightened] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=5JzDfoXBTiCay7OP]], each [[lookup @target.affects.typ… |
|  | **Split** | reaction | **TEXT** |  | Trigger: While the [[lookup @name lowercase]] [[lookup @activation.condition activity=zoXFSgzmWq8frUjI]] Respo… |
|  | **Spore Bomb** | half-on-save, temp-hp | fx1[poisoned] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=cmFbJQhqZiLBF9Ij]], each [[lookup @target.affec… |
|  | **Stake to the Heart** | press-condition | fx1[paralyzed] |  | The [[lookup @name lowercase]] is destroyed if a weapon that deals Piercing damage is driven into the [[lookup… |
|  | **Steam Breath** | half-on-save, resist | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=5iI1KQRWrdMGh9sy]], each [[lookup @target.affec… |
|  | **Stench** | clock, resist | fx1[poisoned] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=mJbwhj3beOIB3Jgj]], any creature (other than a… |
|  | **Stench Spray** | half-on-save | fx1[poisoned] save uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.formula activity=MD1NjuNJfDjxKGrL]], one [[lookup @target.affects… |
|  | **Sticky Net** | half-on-save, resist | fx1[restrained] save uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.formula activity=MxEs7KnCVGemObHx]], one [[lookup @target.affects… |
|  | **Sticky Shield** | reaction | fx1[grappled] save |  | Trigger: A creature misses the [[lookup @name lowercase]] with a melee attack roll using a weapon. Response—St… |
|  | **Sunlight** | bend-attack | fx1 dmg | ✓ EFFECT_BENDS.from | The [[lookup @name lowercase]] takes [[/damage]] damage if it starts its turn in sunlight. While in sunlight,… |
|  | **Sunlight Hypersensitivity** | bend-attack | dmg | ✓ EFFECT_BENDS | The [[lookup @name lowercase]] takes [[/damage]] damage if it starts its turn in sunlight. While in sunlight,… |
|  | **Swarm** | temp-hp | **TEXT** |  | The swarm can occupy another creature’s space and vice versa, and the swarm can move through any opening large… |
|  | **Tendril** | clock | fx1[poisoned] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] con… |
|  | **Tentacle Slam** | half-on-save | fx1[stunned] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=VC2iSwNPNaZ7M2bT]], [[lookup @target.affects.sp… |
|  | **Terrifying Presence** | clock | fx1[frightened] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=SVb8yS9ewkeZpP2R]], each [[lookup @target.affects.typ… |
|  | **Third Roar** | half-on-save | fx1[prone] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=ZRjg6wwKf090U1zB]], each [[lookup @target.affec… |
|  | **Thunderclap** | clock | fx1[deafened] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=Lq6GexegvlEVB6Dh]], each [[lookup @target.affec… |
|  | **Thunderous Bellow** | clock, half-on-save | fx1[deafened,frightened] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=RWBqtTjGSlEgQWCl]], [[lookup @target.affects.sp… |
|  | **Tongue Twister** | clock, reaction | fx1[cursed] |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCounterspe]{Count… |
|  | **Toxic Escape** | clock, interrupt, reaction | fx1[incapacitated,poisoned] save |  | Trigger: The [[lookup @name lowercase]] is hit by an attack roll. Response: The [[lookup @name lowercase]] hal… |
|  | **Toxic Ink** | clock | fx1[blinded,poisoned] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=Kquf9zADg0jtKBqw]], each [[lookup @target.affec… |
|  | **Trample** | press-condition, half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=QckCIpsC3BdEHycI]], [[lookup @target.affects.label… |
|  | **Trash Lob** | clock | fx1[poisoned] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] con… |
|  | **Umbral Dagger** | press-condition | fx1[poisoned,paralyzed] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is reduced to 0 Hit Points by this attack, t… |
| 5 | **Uncanny Dodge** | interrupt, reaction | **TEXT** | ✓ LIST:INTERRUPTS | Trigger: The [[lookup @name lowercase]] is [[lookup @activation.condition activity=NzfYZzkrG4qJ13to]]. Respons… |
|  | **Undead Fortitude** | crit | **TEXT** |  | If damage reduces the [[lookup @name lowercase]] to 0 Hit Points, it makes a Constitution saving throw (DC 5 p… |
|  | **Unnerving Gaze** | reaction, resist | fx1[frightened] save |  | Trigger: A [[lookup @target.affects.type activity=btp6NZvx465nxWTF]] the [[lookup @name lowercase]] can see st… |
|  | **Vampire Weakness** | bend-attack, press-condition | fx1 dmg | ✓ EFFECT_BENDS.from | The [[lookup @name lowercase]] has these weaknesses: Forbiddance. The [[lookup @name lowercase]] can’t enter a… |
|  | **Vanish** | concentration | fx1[invisible] |  | The [[lookup @name lowercase]] and its light have the Reference[Invisible apply=false] condition until the [[l… |
|  | **Veil of Shadow** | clock | dmg |  | The [[lookup @name lowercase]] uses Shadow Stealth, and [[lookup @target.affects.labels.statblock activity=ODo… |
|  | **Vile Appearance** | clock, resist | fx1[frightened] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=FR0ETDHBas1Z5LfF]], any [[lookup @target.affects.spec… |
|  | **War Cry** | bend-attack | fx1 uses | ✓ EFFECT_BENDS.from | The [[lookup @name lowercase]] or one [[lookup @target.affects.type activity=uN0VTW2Fqig7YAs9]] of its choice… |
|  | **Warding Charm** | interrupt, reaction, half-on-save | fx1[charmed] save |  | Trigger: A creature hits the [[lookup @name lowercase]] with an attack roll. Response—Wisdom Saving Throw: DC… |
|  | **Warping Hex** | half-on-save | fx1[exhaustion] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=KaTc2c6hOHAqtywC]], one [[lookup @target.affects.type… |
|  | **Water Jet** | half-on-save | fx1[prone] save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=CY2HqHThU06Jf0Bw]], each [[lookup @target.affects.… |
|  | **Watery Rebuke** | reaction | save dmg |  | Trigger: An enemy the [[lookup @name lowercase]] can see [[lookup @target.affects.special activity=nCfH0YgOhJR… |
|  | **Watery Rush** | movement | **TEXT** |  | While underwater, the [[lookup @name lowercase]] [[lookup @activation.condition activity=xoYfePV5epjJkYHX]] wi… |
|  | **Web** | resist | fx1[restrained] save uses | ✓ SAVE_PRESSES | Dexterity Saving Throw : DC [[lookup @save.dc.value activity=6iMoUgxwYlvfKTXr]], one creature the [[lookup @na… |
|  | **Web Strand** | resist | fx1[restrained] save uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=Ln5NXBaHGKlwdoiP]], one Large or smaller [[lookup… |
|  | **Weight of Years** | clock, half-on-save | fx1[exhaustion] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=xZul1ImCP658OBv3]], one [[lookup @target.affect… |
|  | **Weird Insight** | half-on-save | save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=o6eFmn0HWGbQjzdG]], one [[lookup @target.affects.type… |
|  | **Whelm** | half-on-save | fx1[grappled,restrained] save dmg uses |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=TQchFj2VXXJgU7Lq]], each [[lookup @target.affects.t… |
|  | **Whirlwind** | half-on-save | fx1[prone] save dmg uses |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=GQzr4EMMm6kkZVdC]], each Medium or smaller [[lookup… |
|  | **Whirlwind of Sand** | interrupt, reaction | fx2[blinded] | ✓ LIST:INTERRUPTS | Trigger: The [[lookup @name lowercase]] is hit by an attack roll. Response: The [[lookup @name lowercase]] add… |
|  | **World-Shaking Movement** | clock, concentration | fx1[prone] |  | The [[lookup @name lowercase]] moves up to its Speed. At the end of this movement, the [[lookup @name lowercas… |

## No family (424)

Abduct · Abyssal Glaive · Abyssal Strike · Adhesive (Object Form Only) · Advanced Telepathy · Air Form · Amorphous · Amphibious · Animal Lordship · Animate Boulders · Animate Trees · Animating Spores · Antimagic Cone · Aquatic Burst · Aquatic Charge · Aquatic Lash · Arcane Burst · Arcane Prowl · Arcane Sword · Arcane Tentacles · Astral Implosion · Attach · Avalanche Slam · Awestruck · Baleful Command · Banish · Banishing Claw · Barbed Hide · Beak · Beaks · Beast of Burden · Beguiling Strike · Bejeweled Baton · Bite · Bites · Bladed Arm · Blazing Light · Blazing Movement · Blight Seeds · Blinding Spittle · Bog Staff · Bone Bow · Bone Cudgel · Bone Flail · Bone Javelin · Bone Whip · Boulder · Bound · Branch · Brutal Gore · Burn · Burning Hammer · Burst of Wonder · Caustic Lash · Celestial Restoration · Chain · Channel Negative Energy · Chaos Blade · Chaos Claw · Chaos Staff · Charge · Charged Tendril · Charm · Charming · Chatkcha · Chomp · Chromatic Spittle · Claw · Claws · Clockwork Blade · Clockwork Spear · Compression · Confusing Gaze · Conjure Infernal Chain · Conjure Slimy Glob · Constrict · Constricting Vine · Consume Life · Contortionist · Control Weather · Corrosive Form · Corrupting Touch · Coven Magic · Create Specter · Cunning Action · Curse of the Riddle · Cursed Touch · Death Glare · Death Throes · Deathless Agility · Deathless Strike · Deathly Ray · Deathly Teleport · Deathly Wail · Demonic Restoration · Destroy Metal · Detect Intelligence · Detect Life · Devilish Claw · Devour Intellect · Diabolical Restoration · Dissolving Pseudopod · Divine Aid · Divine Awareness · Divine Ray · Draconic Origin · Draconic Strike · Dragon-Tooth Blade · Draining Swipe · Dread Blade · Drop · Earth Burst · Earth Glide · Earthen Maul · Eldritch Burst · Eldritch Lantern · Eldritch Restoration · Electrical Discharge · Elemental Burst · Elemental Claw · Elemental Flail · Elemental Restoration · Enchanting Bow · Engulf · Entangling Plants · Entangling Rope · Enthralling Panache · Ephemeral · Eruption · Ethereal Jaunt · Ethereal Sight · Ethereal Stride · Etherealness · Exalted Restoration · Faerie Dust · Fearsome Claw · Feral Strike · Fey Melody · Fiendish Aid · Fiendish Burst · Fiendish Guile · Fiendish Restoration · Fiendish Touch · Fiery Bolt · Fiery Mace · Fire Aura · Fire Form · Fire Ray · First Roar · Fist · Flame Aura · Flame Burst · Flame Scepter · Flame Spear · Flame Sword · Flame Trident · Flame Whip · Flying Sword · Fog Cloud · Force Bolt · Foreleg · Forest Staff · Fortify · Frightening · Frost Axe · Gear · Gear Flinger · Gears Launcher · Gibbering · Glare · Gore · Grab · Grave Strike · Guiding Light · Gythka · Hag’s Swipe · Hail of Bark · Harpoon · Hasten · Haunted Zone · Haunting Glare · Healing Word · Heat Aura · Heated Blade · Hellfire Spellcasting · Hellish Restoration · Hex Stick · Hold Breath · Holy Mace · Hook · Hooves · Howl · Hunger of Hadar · Hurl Flame · Ice Throw · Ice Wall · Icy Bite · Ignited Illumination · Illumination · Illusory Appearance · Immutable Form · Incite Rampage · Incubus Form · Infernal Fork · Infernal Glaive · Infernal Tail · Injecting Claw · Inscrutable · Insectile Rapier · Invisibility · Invisible in Water · Invitation · Iron Scent · Jumper · Lash · Lashing Goop · Leap · Legendary Resistance · Life Drain · Lightning Blade · Limited Amphibiousness · Lunge · Magic of the Spider Queen · Mercurial Axe · Mercurial Trident · Mercurial Whip · Mind Invasion · Mind-Rending Roar · Misty Escape · Misty Step · Misty Veil · Mockery · Mud Breath · Multiattack · Necrosis · Necrotic Bow · Necrotic Burst · Necrotic Ray · Necrotic Strike · Necrotic Sword · Needle Sword · Needles · Nightmare · Nightmare Haunting · Nightmare Ray · Nimble Escape · Object Slam · Onslaught · Otherworldly Strike · Pacifying Spores · Pact Axe · Pact Blade · Paralysis Gas · Paralyzing Tentacles · Paralyzing Touch · Petrifying Bite · Petrifying Breath · Petrifying Gaze · Phantasms · Pincer · Pincer Staff · Poison · Poison Burst · Poison Ray · Pounce · Prance · Probing Telepathy · Proboscis · Prone Deficiency · Prowl (Tiger or Hybrid Form Only) · Pseudopod · Psi Blade · Psi Strike · Psi-Powered Leap · Psionic Lance · Psychic Crush · Psychic Drain · Psychic Warp · Quick Grapple · Radiant Burst · Radiant Flame · Radiant Horn · Radiant Ray · Radiant Strike · Radiant Sword · Rake · Ram · Rampage · Rapport Spores · Ravage · Reactive · Reactive Heads · Read Thoughts · Reel · Reflective Carapace · Regeneration · Rend · Repulsion Breath · Restless Touch · Ritual Sickle · Rock · Rock Launch · Rotting Slam · Rotting Touch · Running Leap · Running Water · Sacred Weapon · Scare · Scratch · Searing Fork · Second Roar · Sense Magic · Serpentine Gaze · Shadow Blade · Shadow Escape · Shadow Stealth · Shadow Strike · Shadowy Teleport · Shape-Shift · Shark Telepathy · Sharpened Beak · Shield Bash · Shield of Faith · Shielded Mind · Shock · Shred · Slam · Slash · Sleep · Slow · Smite · Smother · Snake Hair · Speak with Beasts and Plants · Speak with Frogs and Toads · Spectral Claw · Spectral Jaws · Spell Storing · Spellcasting · Spider Climb · Spirit Jar · Spiritual Weapon · Spiteful Escape · Spores · Standing Leap · Steal Body · Sting · Stomp · Stone Club · Storm Blade · Storm Bolt · Storm Sword · Strange Scepter · Stunning Screech · Succubus Form · Suffocate · Sun Ray · Sun Sickness · Sunlight Sensitivity · Sunlight Weakness · Superior Invisibility · Surge · Swallow · Swarm of Grasping Hands · Swarm of Proboscises · Swoop · Tactical Charge · Tail · Tail Spike · Tail Spine · Tail Stinger · Tail Swipe · Talons · Telekinetic Thrust · Teleport · Tentacle · Tentacle Lash · Tentacles · Terrifying Glare · Thorn Burst · Thorn Volley · Thrash · Thunderbolt · Thundercloud · Thunderous Mace · Thunderous Slam · Tormenting Bite · Touch · Training · Trampling Charge · Transparent · Treasure Sense · Tree Club · Tree Stride · Troll Spawn · Tunneler · Tusk · Umbral Claw · Umbral Strike · Undead Restoration · Unicorn's Blessing · Unsettling Visage · Vampiric Connection · Vengeful Glare · Verdant Wisp · Vile Slime · Vine Lash · Vine Staff · Vortex · Vow of Revenge · Warp Step · Water Bound · Water Breathing · Water Form · Water Susceptibility · Weakening Breath · Web Walker · Wind Javelin · Wind Staff · Wind Swipe · Wishes · Witch Strike · Withering Sword · Withering Touch
