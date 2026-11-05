// Copied verbatim from Civic-Trivia-Championships frontend/src/components/bobbits/greetReducer.ts.
// Do not edit here: re-sync by overwriting this file from the source and keeping these header
// lines. @ts-nocheck: this repo enables noUncheckedIndexedAccess and the source does not; the
// file is not ours to restyle, and its exported types still check every caller.
// @ts-nocheck

/**
 * Hover greet, ported from ev-figures.js.
 *
 * A hovered figure freezes its own animation clock and plays greet/greetseat -- attention,
 * head-cock, wave -- then lingers after the cursor leaves before going back about its day.
 * The linger is what keeps the gesture from flickering when the cursor skims past.
 */

/** Seconds a figure keeps greeting after the cursor leaves. */
export const GREET_LINGER = 1.6;

export type GreetState = Record<string, { clock: number; linger: number }>;

/**
 * `dt` advances every greeting figure's clock, hovered or not -- the wave should finish its
 * arc rather than freeze mid-gesture when the cursor moves away. Only `linger` distinguishes
 * the two: pinned full while hovered, draining once not.
 */
export function greetReduce(state: GreetState, hoveredId: string | null, dt: number): GreetState {
  const next: GreetState = {};

  for (const id of Object.keys(state)) {
    if (id === hoveredId) continue; // written below, so the hovered figure is written once
    const entry = state[id];
    const linger = entry.linger - dt;
    if (linger > 0) next[id] = { clock: entry.clock + dt, linger };
    // else: dropped -- he resumes his normal animation from his own clock
  }

  if (hoveredId) {
    const prev = state[hoveredId];
    next[hoveredId] = { clock: (prev ? prev.clock : 0) + dt, linger: GREET_LINGER };
  }

  return next;
}

export function isGreeting(state: GreetState, id: string): boolean {
  return state[id] !== undefined;
}

export function greetClock(state: GreetState, id: string): number {
  return state[id] ? state[id].clock : 0;
}

/**
 * Everyone currently greeting, hovered or lingering. Handed to a field's `figuresFor` so a
 * choreography that owns positions (the wander) can hold a greeting figure still.
 */
export function greetingIds(state: GreetState): ReadonlySet<string> {
  return new Set(Object.keys(state));
}
