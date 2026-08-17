/**
 * Battle Flow — Phase 2: saving throws, joint with Phase 3's save slice - demand, roll, verdict, consequences.
 * Split shape (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM } from "./core.js";
import { canAnswerFor } from "./hold.js";
import { livePopups, popupKey, openManagedPopup, bfCard, holdBarHTML, scheduleBarSync } from "./ui.js";
import { armAskTimer, disarmAskTimer } from "./mastery.js";
import { dramaticVerdictPause } from "./concentration.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyEffectsWithReceipt, revertEffect } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 2 — saving throws (design.md Phase 2), shipping WITH Phase 3's save slice: a save's
 * consequences ARE the feature, so failed-save effects and half-on-save damage ride the shared
 * appliers in this same file.
 *
 * The machine is Phase 2.5 generalized per target — deliberately nothing new: the casting
 * client stamps a `saves` demand on the save activity's own usage card (the card was already
 * load-bearing; now it is the bus); each targeted creature gets the save run on the client
 * that owns the decision (canAnswerFor — the concentration ask's election), as a POPUP wearing
 * the native roll dialog's controls (situational bonus, Advantage/Normal/Disadvantage, default
 * hinted from actor data) — deliberately NOT midi-qol's silent roll-and-apply: the save is a
 * table moment and the player presses it (user call, 2026-08-16). A per-player client setting
 * opts out to a silent data-driven roll. The roll message answers the demand (respondsTo — the
 * hold's channel, the concentration fold's meaning), the elect folds the verdict against the
 * DC STORED AT CAST TIME (the ask's-DC rule), and per target — independent, nobody waits on
 * anyone else's dice — the consequences apply: the activity's effects on a failure (honoring
 * each effect's own `onSave` "applies even on save" flag, data the system carries but nothing
 * native consults at 5.3.3), and the card's damage roll at ×1 on a failure or the activity's
 * own `damage.onSave` word on a success (half → the applier's threaded multiplier; none →
 * nothing at all). Receipts and reverts everywhere, through the same two appliers everything
 * else uses.
 *
 * The buzzer ROLLS (a demanded save is mandatory — the concentration timer's rule, not the
 * hold's): at the deadline the elect rolls every still-unanswered target straight,
 * data-driven. Legendary resistance is the one late answer: resistSave flips
 * `flags.dnd5e.roll.forceSuccess` onto the save message as an UPDATE after the failure
 * landed, so the elect watches for it and OVERTURNS the verdict — un-applying what the
 * failure applied (receipt-exact) and re-applying what a success grants. That closes the
 * corner Phase 2.5 accepted.
 *
 * Native interplay, kept deliberately: the save card's own per-ability buttons still work —
 * they roll for whatever tokens are SELECTED (getSceneTargets — the topple enricher's trap,
 * which is exactly why the popup aims at the right actor by construction) but they chain to
 * the card, so the fold reads them; a bare sheet roll answers the oldest pending demand for
 * that actor (deferring to a pending concentration ask, whose recognizer this cannot be told
 * apart from). No card is ever suppressed since v1.10.0 — the demand's card is always the
 * native one — and no other applier touches this chain: auto-apply's walk requires an
 * attack, and the v1.6.0 spellDamage claim requires a bare damage activity.
 *
 * Corners, accepted and recorded:
 *  - A multi-ability save ("Str or Dex") auto-rolls the FIRST listed ability; the popup rolls
 *    it too. A target who wants the other ability rolls it from the sheet or the native
 *    button — the fold accepts any listed ability.
 *  - A consumed item (a scroll's last use) can strand its effects: they live on the item
 *    document, so once it is gone a late verdict applies damage but not effects.
 *  - Dead and unconscious targets are still asked/rolled — RAW auto-failure for Str/Dex saves
 *    while unconscious is a condition-layer rule (Phase 5), not automated here.
 *  - The demand's deadline is stamped on the casting client's clock and the buzzer runs on
 *    the elect's; a couple of seconds of skew moves the buzzer, never the verdict (it
 *    re-checks state before acting).
 * ------------------------------------------------------------------------------------------- */

/* --- the stamp: the casting client writes the demand on the usage card --------------------- */

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  if ( !setting(S.saves) ) return;
  if ( activity?.type !== "save" ) return;
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return; // used with create: false — no card, no bus, nothing to run
  void stampSaveDemand(activity, message, results);
});

async function stampSaveDemand(activity, message, results) {
  try {
    if ( message.getFlag(MODULE_ID, "saves") ) return; // never re-stamp
    // ⚠ A template spell's target set is what the TEMPLATE contains, not what was clicked —
    // in both directions (user call 2026-08-16: the mephit was targeted but stood outside
    // Moonbeam's circle; the dummy stood inside Shatter's untargeted). postUseActivity fires
    // after _finalizeUsage, so a placed template is already in results.templates, awaited
    // and real. Manual targeting stays the bus for everything without a template.
    // ⚠⚠ results.templates entries are ARRAYS, not documents (5.3.3 ground truth, read from
    // source after two live misfires): #placeTemplate pushes drawPreview()'s resolution,
    // which is the raw createEmbeddedDocuments result — an array per placement. Unflattened,
    // the parent filter dropped every live placement and the stamp silently fell back to the
    // manual snapshot (the Shatter/Gren strand, 2026-08-17) — the adoption floor then had to
    // drag the demand back to the area, stranding the snapshot targets' popups.
    // Containment reads the drawn shape when one exists and falls back to document
    // geometry otherwise (templateShape) — never await canvas readiness here: an await
    // against template.object has been observed to never come back on the headless elect,
    // and the fallback makes it unnecessary.
    const contained = tokensInTemplates((results?.templates ?? []).flat().filter(t => t?.parent));
    const targets = contained ?? (message.getFlag("dnd5e", "targets") ?? []);
    // A TEMPLATE-SHAPED activity's targetless cast stamps a WAITING demand (v1.12.0,
    // finding ③ — the natural Web flow is cast bare, then place: the old bail meant
    // adoption had no customer and the area produced no saves at all). The demand stamps
    // with zero targets and NO deadline; adoption fills it when the template lands and
    // arms the clock on the first arrivals (armAskTimer no-ops without a deadline, so
    // nothing buzzes an empty wait). A targetless cast with no template shape anywhere
    // in its data still stays native — no area is ever coming.
    const templateShaped = !!activity.target?.template?.type;
    if ( !targets.length && !templateShaped ) return; // targetless, no area coming — the humans have it
    // A self-aimed save activity's snapshot is incidental UI targeting (the cast slice's
    // lesson). A BLANK affects is allowed on purpose, unlike the cast slice: hand-authored
    // statblock abilities often carry no affects data, and eating their saves in silence
    // would be a false negative the table can't see. The risk the cast slice gated against
    // (double-applying a self-buff) does not exist here — there is no second applier.
    if ( !contained && ((activity.target?.affects?.type ?? null) === "self") ) return;
    const dc = activity.save?.dc?.value;
    if ( !(dc > 0) ) return; // no DC prepared — nothing to judge against (pre-2024 data)
    const abilities = [...(activity.save?.ability ?? [])];
    if ( !abilities.length ) return;

    // The effect names by outcome, resolved NOW while the item surely exists — the popup's
    // stakes line and the LR unwind both read these without needing the live document.
    const applicable = new Set((activity.applicableEffects ?? []).map(e => e.id));
    const entries = (activity.effects ?? []).filter(e => e.effect && applicable.has(e.effect.id));
    const effectNames = {
      fail: entries.filter(e => !e.onSave).map(e => e.effect.name),
      always: entries.filter(e => e.onSave).map(e => e.effect.name)
    };

    // ⚠ `onSave: "full"` marks damage the save does NOT modulate — situational rider
    // damage stored on the save activity (Web's burn clause: 2d4 fire for starting a turn
    // in burning webs, nested there in the system's own PHB data). It is not the save's
    // consequence, so the demand carries no damage dimension at all: no auto-roll, no
    // per-verdict application (finding ③, 2026-08-17 — Web auto-rolled its burn at the
    // stamp and applied 8 to a timer-failed target; RAW deals that only when the webs
    // burn). The card text's own damage enricher stays clickable and lands through the
    // native tray, GM-judged — exactly what situational damage needs.
    const onSave = activity.damage?.onSave ?? "half";
    const saveModulated = !!activity.damage?.parts?.length && (onSave !== "full");

    const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
    const awaiting = !targets.length; // template-shaped, area not placed yet (the gate above)
    await message.setFlag(MODULE_ID, "saves", {
      status: "pending",
      abilities, dc,
      damageOnSave: onSave,
      hasDamage: saveModulated,
      effectNames,
      activityUuid: activity.uuid,
      // The dnd5e area type (cube, sphere, …) — adoption's shape gate for a TOOLBAR-drawn
      // template, which carries no origin flag to match by (the v1.12.0 walk's finding ①).
      templateType: activity.target?.template?.type ?? null,
      templated: !!contained,
      ...(awaiting ? { awaitingTemplate: true } : {}),
      durationUnits: activity.item?.system?.duration?.units ?? null,
      item: { name: activity.item?.name ?? "the effect", img: activity.item?.img ?? null },
      casterName: activity.actor?.name ?? null,
      // A waiting demand carries its window but NO deadline — the clock starts when the
      // area delivers its first targets (the adoption write), not while nobody can roll.
      ...(window ? (awaiting ? { window } : { window, deadline: Date.now() + (window * 1000) }) : {}),
      // Per-target state is an ARRAY with uuid fields — never a uuid-keyed map (the dotted
      // key expansion ground truth).
      targets: targets.map(t => ({ uuid: t.uuid, name: t.name,
        done: false, outcome: null, total: null, rollMessageId: null }))
    });

    // ⑯'s companion: with the card's Damage button hidden, the machine rolls the spell's
    // damage itself the moment the demand stamps — the attack path's symmetry (1a rolls on
    // hit). Chained to the card so upcast scaling and damageOnSave ride the native plumbing;
    // per-target independence already handles a roll arriving before any verdict.
    // Save-modulated damage only — rider damage (onSave "full") never rolls here.
    if ( saveModulated ) {
      try {
        await activity.rollDamage({}, { configure: false },
          { data: { "flags.dnd5e.originatingMessage": message.id } });
      } catch(err) {
        console.error(`${TITLE} | Could not auto-roll the save spell's damage.`, err);
      }
    }
  } catch(err) {
    console.error(`${TITLE} | Could not stamp the save demand.`, err);
  }
}

