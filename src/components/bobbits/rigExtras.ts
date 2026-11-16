// Copied verbatim from Civic-Trivia-Championships frontend/src/components/bobbits/rigExtras.ts.
// Do not edit here: re-sync by overwriting this file from the source and keeping these header
// lines. @ts-nocheck: this repo enables noUncheckedIndexedAccess and the source does not; the
// file is not ours to restyle, and its exported types still check every caller.
// @ts-nocheck

import { ANIMATIONS, clonePose, wave, REST, drawQuizCard, roundRectPath } from './leremyRig';
import type { Animation, AnimVars } from './leremyRig';

export { drawQuizCard };

/**
 * CTC-only additions to the Leremy rig.
 *
 * `leremyRig.ts` is a faithful mirror of empowered.vote's `leremy-rig.js` so re-syncing it
 * stays a clean overwrite. Anything this app invents lives here instead: four extra poses,
 * the trophy prop, and the brand-derived figure palette.
 *
 * Consumers should import ALL_ANIMATIONS from this file rather than ANIMATIONS from the rig
 * -- the rig alone does not know about cheer, dance, offer or ponder.
 */

/**
 * The brand-derived figure palette -- 6 tones, tuned separately per theme for legibility
 * (0 teal | 1 coral | 2 gold | 3 green | 4 purple | 5 orange).
 */
export const FIG_COLORS = {
  light: ['#007D99', '#FF5740', '#B8860B', '#2E9E5B', '#7A4FD0', '#E0641C'],
  dark: ['#1DA8C6', '#FF6B52', '#FFD740', '#43D07E', '#B49BFF', '#FF9A4D'],
};

export function figColor(i: number, darkMode: boolean): string {
  const pal = darkMode ? FIG_COLORS.dark : FIG_COLORS.light;
  return pal[i % pal.length];
}

/**
 * How far apart the two carriers' inner hands must sit, in rig units, for each to land on a
 * corner of the trophy's pedestal. drawTrophy's pedestal is 12.5 units either side of centre
 * and the prop draws at TROPHY_SIZE_MULT = 2, so the pedestal spans 50 units and the trophy
 * rides the hands' midpoint.
 */
export const GRIP_HAND_SPAN_UNITS = 50;

/**
 * The bow's cycle: fold down, hold, rise, then stand before the next one.
 *
 * The STAND is what makes it read as repeated bowing rather than as a bobbing idle -- without
 * a real pause the figure just oscillates. Chris asked for "bow, repeatedly".
 */
const BOW_FOLD = 0.5;
const BOW_HOLD = 0.4;
const BOW_RISE = 0.5;
/**
 * 0.6, not the 1.2 this shipped with first.
 *
 * At 1.2 the cycle was 2.6s and a bower stood upright for 46% of it -- and since every bower
 * carries his own phase offset, that meant about half the cast was standing at any instant,
 * indistinguishable from an audience member between claps. Counted on a contact sheet: 4 of 5
 * bowing at one instant, 2 of 3 at another, exactly what the duty cycle predicts.
 *
 * At 0.6 the cycle is 2.0s and he is folded 70% of the time, while 0.6s upright is still a
 * clear beat between bows rather than a continuous bob.
 */
const BOW_STAND = 0.6;
export const BOW_CYCLE = BOW_FOLD + BOW_HOLD + BOW_RISE + BOW_STAND;

