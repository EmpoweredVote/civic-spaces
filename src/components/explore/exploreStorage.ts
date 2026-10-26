import { useCallback, useEffect, useState } from 'react'
import type { AdventureDuration, ImagineOption, TopicId } from './exploreContent'

/**
 * Explore's state lives in this browser's localStorage — the only persistence available
 * to it without a migration. That is deliberate and it is visible: anything saved here
 * says "Saved on this device", never anything that implies an account.
 *
 * It also has to survive signing in. The accounts hub redirects to a fixed origin and
 * the page reloads, so React state does not make the trip; localStorage does (the same
 * reason cs_pending_post exists in AppShell).
 *
 * Every access is wrapped: private windows and blocked site data throw, and Explore must
 * still work then — it just forgets on reload.
 */

/**
 * One per (sliceType, geoid, topicId) — see draftKey() in lib/exploreComposition.ts.
 *
 * sliceId, tab and communityName are GONE. They existed to pin a draft to one
 * community, which the key now does better: a member holds at most one slice per
 * type (useAllSlices returns Partial<Record<SliceType, SliceInfo>>), so the
 * destination is derived at post time by canPostDraft(), which also refuses a
 * draft whose geoid no longer matches. That retires the `movedFrom` machinery in
 * ExploreView — a draft for a place the member has left no longer needs a rescue
 * path, because its key matches no slice they hold and it is simply never offered.
 */
export interface ExploreDraft {
  title: string
  body: string
  updatedAt: number
}

export type DraftMap = Record<string, ExploreDraft>

/**
 * "Post this after sign-in", set when a signed-out visitor presses Join.
 *
 * It carries the full draft key, not a topic id: a generic topic can now appear
 * on two tabs, and a bare id cannot say which one they meant.
 *
 * geoid is null for a signed-out visitor — they have no slice yet. The sign-in
 * re-key moves null-geoid drafts onto the member's own slice, so by the time this
 * marker is consumed the draft is already where it belongs.
 */
export interface ExploreResume {
  sliceType: string
  geoid: string | null
  topicId: string
  at: number
}

/**
 * Which topic is open, and WHICH COMPOSITION it was opened in.
 *
 * 🔴 The key half is the whole point (research Pitfall 1). `cs_explore_ui` is one
 * global record, so a bare topic id renders on whatever tab is showing next —
 * a city topic on the State tab, with a Join button pointing at another
 * jurisdiction. The key is compositionKey(sliceType, geoid); ExploreView drops
 * the open topic when it does not match the composition it is rendering.
 */
export interface OpenTopicRef {
  key: string
  topicId: TopicId
}

export interface ExploreUiState {
  openTopic: OpenTopicRef | null
  imagine: ImagineOption | null
  adventure: AdventureDuration | null
}

/**
 * 🔴 The drafts and resume keys are VERSIONED, and the new names are not cosmetic.
 * `read()` below is an unchecked `JSON.parse(...) as T`: reusing `cs_explore_resume`
 * would make readResume() return the old BARE STRING where an object is now
 * expected, and it would not throw — it would be silently mis-typed and then used
 * as a key. Same for a draft carrying the retired sliceId/tab/communityName fields.
 *
 * `cs_explore_ui` keeps its name (openTopic is shape-guarded below, and `imagine` /
 * `adventure` are still valid). `cs_saved_adventures` keeps its name — a device
 * bookmark, unaffected by any of this.
 */
const DRAFTS_KEY = 'cs_explore_drafts_v2'
/** "Post this after sign-in" — set only when a signed-out visitor asked to post. */
const RESUME_KEY = 'cs_explore_resume_v2'
const UI_KEY = 'cs_explore_ui'
/** Adventure suggestions a visitor saved — this device only, and the UI says so. */
const SAVED_ADVENTURES_KEY = 'cs_saved_adventures'
/** Same-tab change notification; the native `storage` event only fires in other tabs. */
const CHANGE_EVENT = 'cs-explore-storage'

/**
 * The pre-re-key names, deleted once on first load and never read again.
 *
 * In-flight drafts are dropped rather than migrated: Explore shipped 2026-10-22,
 * the drafts are local to one browser, and a migration for a two-day-old key
 * costs more than it saves. Leaving the values in place would be worse than
 * either — `cs_explore_resume` holds a BARE STRING, and a future reader that
 * reached for it would get a silently mis-typed value rather than a throw.
 */