/**
 * The actors standing in the given templates, as demand-target entries — or null when no
 * template exists (the manual snapshot's case, which must stay distinguishable from "a
 * template with nobody in it", where the demand correctly stamps nothing). Center-point
 * containment on the template's own scene; secret tokens stay out of it.
 */
function tokensInTemplates(templates) {
  const docs = (templates ?? []).filter(t => t?.parent && templateShape(t));
  if ( !docs.length ) return null;
  const seen = new Set();
  const entries = [];
  for ( const doc of docs ) {
    const shape = templateShape(doc);
    for ( const tok of doc.parent.tokens ) {
      if ( tok.isSecret || !tok.actor ) continue;
      const pts = tokenSamplePoints(tok);
      if ( !pts.some(p => shape.contains(p.x - doc.x, p.y - doc.y)) ) continue;
      const uuid = tok.actor.uuid;
      if ( seen.has(uuid) ) continue;
      seen.add(uuid);
      entries.push({ uuid, name: tok.name });
    }
  }
  return entries;
}

/**
 * ⚠⚠ THE v14 REGION-SHIM GROUND TRUTH (the v1.13.0 walk's finding ①, probes 7–9,
 * 2026-08-17): Foundry 14 shims MeasuredTemplates onto Regions, and this build's CREATE
 * round-trip corrupts the stored units — `distance` comes back ×(gridSize/100) (×1.4 on a
 * 140px grid, ×0.7 on 70px, invisible on the 100px test range) and `width` comes back as
 * RAW PIXELS. The client pipeline is clean (probe 8: local clean/validate leaves values
 * untouched); the scaling happens server-side. The renderer draws from the same lying
 * field, so the PLACED area (shape, highlight, and any doc-math) is uniformly oversized —
 * only the dnd5e `dimensions` flag survives honest, because fromActivity stamps the
 * spell's own size and the shim never touches flags.
 *
 * So: SPELL-TRUTH FIRST. When the placement stamped honest dimensions, geometry is built
 * from them — the demand matches the 20 ft cube the caster cast and the honest preview
 * they aimed, not the corrupted stored field. This deliberately supersedes the
 * drawn-shape-first rule (standing item 17) while the shim lies: the drawn object IS the
 * corrupted doc. Self-healing — once upstream fixes the shim, doc.distance equals the
 * dimensions-derived value and every branch agrees again. adjustedSize placements
 * (emanations sized up by token) keep doc math: their final size lives only in distance.
 */
function honestDims(doc) {
  const dim = doc.flags?.dnd5e?.dimensions;
  if ( !(dim?.size > 0) || dim.adjustedSize ) return null;
  if ( (doc.t === "ray") && !(dim.width > 0) ) return null;
  return {
    // A dnd5e cube rides a rect drawn corner-to-corner: distance is the diagonal.
    distance: (doc.t === "rect") ? Math.hypot(dim.size, dim.size) : dim.size,
    width: (doc.t === "ray") ? dim.width : (doc.width ?? 0)
  };
}

/** The template's shape — honest dnd5e dimensions when stamped (the shim note above),
 * else the drawn object's, else core's own shape builders (deprecated since v14, until
 * 16 — migrate to ShapeData when 16 lands; current-scene only), else Euclidean math.
 * The fallback ladder below the rescue is v1.13.0's, kept for toolbar-drawn and
 * foreign templates that carry no dimensions flag. */
function templateShape(doc) {
  const honest = honestDims(doc);
  const distance = honest?.distance ?? doc.distance ?? 0;
  const width = honest?.width ?? doc.width ?? 0;
  if ( !honest && doc.object?.shape ) return doc.object.shape;
  if ( (doc.parent === canvas?.scene) && canvas?.dimensions?.distancePixels ) {
    try {
      const cls = CONFIG.MeasuredTemplate?.objectClass;
      switch ( doc.t ) {
        case "circle": return cls.getCircleShape(distance);
        case "rect": return cls.getRectShape(distance, doc.direction ?? 0);
        case "cone": return cls.getConeShape(distance, doc.direction ?? 0,
          doc.angle || CONFIG.MeasuredTemplate?.defaults?.angle || 53.13);
        case "ray": return cls.getRayShape(distance, doc.direction ?? 0, width);
      }
    } catch(err) {
      console.warn(`${TITLE} | Core template shape builder failed; using Euclidean fallback.`, err);
    }
  }
  const grid = doc.parent?.grid;
  if ( !grid?.size || !grid?.distance ) return null;
  const d = distance * (grid.size / grid.distance);
  const dir = Math.toRadians(doc.direction ?? 0);
  switch ( doc.t ) {
    case "circle": return new PIXI.Circle(0, 0, d);
    case "rect": {
      const dx = Math.cos(dir) * d, dy = Math.sin(dir) * d;
      return new PIXI.Rectangle(Math.min(0, dx), Math.min(0, dy), Math.abs(dx), Math.abs(dy));
    }
    case "ray": {
      const w = width * (grid.size / grid.distance);
      const dx = Math.cos(dir), dy = Math.sin(dir);
      const ox = -dy * (w / 2), oy = dx * (w / 2);
      return new PIXI.Polygon([ox, oy, dx * d + ox, dy * d + oy, dx * d - ox, dy * d - oy, -ox, -oy]);
    }
    case "cone": {
      const angle = Math.toRadians(doc.angle || 53.13);
      const points = [0, 0];
      const steps = 12;
      for ( let i = 0; i <= steps; i++ ) {
        const a = dir - (angle / 2) + (angle * i / steps);
        points.push(Math.cos(a) * d, Math.sin(a) * d);
      }
      return new PIXI.Polygon(points);
    }
  }
  return null;
}