/** Ease in and out, so he leans into the bow and settles out of it rather than snapping. */
function bowEase(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/** How deep into the bow he is, 0 standing to 1 fully folded, across one cycle. */
function bowDepth(c: number): number {
  if (c < BOW_FOLD) return bowEase(c / BOW_FOLD);
  if (c < BOW_FOLD + BOW_HOLD) return 1;
  if (c < BOW_FOLD + BOW_HOLD + BOW_RISE) {
    return bowEase(1 - (c - BOW_FOLD - BOW_HOLD) / BOW_RISE);
  }
  return 0;
}

/** Poses this app added to the rig. Built on the ported ones where it makes sense. */
export const EXTRA_ANIMATIONS: Record<string, Animation> = {
  // `carry` with the arms reaching in, so two carriers can actually hold the trophy between
  // them. `carry` itself is ev-figures.js's beam-crew pose: its arms hang close to the body
  // because a beam wider than four figures sits UNDER the hands. CTC's trophy is 50 units
  // wide against a 150-unit gap, so those hands had nothing to reach for and the logo floated.
  //
  // NOT symmetric, and it cannot be. `computePose` adds the body-bend term `ub = lean + hunch`
  // (~-16 here, from carry's hunch=-14 plus the walk-cycle wave) to BOTH arm angles, and
  // cos(ub + t) != cos(ub - t), so a mirrored pose puts the two hands at DIFFERENT heights --
  // the earlier symmetric 31/39/-31/-39 left a 26-32 unit vertical split between them (hR.y
  // ~ +15.5, hL.y ~ -13.0). The trophy rides the hands' midpoint, so each hand missed the
  // pedestal base by ~14 units: the lead carrier's hand overlapped the pedestal and the rear
  // carrier's hung clear beneath it. Independent left/right angles are the fix.
  //
  // PER-SIDE, via AnimVars.hand, as `greet` does. One pose served both roles at first and only
  // the INNER arm was ever asserted -- so the outer arm inherited the same near-horizontal
  // reach and both carriers stood in a T-pose, arms held straight out into empty space. The
  // contact test could not see it: it constrains the two gripping hands and nothing else. A
  // screenshot caught it. Pass `{ hand: 'R' }` for the rear carrier (reaches right, toward the
  // trophy) and `{ hand: 'L' }` for the lead (reaches left); the other arm keeps `carry`'s own
  // hang, which is what a person not holding anything with it actually does.
  //
  // The gripping-hand angles below are unchanged from the tuning that fixed the two axes --
  // splitting the pose per side moves no hand, it only stops the idle arm copying the reach.
  //
  // These four angles are TUNED AGAINST __tests__/trophyGrip.test.ts, not derived -- change
  // them only by re-running that test, which is the arbiter on BOTH axes. Tuning log,
  // 2026-09-09, measured over a 10s sweep of the gait (span = distance between the two inner
  // hands, target 50; split = hR.y - hL.y, target 0):
  //
  //   armRU/armRF/armLU/armLF        span            split    note
  //   33 / 41 / -33 / -41            ~46             ~28      the brief's arithmetic; ignored `ub`
  //   50 / 50 / -50 / -50            ~20             --       corrected geometry; overshot inward
  //   31 / 39 / -31 / -39            49.06 - 51.57   26 - 32  x passed, y was never asserted
  //   6 / 107 / -9 / -68             50.15 - 50.35   <= 6.40  both axes; kept
  //
  // Two IK solutions reach the same hand target; the one kept is elbows-at-the-sides with
  // horizontal forearms (elbow-down). Its mirror, armRU=104/armRF=3/armLU=-67/armLF=-8, lands
  // the hands identically but splays the elbows out above shoulder height -- chicken wings.
  // The hands also sit ~23 units higher than the old pose, which lifts the trophy to about rib
  // height; checked against the canvas at both scales, the heads still top the silhouette.
  carryGrip: {
    label: "Carrying (grip)", mood: "mind the trophy",
    frame(t: number, v?: AnimVars) {
      const p = ANIMATIONS.carry.frame(t);
      // Only the arm named reaches for the pedestal. The other keeps carry's hang.
      // Defaults to 'R' so a caller that forgets the variant still grips with one arm
      // rather than neither.
      if (v?.hand === 'L') { p.armLU = -9; p.armLF = -68; }
      else { p.armRU = 6; p.armRF = 107; }
      return p;
    },
  },
  cheer: {
    label: "Cheer", mood: "yes! got it!",
    frame(t: number) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 1.05);
      p.armRU = 150 + s * 6; p.armRF = 150 + s * 9;
      p.armLU = -150 - s * 6; p.armLF = -150 - s * 9;
      p.headTilt = -7;
      p.bob = p.bob - 1.5 - Math.abs(s) * 2;
      return p;
    },
  },
  // Not in the source rig — an original addition. Hands stay up (same silhouette as cheer)
  // but the whole body sways and steps side to side with a bouncy beat, and the arms pump
  // out of sync with each other, so it reads as dancing rather than a held celebration pose.
  dance: {
    label: "Dance", mood: "five for five, baby",
    frame(t: number) {
      const p = clonePose(REST);
      const sway = wave(t, 1.1);
      const pumpR = wave(t, 2.2);
      const pumpL = wave(t, 2.2, Math.PI * 0.6);
      p.lean = sway * 12;
      p.bob = -Math.abs(wave(t, 2.2)) * 5 + 3;
      p.hunch = -4;
      p.headTilt = sway * 10 + pumpR * 4;
      p.armRU = 150 + pumpR * 14;
      p.armRF = 150 + pumpR * 22;
      p.armLU = -150 - pumpL * 14;
      p.armLF = -150 - pumpL * 22;
      p.legRU = 10 + sway * 20;
      p.legLU = -10 - sway * 20;
      p.legRF = -Math.max(0, sway) * 22;
      p.legLF = Math.max(0, -sway) * 22;
      return p;
    },
  },
  // Hands meet in front of the chest and part again. Built on `present` rather than REST so
  // the torso keeps its slight forward address -- a clap from a ramrod-straight body reads as
  // a golf clap, which is the wrong note for a room celebrating you.
  //
  // BOTH angles are measured from the upper-body direction `ub`, not from each other: the
  // forearm's angle is absolute, so it does NOT inherit the upper arm's. 0 deg points straight
  // DOWN, +ve toward the viewer's right. The first draft read armRF as an elbow bend and used
  // +96..+130, which swung both forearms past horizontal and produced a textbook T-POSE -- arms
  // straight out to the sides, hands meeting at the fingertips. The joint tests passed it: they
  // asserted the arms were symmetric and that the forearm angle travelled, and a T-pose
  // satisfies both. A pose sheet caught it, exactly as the trophy-grip T-pose was caught.
  //
  // Tuned 2026-09-13 by solving for the hand gap over a grid (gap = hR.x - hL.x; 0 is hands
  // touching, negative means they have crossed through each other):
  //
  //   armRU  armRF   hand.y   gap     note
  //    58    +96..   --       --      the T-POSE; armRF read as an elbow bend
  //    15    -80     44.8    -46.8    elbows pinned to the ribs, hands cross straight through
  //    38    -50     58.5     +0.4    hands meet -- but at HIP height, elbows splayed: this
  //                                   renders as hands-on-hips akimbo, not as clapping
  //    26   -145      5.0     +0.9    hands meet at CHEST height, elbows down -- KEPT (closed)
  //    26   -169      0.2     +31     the open end of the swing            -- KEPT (open)
  //
  // Note the counter-intuitive direction: pushing armRF FURTHER negative opens the hands
  // rather than closing them, because past about -140 the forearm is swinging up toward
  // vertical and the hand stops travelling inward. y=0 is the shoulder line, so hand.y near 5
  // is upper chest and hand.y near 58 is the hip -- which is what made the second attempt read
  // as akimbo despite the hands genuinely touching.
  /**
   * A theatrical bow, for a bobit earned in the match the player has just finished.
   *
   * DERIVED FROM `spent`, not invented. `spent` is the rig's proven deep forward fold
   * ("doubled over, hands braced on the thighs") and it already answers the two things that
   * would otherwise be guesswork here:
   *
   *   1. NEGATIVE hunch is forward. See leremyRig's gait comment: "pitched FORWARD (negative
   *      hunch = toward travel)". `read` uses +22 for "reclined back into the chair".
   *   2. At a -44 fold, "arms straight down" is armRU 58 / armRF 26, because arm angles hang
   *      from the ALREADY-CURLED torso (`ub = lean + hunch`). Do not re-derive this; spent
   *      measured it.
   *
   * What differs from `spent`: the knees stay STRAIGHT (spent buckles them -- he is winded,
   * not bowing), and the fold is animated on a cycle rather than held.
   */
  bow: {
    label: "Bow", mood: "thank you, thank you",
    frame(t: number) {
      const p = clonePose(REST);
      const c = ((t % BOW_CYCLE) + BOW_CYCLE) % BOW_CYCLE;
      const k = bowDepth(c);
      // A little breathing at the bottom so a held bow is not perfectly frozen.
      const br = wave(t, 0.9) * k;

      p.lean = 5 * k;
      p.hunch -= 50 * k + br * 2;          // NEGATIVE is forward
      p.headTilt -= 10 * k;                 // head follows the fold down
      p.bob += 4 * k;
      // Arms sweep down and slightly back as he folds, from spent's measured "straight down".
      p.armRU += 58 * k; p.armRF += 26 * k;
      p.armLU += 46 * k; p.armLF += 18 * k;
      return p;
    },
  },
  clap: {
    label: "Clap", mood: "nice one",
    frame(t: number) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 3.4);                 // fast: claps are quicker than a wave
      // Amplitude is set by VISIBILITY at band scale, not by anatomy: the band draws figures
      // at scale 0.2, so a 17-unit hand travel is ~3px and reads as standing still. 25 units
      // of forearm swing moves the hands ~6px.
      const swing = -157 + s * 12;            // -169 apart .. -145 together
      p.armRU = 26; p.armRF = swing;
      p.armLU = -26; p.armLF = -swing;

      // Six pixels of hand travel is still marginal on a 39px figure, and widening the arms
      // further just reads as flapping. What carries at that size is the WHOLE SILHOUETTE
      // moving, so the body dips and folds into each clap rather than only the forearms
      // closing: a nod, a small crouch, and a shoulder curl, all on the clap's own beat.
      const beat = Math.max(0, s);            // 0 between claps, 1 at the moment of contact
      p.headTilt = -4 + s * 3;
      p.hunch = p.hunch - beat * 6;           // folds in as the hands meet
      p.bob = p.bob - beat * 4;               // and dips with it
      return p;
    },
  },
  // One arm up and across, body leaning into the partner. PER-SIDE via AnimVars.hand, the
  // same contract `greet` and `carryGrip` use: pass 'R' for the partner standing to the LEFT
  // (he reaches right) and 'L' for the one standing to the right.
  //
  // The non-slapping arm deliberately keeps its hang. Mirroring both arms reads as surrender,
  // not a high-five -- the same trap `carryGrip` documents at length, where the symmetric pose
  // is the intuitive choice and the wrong one.
  highfive: {
    label: "High five", mood: "up top",
    frame(t: number, v?: AnimVars) {
      const p = clonePose(REST);
      const s = wave(t, 2.6);
      p.hunch = -6;
      p.headTilt = -8;
      if (v?.hand === 'L') {
        p.lean = -9;
        p.armLU = -132 - s * 5; p.armLF = -38 - s * 4;
      } else {
        p.lean = 9;
        p.armRU = 132 + s * 5; p.armRF = 38 + s * 4;
      }
      return p;
    },
  },
  // Held out by both arms and both legs, as if two people are stretching him -- the instant the
  // flash leaves him hanging in mid-air, before he drops.
  //
  // Near-horizontal upper arms are CORRECT here. That is a T-pose, and this is the one pose in
  // the catalogue that wants one: he is being held, not doing something with his hands. Both
  // `carryGrip` and `clap` had to be rescued from exactly this shape, so it is worth saying out
  // loud that here it is the point. Nothing in the tests can tell the deliberate one from a
  // mistake -- only looking at it can.
  splayed: {
    label: "Splayed", mood: "...whoa",
    frame(t: number) {
      const p = clonePose(REST);
      const tremble = wave(t, 7.5);
      p.armRU = 88 + tremble * 4; p.armRF = 92 + tremble * 5;
      p.armLU = -88 - tremble * 4; p.armLF = -92 - tremble * 5;
      p.legRU = 34 + tremble * 3; p.legRF = 12;
      p.legLU = -34 - tremble * 3; p.legLF = -12;
      p.hunch = 4;
      p.headTilt = tremble * 5;
      p.bob = -2;
      return p;
    },
  },
  // Airborne and panicking: arms windmilling right the way round, out of phase with each other,
  // legs cycling. Used for the whole flight out of the cannon.
  flail: {
    label: "Flailing", mood: "AAAAAA",
    frame(t: number) {
      const p = clonePose(REST);
      const r = t * 6.5;                       // revolutions, fast
      const l = r + 1.9;                       // out of phase: panic, not a jumping jack
      p.armRU = Math.sin(r) * 120 + 40;
      p.armRF = Math.sin(r + 0.5) * 90 + 30;
      p.armLU = Math.sin(l) * -120 - 40;
      p.armLF = Math.sin(l + 0.5) * -90 - 30;
      p.legRU = 20 + Math.sin(r * 0.8) * 34;
      p.legRF = -20 + Math.sin(r * 0.8 + 1) * 24;
      p.legLU = -20 + Math.sin(l * 0.8) * 34;
      p.legLF = 20 + Math.sin(l * 0.8 + 1) * 24;
      p.hunch = -6;
      p.headTilt = Math.sin(r * 0.5) * 14;
      return p;
    },
  },
  offer: {
    label: "Offer", mood: "pick a collection, any collection",
    frame(t: number) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 0.7);
      p.armRU = 78 + s * 3; p.armRF = 92 + s * 3;
      p.headTilt = -3;
      return p;
    },
  },
  ponder: {
    label: "Ponder", mood: "hmm… is it the mayor or the council?",
    frame(t: number) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 0.45);
      p.armRU = 34; p.armRF = -162 + s * 3;
      p.headTilt = 11 + s * 2;
      p.hunch = p.hunch - 2;
      return p;
    },
  },
};

