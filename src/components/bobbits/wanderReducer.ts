// Copied verbatim from Civic-Trivia-Championships frontend/src/components/bobbits/wanderReducer.ts.
// Do not edit here: re-sync by overwriting this file from the source and keeping these header
// lines. @ts-nocheck: this repo enables noUncheckedIndexedAccess and the source does not; the
// file is not ours to restyle, and its exported types still check every caller.
// @ts-nocheck

/**
 * Stroll / pause / look-around wandering for a decorative rail.
 *
 * ev-figures.js's wanderer walks one figure clean across the viewport (`av.x += av.dir *
 * av.speed * dt`) and retires it off-screen for 14-22s before the next appears. A CTC rail is
 * a few hundred px wide and always populated, so this turns at the bounds instead of retiring,
 * and adds a pause beat -- without it, a short rail reads as a metronome.
 *
 * Pure and immutable, like every other reducer here. Randomness is injected so phase lengths
 * and turns are seedable under test.
 */

/**
 * Travel speed in RIG UNITS per second, so it scales with the figure rather than the viewport.
 * ev-figures.js pairs `stroll` with 32 px/s at its S = 0.32 (GSPEED, ev-figures.js:1616),
 * which is 100 units/s. A figure's px/s is WANDER_UNITS_PER_SEC * scale.
 */
export const WANDER_UNITS_PER_SEC = 100;

/** Seconds a walk leg lasts, before a pause. */
export const WALK_MIN = 2.2;
export const WALK_MAX = 5.5;

/** Seconds a pause lasts. Long enough to read as "looking around", short enough not to stall. */
export const PAUSE_MIN = 1.2;
export const PAUSE_MAX = 3.0;

/**
 * Seconds a figure stops for when somebody is in its way.
 *
 * Shorter than a normal pause -- this is "oh, sorry", not "let me take in the view" -- but it
 * has to be long enough to break the encounter, or the two just meet again immediately.
 */
export const YIELD_MIN = 0.45;
export const YIELD_MAX = 1.1;

/**
 * Closest two wanderers may come, in rig units. fieldGeometry's HALF_W is 34, so two figures
 * at 68 are already touching; 76 leaves a visible sliver between them.
 */
export const MIN_SEPARATION = 76;

/** Matches fieldGeometry's HALF_W: no part of a figure may cross the rail edge. */
const EDGE_MARGIN_UNITS = 34;

export type WanderPhase = 'walk' | 'pause';

export interface Wanderer {
  /** px in field space. */
  x: number;
  dir: 1 | -1;
  phase: WanderPhase;
  /** Seconds spent in the current phase. */
  t: number;
  /** Seconds the current phase lasts. */
  next: number;
  /**
   * This pause was forced by somebody in the way, and the direction already chosen is the way
   * out. Leaving the pause must KEEP that direction instead of re-rolling it, or the figure
   * turns straight back into whoever it just stopped for.
   */
  hold?: boolean;
}

export type WanderState = Record<string, Wanderer>;

export type Rand = () => number;

export interface WanderOpts {
  /** Measured field width in px. */
  width: number;
  /** Figure scale, for converting unit speeds and gaps into px. */
  scale: number;
  /**
   * Ids currently greeting -- hovered, or still inside the greet linger. These hold still:
   * ev-figures.js gates its walker the same way (`if (!e.greet) av.x += ...`), so hovering
   * interrupts the walk rather than running a walk cycle on the spot.
   */
  greeting: ReadonlySet<string>;
  rand: Rand;
}

function span(min: number, max: number, rand: Rand): number {
  return min + (max - min) * rand();
}

export function initWander(
  seeds: Array<{ id: string; x: number; dir: 1 | -1 }>, rand: Rand,
): WanderState {
  const out: WanderState = {};
  for (const s of seeds) {
    out[s.id] = { x: s.x, dir: s.dir, phase: 'walk', t: 0, next: span(WALK_MIN, WALK_MAX, rand) };
  }
  return out;
}

export function wanderAdvance(state: WanderState, dt: number, opts: WanderOpts): WanderState {
  const { width, scale, greeting, rand } = opts;
  const margin = EDGE_MARGIN_UNITS * scale;
  const minGap = MIN_SEPARATION * scale;
  const speed = WANDER_UNITS_PER_SEC * scale;
  const ids = Object.keys(state);
  const out: WanderState = {};

  for (const id of ids) {
    const e = state[id];

    // Greeting: frozen where it stands, phase timer included. Resuming mid-leg afterwards is
    // deliberate -- it looks like being interrupted, not like restarting.
    if (greeting.has(id)) { out[id] = e; continue; }

    const t = e.t + dt;

    if (t >= e.next) {
      const phase: WanderPhase = e.phase === 'walk' ? 'pause' : 'walk';
      // A fresh direction is chosen on the way OUT of a pause, so the look-around beat is
      // what hides the turn.
      // Leaving a yield keeps the direction that yield chose; leaving an ordinary pause rolls
      // a fresh one. Re-rolling after a yield would send the figure back into whoever it just
      // stopped for, half the time.
      const dir: 1 | -1 = phase === 'walk'
        ? (e.hold ? e.dir : (rand() < 0.5 ? -1 : 1))
        : e.dir;
      const next = phase === 'walk'
        ? span(WALK_MIN, WALK_MAX, rand)
        : span(PAUSE_MIN, PAUSE_MAX, rand);
      out[id] = { ...e, phase, dir, t: 0, next, hold: false };
      continue;
    }

    if (e.phase === 'pause') { out[id] = { ...e, t }; continue; }

    let x = e.x + e.dir * speed * dt;
    let dir = e.dir;

    // Turn at the bounds rather than stopping: a figure pinned against an invisible wall
    // looks broken, one that turns looks like it changed its mind.
    if (x < margin) { x = margin; dir = 1; }
    else if (x > width - margin) { x = width - margin; dir = -1; }

    // Somebody in the way: stop, and turn away. Compared against each other figure's
    // already-committed position this frame where one exists, and its previous position
    // otherwise, so two figures walking at each other both yield together.
    //
    // The NEAREST blocker decides, not the first one found. Breaking on the first meant a
    // figure standing between two others got a different blocker on alternating frames and
    // flipped direction on every one of them -- and since a figure is drawn mirrored by its
    // direction, that renders as a stick figure vibrating in place. It also held position
    // while blocked, so it never escaped the encounter that was causing it.
    let blockerX: number | null = null;
    let blockerGap = Infinity;
    for (const other of ids) {
      if (other === id) continue;
      const ox = (out[other] ?? state[other]).x;
      const gap = Math.abs(x - ox);
      const closing = gap < Math.abs(e.x - ox);
      if (gap < minGap && closing && gap < blockerGap) { blockerX = ox; blockerGap = gap; }
    }

    if (blockerX !== null) {
      // Yield as a short PAUSE rather than an instant about-face. The pause is what makes it
      // read as noticing someone instead of glitching, and because a paused figure skips this
      // whole branch next frame, it also ends the oscillation outright.
      out[id] = {
        ...e,
        x: e.x,
        dir: e.x < blockerX ? -1 : 1,
        phase: 'pause',
        t: 0,
        next: span(YIELD_MIN, YIELD_MAX, rand),
        hold: true,
      };
      continue;
    }

    out[id] = { ...e, x, dir, t };
  }

  return out;
}

/** Which rig animation a wanderer plays in its current phase. */
export function wanderAnim(e: Wanderer): string {
  return e.phase === 'walk' ? 'stroll' : 'standstill';
}