/** A token's center from its document alone — object.center when drawn, geometry otherwise. */
function tokenCenter(tok) {
  if ( tok.object ) return tok.object.center;
  const grid = tok.parent?.grid?.size;
  if ( !grid ) return null;
  return { x: tok.x + (tok.width * grid) / 2, y: tok.y + (tok.height * grid) / 2 };
}

/** Every occupied grid square's center for a token — the 5e "does the area touch you on
 * the grid" question, one sample per square (midi-qol's long-standing model). A large
 * token counts when ANY of its squares stands in the area — center-only testing missed a
 * 2×2 body half inside. Sub-square tokens keep the single center sample. */
function tokenSamplePoints(tok) {
  const grid = tok.parent?.grid?.size;
  if ( !grid ) return [];
  const w = Math.round(tok.width ?? 1), h = Math.round(tok.height ?? 1);
  if ( (w < 1) || (h < 1) || ((w === 1) && (h === 1)) ) {
    const c = tokenCenter(tok);
    return c ? [c] : [];
  }
  const points = [];
  for ( let i = 0; i < w; i++ ) {
    for ( let j = 0; j < h; j++ ) points.push({ x: tok.x + ((i + 0.5) * grid), y: tok.y + ((j + 0.5) * grid) });
  }
  return points;
}

/**
 * A template moved (Moonbeam walks) or was re-placed while its demand is still pending:
 * containment is authoritative, so the pending target set follows the area. Done entries
 * keep their verdicts (history never re-rolls); pending entries outside drop; new arrivals
 * join fresh. The elect owns the write — single-writer, like every world-visible mutation.
 * The original placement's create event fires before the stamp exists and finds nothing.
 */
/** Every template on any scene that this activity placed — the origin flag is the tie. */
function templatesForOrigin(activityUuid) {
  const found = [];
  for ( const scene of game.scenes ) {
    for ( const t of scene.templates ) {
      if ( t.getFlag("dnd5e", "origin") === activityUuid ) found.push(t);
    }
  }
  return found;
}

/** The foundry template type a demand's area will wear (cube → rect &c.) — the system's
 * own map, so the module never hardcodes the correspondence. Null when the demand predates
 * templateType (pre-v1.13.0 stamps) or the type is unmapped: no toolbar adoption, only the
 * origin-tied paths. */
function expectedTemplateT(flag) {
  if ( !flag.templateType ) return null;
  return CONFIG.DND5E?.areaTargetTypes?.[flag.templateType]?.template ?? null;
}

/**
 * A TOOLBAR-drawn template carries no dnd5e origin flag — there is nothing for
 * templatesForOrigin to ever match, so before v1.13.0 the card's own "waiting for the
 * template's area" line pointed at a placement path that could not work (the v1.12.0
 * walk's finding ①). The waiting demand may CLAIM such a template: the newest origin-less
 * template of the demand's expected shape, on the ELECT'S CURRENT SCENE only (the toolbar
 * draw happens where the table is looking; and _stats.createdTime has been observed
 * unreadable on this box, so the created-after gate cannot carry the fossil bound alone —
 * the scene restriction is the second wall). The claim writes the origin flag onto the
 * template, so from that moment every downstream mechanism — moves, re-placement, the
 * spent sweep — treats it exactly like a dialog placement. Elect write, like every
 * world-visible mutation.
 */
async function claimBareTemplate(card, flag) {
  const expected = expectedTemplateT(flag);
  if ( !expected ) return null;
  const here = canvas?.scene;
  if ( !here ) return null;
  const candidates = [];
  for ( const t of here.templates ) {
    if ( t.getFlag("dnd5e", "origin") ) continue;
    if ( t.t !== expected ) continue;
    const born = t._stats?.createdTime ?? t._source?._stats?.createdTime ?? null;
    if ( born && (born < card.timestamp) ) continue; // predates the cast — decoration
    candidates.push({ t, born: born ?? 0 });
  }
  if ( !candidates.length ) return null;
  candidates.sort((a, b) => a.born - b.born);
  const tpl = candidates.at(-1).t;
  await tpl.setFlag("dnd5e", "origin", flag.activityUuid);
  return tpl;
}

/** Same-client latch: one containment refresh in flight per card. */
const templateRefreshes = new Set();

/**
 * Re-derive a live demand's target set from its templates — the area is the authority, in
 * both directions (2026-08-16: the mephit was targeted but outside Moonbeam; the dummy
 * stood inside Shatter untargeted). Done entries keep their verdicts (history never
 * re-rolls); pending entries outside drop; new arrivals join fresh. The elect owns the
 * write. Idempotent: no template ⇒ no-op; an unchanged set writes nothing.
 *
 * ⚠ Driven from the RENDER hook as the reliability floor, with the template CRUD hooks as
 * fast-paths — measured 2026-08-16: createMeasuredTemplate simply never dispatched on the
 * headless elect for an embedded create (a listener registered around the create counted
 * zero fires), so anything that MUST happen cannot ride those hooks alone. And NO awaiting
 * canvas readiness anywhere in here — a shape-wait against template.object never came back
 * on that same elect; templateShape's document-geometry fallback carries containment.
 */
async function refreshDemandFromTemplates(card) {
  if ( !isActiveGM() || !setting(S.saves) ) return;
  if ( templateRefreshes.has(card.id) ) return;
  templateRefreshes.add(card.id);
  try {
    const flag = card.getFlag(MODULE_ID, "saves");
    if ( flag?.status !== "pending" ) return;
    // A WAITING demand (zero targets — the v1.12.0 targetless template stamp) is a
    // customer too: it exists precisely so the area can deliver its targets later.
    const wasWaiting = !(flag.targets ?? []).length;
    if ( !wasWaiting && !(flag.targets ?? []).some(t => !t.done) ) return;
    // ONE customer per area among WAITING casts: the newest same-activity waiting demand
    // owns any arriving template (the fossil rule, standing item 17, applied to waiting —
    // the v1.12.0 walk left FOUR bare Web casts waiting, and without this gate one placed
    // cube fills all four: four popup sets for one area. Older waiting casts stay waiting
    // forever, which is already item 5's deliberate shape).
    if ( wasWaiting ) {
      const newer = game.messages.contents.some(m => {
        if ( (m.id === card.id) || (m.timestamp <= card.timestamp) ) return false;
        const f = m.getFlag(MODULE_ID, "saves");
        return (f?.status === "pending") && (f.activityUuid === flag.activityUuid)
          && !(f.targets ?? []).length;
      });
      if ( newer ) return;
    }
    let templates = templatesForOrigin(flag.activityUuid);
    // Nothing origin-tied: a waiting demand may claim a toolbar-drawn (origin-less)
    // template of its expected shape — the claim stamps the origin, so this branch runs
    // at most once per template ever.
    if ( !templates.length && wasWaiting ) {
      const claimed = await claimBareTemplate(card, flag);
      if ( claimed ) templates = [claimed];
    }
    if ( !templates.length ) return;
    const contained = tokensInTemplates(templates) ?? [];
    const merged = foundry.utils.deepClone(flag);
    merged.templated = true;
    const done = (merged.targets ?? []).filter(t => t.done);
    const keep = (merged.targets ?? []).filter(t => !t.done && contained.some(c => c.uuid === t.uuid));
    const fresh = contained.filter(c => !(merged.targets ?? []).some(t => t.uuid === c.uuid))
      .map(c => ({ ...c, done: false, outcome: null, total: null, rollMessageId: null }));
    const next = [...done, ...keep, ...fresh];
    if ( !next.length ) return; // a waiting demand keeps waiting; a populated one never strands
    const same = (merged.targets.length === flag.targets.length) && flag.templated
      && flag.targets.every((t, i) => next[i]?.uuid === t.uuid) && (next.length === flag.targets.length);
    merged.targets = next;
    if ( same ) return; // unchanged — write nothing, the log stays quiet
    // The first arrivals start the clock a waiting stamp deliberately withheld: deadline
    // from NOW (the elect's clock — the skew note in the file banner already covers it),
    // so the table gets the full window from the moment there is somebody to roll.
    if ( wasWaiting ) {
      merged.awaitingTemplate = false;
      if ( merged.window && !merged.deadline ) merged.deadline = Date.now() + (merged.window * 1000);
    }
    await card.setFlag(MODULE_ID, "saves", merged);
  } catch(err) {
    console.error(`${TITLE} | Template containment refresh failed.`, err);
  } finally {
    templateRefreshes.delete(card.id);
  }
}