/**
 * The full catalogue: the 41 ported poses plus the walk alias, plus CTC's four.
 * Every consumer wants this, not the rig's bare ANIMATIONS.
 */
export const ALL_ANIMATIONS: Record<string, Animation> = { ...ANIMATIONS, ...EXTRA_ANIMATIONS };

const TROPHY_GOLD = '#FFD426';
const TROPHY_TEAL_DARK = '#59B0C4';
const TROPHY_TEAL_LIGHT = '#AAE7F5';


function quadPath(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = -Math.PI / 2 + i * (2 * Math.PI / 5);
    const innerA = outerA + Math.PI / 5;
    const ox = cx + Math.cos(outerA) * r, oy = cy + Math.sin(outerA) * r;
    const ix = cx + Math.cos(innerA) * r * 0.45, iy = cy + Math.sin(innerA) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The Civic Trivia Championship logo's own trophy — a faceted teal ribbon (two dark-teal
 * facets behind, two light-teal facets in front) under a gold star, on a two-tier gold
 * pedestal. Geometry ported directly from civic-trivia-logo-dark.svg's trophy paths
 * (right-aligned decoration, ~x:587-674 y:0-166 in the source), re-centered so x=0 is the
 * pedestal's own center and y=0 is its bottom edge, then scaled by 166 units -> ~48 raw
 * units so it sits correctly among the Bobbit figures (head radius 30, standing height ~195).
 * `s` is the same raw-unit scale factor used for the figures.
 */
