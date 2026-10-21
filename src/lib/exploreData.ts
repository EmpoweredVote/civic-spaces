import {
  adventureSuggestionsResponse,
  exploreTopicsResponse,
  productUpdatesResponse,
} from '../mocks/civicSpacesExplore'

/**
 * Explore's editorial content. No API serves it yet, so each getter returns the response-
 * shaped sample from src/mocks/civicSpacesExplore.ts. When a route exists, fetch it here
 * (through EV_API_ORIGIN in src/lib/evApi.ts) and nothing else has to change.
 */
export function getExploreTopics() {
  return exploreTopicsResponse
}

export function getAdventureSuggestions() {
  return adventureSuggestionsResponse
}

export function getProductUpdates() {
  return productUpdatesResponse
}