/** The CRUD fast-path: when the hooks DO fire, refresh the newest live demand at once.
 * An origin-LESS template (the toolbar draw, finding ①) is offered to the newest WAITING
 * demand expecting its shape — the refresh's claim does the actual tying. */
function refreshTemplatedDemands(templateDoc) {
  if ( !isActiveGM() || !setting(S.saves) ) return;
  const origin = templateDoc.getFlag("dnd5e", "origin");
  const live = game.messages.contents.filter(m => {
    const f = m.getFlag(MODULE_ID, "saves");
    if ( f?.status !== "pending" ) return false;
    if ( origin ) return (f.activityUuid === origin)
      // Undone targets, or a WAITING demand (zero targets) whose area just arrived.
      && (!(f.targets ?? []).length || (f.targets ?? []).some(t => !t.done));
    return !(f.targets ?? []).length && (expectedTemplateT(f) === templateDoc.t);
  }).sort((a, b) => a.timestamp - b.timestamp);
  const card = live.at(-1);
  if ( card ) void refreshDemandFromTemplates(card);
}
Hooks.on("createMeasuredTemplate", doc => { refreshTemplatedDemands(doc); });
Hooks.on("updateMeasuredTemplate", doc => { refreshTemplatedDemands(doc); });

/**
 * An INSTANTANEOUS spell's template is spent once every verdict's consequences landed —
 * Shatter's circle has nothing left to say, so it leaves the canvas (user call 2026-08-16).
 * Duration spells (Moonbeam, Web) keep theirs: the area persists and containment keeps
 * reading it. The card keeps the spell's text either way — nothing is lost with the shape.
 *
 * ⚠ Since v1.14.0 this is a CONVERGENT FLOOR, not only a completion one-shot (the
 * v1.13.0 walk's finding ②): the one-shot at the last consequence pass demonstrably got
 * lost live — stale Fireball circles stood with every target applied — most plausibly to
 * an elect flip mid-chain (a second GM session connecting/disconnecting re-elects; probe
 * sessions did exactly that during the walk). The render/update floors now re-offer the
 * sweep for done demands, so a lost one-shot converges on the next render, whoever the
 * elect is by then. Idempotent and cheap: the origin filter usually finds nothing.
 *
 * ⚠ The NEWEST-CAST fossil wall: re-casting the same activity reuses the same
 * activityUuid, so an OLD done card's sweep would delete the CURRENT cast's area. Any
 * newer same-activity save card disarms this card's sweep forever. (The narrow blind
 * spot — a re-render landing in the ms between the new cast's template and its stamp —
 * needs a full-log re-render inside that window; accepted.)
 */
async function cleanupSpentTemplates(card) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag?.templated || (flag.durationUnits !== "inst") ) return;
  if ( !(flag.targets ?? []).every(t => t.done && (t.applied || (t.outcome === "gone"))) ) return;
  const superseded = game.messages.contents.some(m => {
    if ( (m.id === card.id) || (m.timestamp <= card.timestamp) ) return false;
    return m.getFlag(MODULE_ID, "saves")?.activityUuid === flag.activityUuid;
  });
  if ( superseded ) return;
  for ( const scene of game.scenes ) {
    const spent = scene.templates.filter(t => t.getFlag("dnd5e", "origin") === flag.activityUuid);
    if ( spent.length ) await scene.deleteEmbeddedDocuments("MeasuredTemplate", spent.map(t => t.id));
  }
}

/* --- the roll: whoever owns the decision presses it ----------------------------------------- */

/** Same-client re-entry latch (render resume + the buzzer can volunteer in one tick). */
const saveRollsInFlight = new Set();

/**
 * Roll one target's save, answering the demand. The stored DC rides as `target` so the
 * system's own success test marks the card and can never disagree with the fold; the dialog
 * is always skipped because the POPUP is the configuration surface — `mode` and `bonus`
 * arrive from its controls, forced through the roll's advantage/disadvantage booleans
 * exactly as the concentration answer does (applyKeybindings recomputes advantageMode, so
 * only the booleans stick). The buzzer and the opt-out pass neither: straight, data-driven,
 * sheet-borne modifiers still applying themselves.
 */
async function rollSaveAnswer(card, uuid, { mode = null, bonus = null, timedOut = false } = {}) {
  const key = `${card.id}|${uuid}`;
  if ( saveRollsInFlight.has(key) ) return;
  saveRollsInFlight.add(key);
  try {
    const flag = card.getFlag(MODULE_ID, "saves");
    const entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry || entry.done || (flag.status !== "pending") ) return;
    // An answer that already landed wins even though the entry still reads pending — the
    // fold is the elect's job and may not have caught up. Whole-log by flag, never a tail.
    if ( game.messages.some(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
      && (m.getFlag(MODULE_ID, "saveFor") === uuid)) ) return;
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const rollOverride = {};
    if ( mode === "advantage" ) rollOverride.options = { advantage: true, disadvantage: false };
    else if ( mode === "disadvantage" ) rollOverride.options = { advantage: false, disadvantage: true };
    else if ( mode === "normal" ) rollOverride.options = { advantage: false, disadvantage: false };
    const part = (bonus ?? "").trim().replace(/^\+\s*/, "");
    if ( part ) {
      if ( Roll.validate(part) ) rollOverride.parts = [part];
      else ui.notifications.warn(`${TITLE}: "${part}" is not a rollable bonus — rolling without it.`);
    }
    await actor.rollSavingThrow(
      { ability: flag.abilities[0], target: flag.dc,
        ...(Object.keys(rollOverride).length ? { rolls: [rollOverride] } : {}) },
      { configure: false },
      { data: { flags: {
        // Chained to the demand card so the system's registry ties the whole moment
        // together — a programmatic roll must pass this explicitly (no DOM click to
        // inherit it from).
        dnd5e: { originatingMessage: card.id },
        // The exact answer channel: WHICH card, WHICH target. Immune to the getSpeaker
        // oldest-token trap by construction — the fold never has to resolve this roll's
        // actor at all.
        [MODULE_ID]: { respondsTo: card.id, saveFor: uuid,
          ...(timedOut ? { timedOut: true } : {}) }
      } } }
    );
  } catch(err) {
    console.error(`${TITLE} | Save roll failed — roll it from the sheet.`, err);
  } finally {
    saveRollsInFlight.delete(key);
  }
}