export function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';

  // two-tier gold pedestal (wider bottom step, narrower top step)
  ctx.fillStyle = TROPHY_GOLD;
  roundRectPath(ctx, -12.5 * s, -4.4 * s, 25 * s, 4.4 * s, 0.6 * s);
  ctx.fill();
  roundRectPath(ctx, -9.9 * s, -8.76 * s, 19.8 * s, 4.36 * s, 0.6 * s);
  ctx.fill();

  // faceted ribbon body — dark-teal facets behind, light-teal facets layered in front
  ctx.fillStyle = TROPHY_TEAL_DARK;
  quadPath(ctx, [[-0.51 * s, -8.77 * s], [-0.51 * s, -36.89 * s], [-9.88 * s, -41.89 * s], [-4.05 * s, -8.77 * s]]);
  ctx.fill();
  quadPath(ctx, [[-2.38 * s, -8.70 * s], [-2.38 * s, -29.92 * s], [-10.16 * s, -33.70 * s], [-5.32 * s, -8.70 * s]]);
  ctx.fill();

  ctx.fillStyle = TROPHY_TEAL_LIGHT;
  quadPath(ctx, [[-4.05 * s, -8.70 * s], [-4.05 * s, -33.70 * s], [6.50 * s, -29.15 * s], [1.40 * s, -8.70 * s]]);
  ctx.fill();
  quadPath(ctx, [[-2.38 * s, -8.70 * s], [-2.38 * s, -25.36 * s], [7.06 * s, -22.33 * s], [2.49 * s, -8.70 * s]]);
  ctx.fill();

  // gold star on top, offset slightly left of center to match the source logo
  drawStar(ctx, -5.19 * s, -42.49 * s, 5.66 * s, TROPHY_GOLD);

  ctx.restore();
}

