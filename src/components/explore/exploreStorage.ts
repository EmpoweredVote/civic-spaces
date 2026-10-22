import { useCallback, useEffect, useState } from 'react'
import type { TabKey } from '../../types/database'
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

/** One per topic. Bound to a community the first time it is saved while signed in. */
export interface ExploreDraft {
  title: string
  body: string
  /**
   * The member's own slice this draft will post to. null for a draft written signed out:
   * it is bound to the member's most local community after sign-in, and the composer
   * names that community before anything is posted.
   */
  sliceId: string | null
  tab: TabKey | null
  communityName: string | null
  updatedAt: number
}

export interface ExploreUiState {
  openTopic: TopicId | null
  imagine: ImagineOption | null
  adventure: AdventureDuration | null
}

const DRAFTS_KEY = 'cs_explore_drafts'
const UI_KEY = 'cs_explore_ui'
/** "Post this after sign-in" — set only when a signed-out visitor asked to post. */
const RESUME_KEY = 'cs_explore_resume'
/** Adventure suggestions a visitor saved — this device only, and the UI says so. */
const SAVED_ADVENTURES_KEY = 'cs_saved_adventures'
/** Same-tab change notification; the native `storage` event only fires in other tabs. */
const CHANGE_EVENT = 'cs-explore-storage'

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

export type DraftMap = Partial<Record<TopicId, ExploreDraft>>

export function readDrafts(): DraftMap {
  return read<DraftMap>(DRAFTS_KEY) ?? {}
}

export function writeDraft(topicId: TopicId, draft: ExploreDraft | null): void {
  const drafts = readDrafts()
  if (draft) drafts[topicId] = draft
  else delete drafts[topicId]
  write(DRAFTS_KEY, drafts)
}

export function readUiState(): ExploreUiState {
  return read<ExploreUiState>(UI_KEY) ?? { openTopic: null, imagine: null, adventure: null }
}

export function writeUiState(state: ExploreUiState): void {
  write(UI_KEY, state)
}

export function readResume(): TopicId | null {
  return read<TopicId>(RESUME_KEY)
}

export function writeResume(topicId: TopicId | null): void {
  write(RESUME_KEY, topicId)
}

export function readSavedAdventures(): AdventureDuration[] {
  return read<AdventureDuration[]>(SAVED_ADVENTURES_KEY) ?? []
}

/** false when storage is unavailable — the caller must not claim it saved. */
export function writeSavedAdventures(list: AdventureDuration[]): boolean {
  return write(SAVED_ADVENTURES_KEY, list)
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