/* --- the fold: the elect judges the roll against the stored DC ------------------------------ */

/** Which pending demand target a save roll answers, or null. */
function saveAnsweredBy(rollMessage) {
  // 1) The module's own roll: exact by construction.
  const respondsTo = rollMessage.getFlag(MODULE_ID, "respondsTo");
  if ( respondsTo ) {
    const card = game.messages.get(respondsTo);
    const uuid = rollMessage.getFlag(MODULE_ID, "saveFor");
    if ( !card?.getFlag(MODULE_ID, "saves") || !uuid ) return null; // another machine's channel
    return { card, uuid };
  }
  const ability = rollMessage.getFlag("dnd5e", "roll.ability") ?? null;
  const actor = rollMessage.getAssociatedActor?.();
  if ( !actor ) return null;
  const matchPending = flag => (flag.status === "pending") && flag.abilities?.includes(ability)
    ? flag.targets.find(t => !t.done && (t.uuid === actor.uuid)) : null;
  // 2) Chained to a demand card — the native card's own save button arrives this way
  //    (buildPost stamps originatingMessage from the click's enclosing card). A save chained
  //    to any OTHER message belongs to that chain and is never read as an answer here.
  const originId = rollMessage.getFlag("dnd5e", "originatingMessage");
  if ( originId ) {
    const card = game.messages.get(originId);
    const flag = card?.getFlag(MODULE_ID, "saves");
    const entry = flag ? matchPending(flag) : null;
    return entry ? { card, uuid: entry.uuid } : null;
  }
  // 3) A bare sheet roll answers the oldest pending demand naming this actor with a matching
  //    ability — DEFERRING to a pending concentration ask, which recognizes bare rolls the
  //    same way and shipped first (the two cannot be told apart; simultaneous pendings are a
  //    corner the topple fold already accepts).
  const concPending = game.messages.some(m => {
    const c = m.getFlag(MODULE_ID, "concentration");
    return c && (c.status === "pending") && (c.actorUuid === actor.uuid) && (c.ability === ability);
  });
  if ( concPending ) return null;
  for ( const card of game.messages.contents ) { // whole log, oldest first — the tail lesson
    const flag = card.getFlag(MODULE_ID, "saves");
    const entry = flag ? matchPending(flag) : null;
    if ( entry ) return { card, uuid: entry.uuid };
  }
  return null;
}

/** Same-client fold latch — the create watcher, the buzzer and the render resume can race. */
const saveFolds = new Set();

async function foldSaveAnswer(card, uuid, rollMessage) {
  const key = `${card.id}|${uuid}`;
  if ( saveFolds.has(key) ) return;
  saveFolds.add(key);
  try {
    const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "saves") ?? {});
    if ( flag.status !== "pending" ) return;
    const entry = flag.targets?.find(t => !t.done && (t.uuid === uuid));
    if ( !entry ) return;
    const total = rollMessage.rolls?.[0]?.total;
    if ( typeof total !== "number" ) return;
    // The stored DC is the authority (the ask's-DC rule) — plus forceSuccess, in case
    // legendary resistance beat the fold to the message (a resume after an elect reload).
    const forced = rollMessage.getFlag("dnd5e", "roll.forceSuccess") === true;
    entry.done = true;
    entry.outcome = (forced || (total >= flag.dc)) ? "saved" : "failed";
    entry.total = total;
    entry.rollMessageId = rollMessage.id;
    if ( rollMessage.getFlag(MODULE_ID, "timedOut") ) entry.timedOut = true;
    if ( forced ) entry.forced = true;
    if ( flag.targets.every(t => t.done) ) {
      flag.status = "done";
      disarmAskTimer(saveTimers, card.id);
    }
    await card.setFlag(MODULE_ID, "saves", flag);
    await applySaveConsequences(card, uuid, rollMessage);
  } finally {
    saveFolds.delete(key);
  }
}

/* --- the consequences: Phase 3's save slice, per target, receipts throughout ---------------- */

/** Same-client latch across the verdict pause — fold, update watcher and render can overlap. */
const saveApplications = new Set();

/**
 * One target's consequences, once: wait out the dice (the verdict pause — mechanics are
 * already written, only the table-facing part holds), then effects per outcome, then any
 * already-rolled damage per outcome. The flag is RE-READ after the pause on purpose: a
 * legendary-resistance flip landing mid-pause overturns the outcome before anything applied.
 */
async function applySaveConsequences(card, uuid, rollMessage = null) {
  const key = `${card.id}|${uuid}`;
  if ( saveApplications.has(key) ) return;
  saveApplications.add(key);
  try {
    let flag = card.getFlag(MODULE_ID, "saves");
    let entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;
    if ( !rollMessage && entry.rollMessageId ) rollMessage = game.messages.get(entry.rollMessageId);
    if ( rollMessage ) await dramaticVerdictPause(rollMessage);

    flag = card.getFlag(MODULE_ID, "saves"); // the pause is wide — re-read before acting
    entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;

    await applySaveEffects(card, flag, entry);
    await reconcileSaveDamage(card, uuid);

    const merged = foundry.utils.deepClone(card.getFlag(MODULE_ID, "saves") ?? {});
    const done = merged.targets?.find(t => t.uuid === uuid);
    if ( done && !done.applied ) {
      done.applied = true;
      await card.setFlag(MODULE_ID, "saves", merged);
    }
    await cleanupSpentTemplates(card);
  } catch(err) {
    console.error(`${TITLE} | Save consequences failed.`, err);
  } finally {
    saveApplications.delete(key);
  }
}

/**
 * The activity's effects, filtered by the verdict: a failure applies them all, a success
 * applies only the entries whose own `onSave` says so — the flag the system stores and
 * nothing native reads. Through the shared applier: same origin rule (the caster's
 * concentration effect when the card carries one — the native dependentOn cascade rides
 * along), same receipts, same revert.
 */
async function applySaveEffects(card, flag, entry) {
  const activity = flag.activityUuid ? await fromUuid(flag.activityUuid) : null;
  if ( !activity ) return; // the item is gone (a consumed scroll) — accepted corner above
  const applicable = new Set((activity.applicableEffects ?? []).map(e => e.id));
  const toApply = (activity.effects ?? [])
    .filter(e => e.effect && applicable.has(e.effect.id))
    .filter(e => (entry.outcome === "failed") || e.onSave)
    .map(e => e.effect);
  if ( !toApply.length ) return;
  const concentration = card.getAssociatedActor?.()?.effects.get(card.system?.concentration) ?? null;
  await applyEffectsWithReceipt(card, toApply, [{ uuid: entry.uuid, name: entry.name }], {
    concentration,
    scaling: card.system?.scaling ?? 0,
    spellLevel: card.system?.spellLevel ?? undefined
  });
}

/** Every damage roll chained to the demand card — the card's own Damage button chains its
 * click natively, and the module's suite rolls pass the origin explicitly. Whole log. */
function saveDamageMessages(card) {
  return game.messages.contents.filter(m =>
    (m.getFlag("dnd5e", "roll.type") === "damage")
    && (m.getFlag("dnd5e", "originatingMessage") === card.id));
}

/** What a verdict does to the number: 1 on a failure; the activity's own word on a success;
 * nothing at all for any other outcome (a "gone" target has nobody to pay). */
function saveMultiplier(entry, damageOnSave) {
  if ( entry.outcome === "failed" ) return 1;
  if ( entry.outcome !== "saved" ) return null;
  if ( damageOnSave === "half" ) return 0.5;
  if ( damageOnSave === "full" ) return 1;
  return null; // "none": a successful save takes nothing at all — no application, no receipt
}