/** The arrival colour. Brand purple from FIG_COLORS, lightened so it reads as smoke. */
export const SMOKE_PURPLE = '#9B7BE0';

/**
 * Seconds a smoke puff and a flash live.
 *
 * ONE definition each, deliberately. Two things need these numbers and they are in different
 * layers: the director decides when an effect is removed, BobitField fades it out over its
 * life. They were separate constants that happened to agree, and had they ever drifted an
 * effect would either blink out mid-fade or linger fully transparent. They live down here
 * beside `drawSmokePuff` because that is the layer both consumers can already see.
 */
export const SMOKE_DUR = 1.0;
export const FLASH_DUR = 0.22;

/**
 * The rig's `drawSmoke`, with a colour.
 *
 * `leremyRig.drawSmoke` hardcodes '#8A8F98' and the rig is a mirror of ev-landing, so a
 * variant lives here rather than a parameter being added there. Geometry is deliberately
 * identical -- the same deterministic angle/radius scatter -- so the two read as one effect.
 */
export function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  spread: number, alpha: number,
  seed: number, t: number,
  color: string,
) {
  if (!(alpha > 0) || !(spread > 0)) return;
  const N = 9;
  const DEG = Math.PI / 180;
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < N; i++) {
    const ang = ((seed * 37 + i * 61) % 360) * DEG;
    const rad = 0.35 + (((seed * 13 + i * 29) % 100) / 100) * 0.65;
    const drift = Math.sin(t * (0.7 + i * 0.13) + i) * spread * 0.14;
    const px = x + Math.cos(ang) * spread * rad + drift;
    const py = y - Math.abs(Math.sin(ang)) * spread * rad * 0.85 - spread * 0.2;
    const pr = spread * (0.26 + rad * 0.3);
    ctx.globalAlpha = Math.min(1, alpha) * (0.4 + rad * 0.45);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