const LEGACY_KEYS = ['cs_explore_drafts', 'cs_explore_resume']

try {
  for (const key of LEGACY_KEYS) localStorage.removeItem(key)
} catch {
  // Private window or blocked site data: there is nothing stored to clean up.
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): boolean {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }))
    return true
  } catch {
    return false
  }
}

// ── Drafts, keyed by (sliceType, geoid, topicId) ────────────────────────────

export function readDrafts(): DraftMap {
  return read<DraftMap>(DRAFTS_KEY) ?? {}
}

/** `key` is draftKey(sliceType, geoid, topicId) — never a bare topic id. */
export function writeDraft(key: string, draft: ExploreDraft | null): void {
  const drafts = readDrafts()
  if (draft) drafts[key] = draft
  else delete drafts[key]
  write(DRAFTS_KEY, drafts)
}

/** Replaces the whole map — the sign-in re-key moves several keys at once. */
export function writeDrafts(drafts: DraftMap): void {
  write(DRAFTS_KEY, drafts)
}

/**
 * Coerced rather than cast, for the same reason asOpenTopic is: a hand-edited or
 * half-written value must read as "no marker", not as an object whose fields are
 * undefined and are then used to build a key.
 */
function asResume(value: unknown): ExploreResume | null {
  if (typeof value !== 'object' || value === null) return null
  const { sliceType, geoid, topicId, at } = value as {
    sliceType?: unknown
    geoid?: unknown
    topicId?: unknown
    at?: unknown
  }
  if (typeof sliceType !== 'string' || !sliceType) return null
  if (typeof topicId !== 'string' || !topicId) return null
  if (geoid !== null && typeof geoid !== 'string') return null
  if (typeof at !== 'number') return null
  return { sliceType, geoid, topicId, at }
}

export function readResume(): ExploreResume | null {
  return asResume(read<unknown>(RESUME_KEY))
}

export function writeResume(resume: ExploreResume | null): void {
  write(RESUME_KEY, resume)
}

/** All drafts, kept in sync with writes from anywhere in the page (AppShell clears one after posting). */
export function useExploreDrafts(): DraftMap {
  const [drafts, setDrafts] = useState<DraftMap>(readDrafts)
  useEffect(() => {
    const sync = (e: Event) => {
      const key = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail
      if (key === DRAFTS_KEY || key === null) setDrafts(readDrafts())
    }
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return drafts
}

// ── UI state and saved adventures — unchanged ───────────────────────────────

/**
 * 🔴 `read()` is an unchecked `JSON.parse(...) as T`, so a value written before
 * openTopic was scoped holds the BARE STRING 'safer-walking'. That does not
 * throw — it is silently mis-typed and then read as an object, and
 * `openTopic.key` on a string is undefined rather than an error. Coerce
 * anything that is not `{key: string, topicId: string}` to null.
 */
function asOpenTopic(value: unknown): OpenTopicRef | null {
  if (typeof value !== 'object' || value === null) return null
  const { key, topicId } = value as { key?: unknown; topicId?: unknown }
  if (typeof key !== 'string' || typeof topicId !== 'string' || !topicId) return null
  return { key, topicId }
}

export function readUiState(): ExploreUiState {
  const raw = read<{
    openTopic?: unknown
    imagine?: ImagineOption | null
    adventure?: AdventureDuration | null
  }>(UI_KEY)
  return {
    openTopic: asOpenTopic(raw?.openTopic),
    imagine: raw?.imagine ?? null,
    adventure: raw?.adventure ?? null,
  }
}

export function writeUiState(state: ExploreUiState): void {
  write(UI_KEY, state)
}

export function readSavedAdventures(): AdventureDuration[] {
  return read<AdventureDuration[]>(SAVED_ADVENTURES_KEY) ?? []
}

/** false when storage is unavailable — the caller must not claim it saved. */
export function writeSavedAdventures(list: AdventureDuration[]): boolean {
  return write(SAVED_ADVENTURES_KEY, list)
}

/** Explore's UI selections, persisted so they survive a tab switch, a reload and sign-in. */
export function useExploreUiState(): [ExploreUiState, (patch: Partial<ExploreUiState>) => void] {
  const [state, setState] = useState<ExploreUiState>(readUiState)
  const update = useCallback((patch: Partial<ExploreUiState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      writeUiState(next)
      return next
    })
  }, [])
  return [state, update]
}