/** Land one chained damage roll on one target at its verdict's multiplier — the receipt says
 * why. Shared by the reconcile pass (behind its guards) and the legendary-resistance unwind
 * (which reverts first and re-applies DIRECTLY, because the guard below deliberately treats
 * any existing receipt entry — reverted included — as "handled": a human's manual ↩ revert
 * must stick, never be re-fought by the machine). */
async function applyOneSaveDamage(damageMessage, flag, entry) {
  const damageOnSave = damageMessage.getFlag("dnd5e", "roll.damageOnSave")
    ?? flag.damageOnSave ?? "half";
  const multiplier = saveMultiplier(entry, damageOnSave);
  if ( multiplier == null ) return;
  const damages = dnd5e.dice.aggregateDamageRolls(damageMessage.rolls, { respectProperties: true })
    .map(roll => ({
      value: Math.max(0, roll.total),
      type: roll.options.type,
      properties: new Set(roll.options.properties ?? [])
    }));
  if ( !damages.length ) return;
  await applyDamagesWithReceipt(damageMessage, [{ uuid: entry.uuid, name: entry.name }], damages, {
    multiplier,
    note: (entry.outcome === "saved")
      ? ((multiplier === 0.5) ? "saved — half damage" : "saved — full damage anyway")
      : undefined
  });
}

/** Per (damage message, target) latch — the fold path and the damage-arrival path share it. */
const saveDamageApplications = new Set();

/**
 * Land every chained damage roll on every DONE target that has no receipt entry yet, at the
 * verdict's multiplier — the applier records a non-1 multiplier on the entry, so the card
 * says why the number halved. Order-independent: damage before verdicts, verdicts before
 * damage, or interleaved per target, the receipt gate makes every path idempotent. Gated on
 * Auto-Apply Damage — a table that keeps its trays keeps them here too; the verdict rows
 * still say who saved.
 */
async function reconcileSaveDamage(card, onlyUuid = null) {
  if ( !setting(S.autoApply) ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // A demand with no damage dimension (no parts, or rider damage the save doesn't
  // modulate — the onSave "full" stamp rule) never applies chained damage by verdict:
  // a Web-burn enricher click chains to the card, and per-verdict application would
  // re-create finding ③ through the side door. The native tray owns those rolls.
  if ( !flag.hasDamage ) return;
  for ( const damageMessage of saveDamageMessages(card) ) {
    for ( const entry of flag.targets ) {
      if ( !entry.done ) continue;
      // The general passes (damage arrival, render resume, update watcher) apply only
      // targets whose consequence pass has FINISHED — the verdict pause gates every
      // table-facing consequence, damage included, and the fold's flag write must not let
      // a reconcile racing ahead of the pause undercut it (caught by smoke-saves 3d: the
      // damage landed while the effects were still waiting out the dice). The explicit
      // per-target path (the post-pause consequence pass, the LR unwind) applies regardless.
      if ( onlyUuid ? (entry.uuid !== onlyUuid) : !entry.applied ) continue;
      const key = `${damageMessage.id}|${entry.uuid}`;
      if ( saveDamageApplications.has(key) ) continue;
      // ANY receipt entry — reverted included — means this pairing is handled: applied by an
      // earlier pass, or applied and then manually reverted by a human whose ↩ the machine
      // must never re-fight. (The legendary-resistance unwind re-applies through
      // applyOneSaveDamage directly, not through this guard.)
      if ( damageMessage.getFlag(MODULE_ID, "receipt")?.targets
        ?.some(t => t.uuid === entry.uuid) ) continue;
      saveDamageApplications.add(key);
      try {
        await applyOneSaveDamage(damageMessage, flag, entry);
      } finally {
        saveDamageApplications.delete(key);
      }
    }
  }
}

/* --- legendary resistance: the one late answer ----------------------------------------------
 * resistSave (npc.mjs) spends the resource and stamps `flags.dnd5e.roll.forceSuccess` onto
 * the SAVE message as an update — strictly after the failure landed, possibly after its
 * consequences did. The elect overturns the verdict: flip the entry, and if consequences
 * already ran, un-apply what the failure applied (receipt-exact) and re-apply what a success
 * grants. This is the corner Phase 2.5 recorded as accepted; Phase 2 owns it.
 * --------------------------------------------------------------------------------------------- */

async function flipForcedSave(rollMessage) {
  try {
    for ( const card of game.messages.contents ) {
      const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "saves") ?? null);
      const entry = flag?.targets?.find(t => t.rollMessageId === rollMessage.id);
      if ( !entry ) continue;
      if ( entry.outcome !== "failed" ) return; // already saved, or already flipped
      entry.outcome = "saved";
      entry.forced = true;
      await card.setFlag(MODULE_ID, "saves", flag);
      // ALWAYS unwind, whatever `applied` says: the effects pass and the damage pass are
      // independently timed (damage can land through the arrival path before the effects
      // pass marks `applied`), and the receipts are the truth of what actually happened —
      // an unwind over empty receipts is a no-op, and a still-pending consequence pass
      // re-reads the flipped flag after its pause and applies the success path itself.
      await unwindFailedConsequences(card, entry);
      return; // one roll answers one entry
    }
  } catch(err) {
    console.error(`${TITLE} | Legendary-resistance flip failed.`, err);
  }
}

async function unwindFailedConsequences(card, entry) {
  // Effects: remove what only a failure grants; keep what a success would also get. Matched
  // by NAME against the stamped onSave list — fuzzier than ids, but the applied document's
  // id is per-target and the source's isn't, and the realistic case (one effect, no onSave
  // twin) is exact.
  const flag = card.getFlag(MODULE_ID, "saves");
  const keep = new Set(flag?.effectNames?.always ?? []);
  const receipt = card.getFlag(MODULE_ID, "effectReceipt");
  for ( const e of (receipt?.targets?.find(t => t.uuid === entry.uuid)?.effects ?? []) ) {
    if ( e.reverted || keep.has(e.name) ) continue;
    await revertEffect(card, entry.uuid, e.id);
  }
  // Damage: revert the failure's application, then re-apply at the success multiplier
  // DIRECTLY (the reconcile guard treats any receipt entry as handled, so a manual revert
  // sticks — this path is the one deliberate exception, and the merge replaces the reverted
  // entry so the card ends up telling the final truth).
  // ⚠ Lazily bound on purpose: a static import of receipts.js would evaluate it BEFORE this
  // file and register its render row ahead of ours — the ESM order trap. The entry imports
  // saves.js before receipts.js so the verdict row renders above the receipt rows; keep it so.
  const { revertTarget } = await import("./receipts.js");
  for ( const dmg of saveDamageMessages(card) ) {
    const had = dmg.getFlag(MODULE_ID, "receipt")?.targets
      ?.find(t => (t.uuid === entry.uuid) && !t.reverted);
    if ( !had ) continue;
    await revertTarget(dmg, entry.uuid);
    if ( setting(S.autoApply) ) await applyOneSaveDamage(dmg, flag, entry);
  }
}

/* --- the buzzer: expiry rolls, on the elect -------------------------------------------------- */

const saveTimers = new Map();
const armSaveTimer = message => armAskTimer(saveTimers, message, "saves", fireSaveTimer);

async function fireSaveTimer(card) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag || (flag.status !== "pending") ) return;
  for ( const entry of flag.targets ) {
    if ( entry.done ) continue;
    // An unfolded answer beats the clock, not races it.
    const landed = game.messages.find(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
      && (m.getFlag(MODULE_ID, "saveFor") === entry.uuid));
    if ( landed ) { void foldSaveAnswer(card, entry.uuid, landed); continue; }
    // A target that no longer exists has nobody to roll — void it, or the demand sits
    // pending forever with a buzzer that already fired (the concentration timer's rule).
    const actor = await fromUuid(entry.uuid).catch(() => null);
    if ( !(actor instanceof Actor) ) {
      const merged = foundry.utils.deepClone(card.getFlag(MODULE_ID, "saves") ?? {});
      const gone = merged.targets?.find(t => !t.done && (t.uuid === entry.uuid));
      if ( gone ) {
        gone.done = true;
        gone.outcome = "gone";
        gone.applied = true; // nothing to apply to
        if ( merged.targets.every(t => t.done) ) merged.status = "done";
        await card.setFlag(MODULE_ID, "saves", merged);
      }
      continue;
    }
    await rollSaveAnswer(card, entry.uuid, { timedOut: true });
  }
}

/* --- who volunteers: the opt-out's silent roller --------------------------------------------- */

/** Deterministic on every client — same sorted user list (the concentration election). */
function saveRollerUser(actor) {
  const owners = game.users
    .filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    .sort((a, b) => a.id.localeCompare(b.id));
  return owners[0] ?? game.users.activeGM;
}

/* --- the answer channels and the resume discipline ------------------------------------------- */

Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  // A save roll landing: fold it into whatever demand it answers.
  if ( message.getFlag("dnd5e", "roll.type") === "save" ) {
    const found = saveAnsweredBy(message);
    if ( found ) void foldSaveAnswer(found.card, found.uuid, message);
  }
  // The card's damage roll landing: verdicts that already exist apply now; the rest apply
  // as they fold, per target.
  if ( message.getFlag("dnd5e", "roll.type") === "damage" ) {
    const origin = message.getOriginatingMessage?.();
    if ( origin && (origin !== message) && origin.getFlag(MODULE_ID, "saves") ) {
      void reconcileSaveDamage(origin);
    }
  }
});

Hooks.on("updateChatMessage", message => {
  // Legendary resistance: a save flipped to success after the fact.
  if ( isActiveGM() && (message.getFlag("dnd5e", "roll.type") === "save")
    && (message.getFlag("dnd5e", "roll.forceSuccess") === true) ) {
    void flipForcedSave(message);
  }

  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // Every client closes popups whose decision is made; the timer disarms when nothing is left.
  for ( const t of flag.targets ?? [] ) {
    const dialog = livePopups.get(popupKey(message.id, `save:${t.uuid}`));
    if ( dialog && (t.done || (flag.status !== "pending")) ) void dialog.close();
  }
  // A DROPPED entry's popup is asking a withdrawn question (the live Shatter strand,
  // 2026-08-17: containment moved the demand off a snapshot target, and the popup sat open
  // with a dead bar and no buzzer ever coming — the buzzer only knows entries that still
  // exist). Sweep every popup for this card whose entry is GONE, and clear its shown-latch
  // so a re-arrival gets a fresh ask. Runs on every client — the popup lives wherever
  // canAnswerFor put it, not where the refresh ran.
  const savePrefix = `${message.id}|save:`;
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(savePrefix) ) continue;
    const uuid = key.slice(savePrefix.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) void dialog.close();
  }
  for ( const key of [...shownSaveAsks] ) {
    if ( !key.startsWith(`${message.id}|`) ) continue;
    const uuid = key.slice(`${message.id}|`.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) shownSaveAsks.delete(key);
  }
  if ( flag.status !== "pending" ) disarmAskTimer(saveTimers, message.id);
  else {
    // The demand lands as an UPDATE (the system creates the card, the caster stamps it a
    // beat later), so arrival work rides here as well as on render.
    armSaveTimer(message);
  }
  if ( isActiveGM() ) {
    for ( const t of flag.targets ?? [] ) {
      if ( t.done && !t.applied ) void applySaveConsequences(message, t.uuid);
    }
    // The sweep's convergent floor (finding ②): a done demand re-offers its spent-area
    // cleanup here, so a one-shot lost to an elect flip lands on the next update.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
  // The queue advances: a resolved target may free the next demand card for its actor.
  for ( const t of flag.targets ?? [] ) {
    if ( !t.done ) continue;
    const next = pendingSaveCardsFor(t.uuid)[0];
    if ( next && (next.id !== message.id) ) {
      shownSaveAsks.delete(`${next.id}|${t.uuid}`);
      try { ui.chat?.updateMessage?.(next); } catch(err) { /* row refreshes next render */ }
    }
  }
});

Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(saveTimers, message.id);
  for ( const key of shownSaveAsks ) if ( key.startsWith(`${message.id}|`) ) shownSaveAsks.delete(key);
});

/* --- the views: the card row and the popup --------------------------------------------------- */

/** Popups this client has auto-shown (card.id|uuid), so a re-render never stacks a second. */
const shownSaveAsks = new Set();

/** Every still-pending demand naming this actor, oldest first — the popup queue. */
function pendingSaveCardsFor(actorUuid) {
  return game.messages.contents
    .filter(m => {
      const f = m.getFlag(MODULE_ID, "saves");
      return f && (f.status === "pending") && f.targets.some(t => !t.done && (t.uuid === actorUuid));
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** One verdict, in table English — the row and nothing else derives this. */
function verdictText(flag, t) {
  if ( !t.done ) return null;
  if ( t.outcome === "gone" ) return "the target is gone — nothing to roll";
  const half = flag.hasDamage
    ? (flag.damageOnSave === "half") ? " — half damage"
      : (flag.damageOnSave === "none") ? " — no damage" : " — full damage anyway"
    : "";
  const base = (t.outcome === "saved")
    ? `saved${half}` : `failed`;
  return `${t.total} vs DC ${flag.dc} — ${base}`
    + `${t.forced ? " (legendary resistance)" : ""}${t.timedOut ? " (timer)" : ""}`;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;

  // A WAITING demand (the v1.12.0 targetless template stamp): zero targets, clock unarmed.
  // Say so — a silent card here is indistinguishable from finding ③'s bug — and run the
  // adoption floor on the elect: the CRUD hooks are only fast-paths (the headless ground
  // truth), so a render is what reliably notices the placed area.
  if ( !flag.targets?.length ) {
    if ( flag.status !== "pending" ) return;
    if ( isActiveGM() ) void refreshDemandFromTemplates(message);
    const abilityLabel = CONFIG.DND5E.abilities[flag.abilities?.[0]]?.label ?? flag.abilities?.[0] ?? "";
    const row = document.createElement("div");
    row.className = "battleflow-saves";
    row.style.marginTop = "0.35rem";
    const line = document.createElement("div");
    Object.assign(line.style, {
      fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6", fontWeight: "bold", opacity: "0.75"
    });
    line.textContent = `${abilityLabel} save DC ${flag.dc} — waiting for the template's area`;
    row.appendChild(line);
    html.querySelector(".message-content")?.appendChild(row);
    return;
  }

  const row = document.createElement("div");
  row.className = "battleflow-saves";
  row.style.marginTop = "0.35rem";

  const pending = flag.status === "pending";
  const abilityLabel = CONFIG.DND5E.abilities[flag.abilities?.[0]]?.label ?? flag.abilities?.[0] ?? "";

  for ( const t of flag.targets ) {
    const line = document.createElement("div");
    Object.assign(line.style, {
      fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6", fontWeight: "bold"
    });
    if ( t.done ) {
      line.style.opacity = "0.85";
      line.innerHTML = `${t.name} — <span style="color:${t.outcome === "saved"
        ? "var(--dnd5e-color-blue, #3a7ca5)" : "var(--dnd5e-color-maroon, #740b0b)"};">`
        + `${verdictText(flag, t)}</span>`;
    } else {
      const actor = (() => { try { return fromUuidSync(t.uuid); } catch { return null; } })();
      const roller = (actor instanceof Actor) ? saveRollerUser(actor) : null;
      line.style.opacity = "0.75";
      // A player-owned target whose owner is offline rides the buzzer, not the GM's popup
      // stack (finding ④) — "waiting on Matt the DM" was a lie the moment nothing popped.
      // With no window there is no buzzer, so the GM (whose Roll button is the real path)
      // stays named.
      const waitingOn = (roller?.isGM && actor?.hasPlayerOwner && flag.window)
        ? "the timer (owner offline)" : (roller?.name ?? "the GM");
      line.textContent = `${t.name} — ${abilityLabel} save DC ${flag.dc}, waiting on ${waitingOn}`;
    }
    row.appendChild(line);
    // EVERY pending row runs the demand's bar (v1.11.0, finding ④ — "two timers tick
    // side by side" was the user's expectation on a two-target demand; the single bar
    // under the last row read as that row's alone, with the others' "missing"). Each bar
    // anchors to the same absolute deadline, so the popup pairing and the drift-0 rule
    // are untouched — a resolved row's bar leaves with its pending text.
    if ( pending && !t.done ) {
      const bar = document.createElement("div");
      bar.innerHTML = holdBarHTML(flag, "to roll");
      row.appendChild(bar);
    }
  }

  if ( pending ) {
    scheduleBarSync(row);
    armSaveTimer(message);

    // Resume, stateless (the split discipline): an answer landed while nobody could fold;
    // a verdict landed while nobody could apply; damage landed while nobody could reconcile.
    if ( isActiveGM() ) {
      // The containment floor: a pending demand follows its area on every render — the
      // template CRUD hooks are only fast-paths (measured unreliable on the headless elect).
      void refreshDemandFromTemplates(message);
      for ( const t of flag.targets ) {
        if ( t.done ) continue;
        const landed = game.messages.find(m => (m.getFlag(MODULE_ID, "respondsTo") === message.id)
          && (m.getFlag(MODULE_ID, "saveFor") === t.uuid));
        if ( landed ) void foldSaveAnswer(message, t.uuid, landed);
      }
    }

    for ( const t of flag.targets ) {
      if ( t.done ) continue;
      const actor = (() => { try { return fromUuidSync(t.uuid); } catch { return null; } })();
      if ( !canAnswerFor(actor) ) continue;
      // The GM's UNSOLICITED popups are non-player-owned targets only (v1.12.0, finding ④,
      // user call: "as a GM i dont care to see other player saves"). canAnswerFor falls
      // back to the GM when a player-owned actor's owner is offline — that target rides
      // the buzzer instead (or the Roll button below: recall is a deliberate click, never
      // spam). Player-owned with an owner PRESENT never reaches here (canAnswerFor is
      // false on the GM client); NPCs and unowned characters keep their popups.
      const gmQuiet = game.user.isGM && !!actor?.hasPlayerOwner;
      // ONE input surface, queued: auto-show only for the actor's OLDEST pending demand;
      // the button recalls this card's popup regardless.
      if ( !gmQuiet && (pendingSaveCardsFor(t.uuid)[0]?.id === message.id) ) {
        const shownKey = `${message.id}|${t.uuid}`;
        if ( !shownSaveAsks.has(shownKey) ) {
          shownSaveAsks.add(shownKey);
          void showSavePopup(message, t.uuid);
        }
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Roll — ${t.name}`;
      Object.assign(button.style, { width: "auto", margin: "0.25rem 0.25rem 0 0", padding: "0 0.6rem" });
      button.addEventListener("click", () => {
        shownSaveAsks.delete(`${message.id}|${t.uuid}`);
        void showSavePopup(message, t.uuid);
      });
      row.appendChild(button);
    }
  }
  if ( isActiveGM() ) {
    for ( const t of flag.targets ) {
      if ( t.done && !t.applied ) void applySaveConsequences(message, t.uuid);
    }
    if ( flag.targets.some(t => t.done) ) void reconcileSaveDamage(message);
    // The sweep's convergent floor (finding ②) — render side, the reload-resume twin of
    // the update floor above.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
  html.querySelector(".message-content")?.appendChild(row);
});

/**
 * The popup — the demand's story over the native roll dialog's own controls, exactly the
 * concentration ask's surface: a situational bonus field and Advantage/Normal/Disadvantage,
 * default hinted from the actor's own save-roll mode. Every button is the same answer —
 * roll — so the two-control rule (which governs decisions) is not in play; dismissing is not
 * an answer, the card's Roll button recalls it, and the buzzer rolls regardless.
 */
async function showSavePopup(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.done || (flag.status !== "pending") ) return;
  const actor = (() => { try { return fromUuidSync(uuid); } catch { return null; } })();
  if ( !canAnswerFor(actor) ) return;
  const key = popupKey(card.id, `save:${uuid}`);
  // Recall FRONTS a live popup rather than silently returning — "the Roll button does
  // nothing" was the GM's live report (2026-08-16): the popup was open, buried, and the
  // click ate itself. Reopen stays for the dismissed case.
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }

  const ability = flag.abilities[0];
  const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability;
  const ADV = CONFIG.Dice.D20Roll.ADV_MODE;
  const dataMode = actor?.system?.abilities?.[ability]?.save?.roll?.mode ?? ADV.NORMAL;
  const def = (dataMode === ADV.ADVANTAGE) ? "advantage"
    : (dataMode === ADV.DISADVANTAGE) ? "disadvantage" : "normal";

  const stakes = [];
  if ( flag.hasDamage ) stakes.push(
    (flag.damageOnSave === "half") ? "A successful save <strong>halves</strong> the damage."
      : (flag.damageOnSave === "none") ? "A successful save avoids the damage <strong>entirely</strong>."
      : "The damage lands either way.");
  if ( flag.effectNames?.fail?.length ) stakes.push(
    `A failure also applies: <strong>${flag.effectNames.fail.join(", ")}</strong>.`);
  if ( flag.effectNames?.always?.length ) stakes.push(
    `Applies either way: <strong>${flag.effectNames.always.join(", ")}</strong>.`);

  let dialog;
  const roll = mode => rollSaveAnswer(card, uuid, {
    mode, bonus: dialog?.element?.querySelector('input[name="bf-save-bonus"]')?.value ?? ""
  });
  dialog = new foundry.applications.api.DialogV2({
    window: { title: `${entry.name} — ${abilityLabel} Save`, icon: "fa-solid fa-shield-heart" },
    position: { width: 440 },
    content: bfCard({
      // WHO is rolling leads, portrait included — the GM processes queues of these and the
      // creature is the load-bearing fact (user call 2026-08-16); the spell is subtitle work.
      img: actor?.img ?? flag.item?.img ?? null,
      eyebrow: "Saving throw",
      title: `${entry.name}: ${abilityLabel} save, DC ${flag.dc}`,
      subtitle: `${flag.item?.name ?? "An effect"}`
        + `${flag.casterName ? `, from ${flag.casterName}` : ""}`,
      lines: stakes,
      tone: "pending"
    }) + `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Situational Bonus</label>
      <input type="text" name="bf-save-bonus" placeholder="e.g. 1d4" autocomplete="off"
             style="flex:1;min-width:0;text-align:center;">
    </div>` + holdBarHTML(flag, "to roll"),
    buttons: [
      { action: "advantage", label: "Advantage", default: def === "advantage",
        callback: () => roll("advantage") },
      { action: "normal", label: "Normal", default: def === "normal",
        callback: () => roll("normal") },
      { action: "disadvantage", label: "Disadvantage", default: def === "disadvantage",
        callback: () => roll("disadvantage") }
    ],
    rejectClose: false
  });
  await openManagedPopup(key, card, dialog);
}
