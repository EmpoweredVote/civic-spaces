import { useQuery } from '@tanstack/react-query'
import { ESSENTIALS_URL, type CoverageCatalog } from '../lib/toolCoverage'

const COVERAGE_URL = `${ESSENTIALS_URL}/coverage.json`

/**
 * Essentials' public coverage catalog. ~29 KB, regenerated on their deploys —
 * hence the long staleTime and no auth header (it is public data).
 *
 * Throws on failure so React Query records the error state; callers treat an
 * absent catalog as "no deep links available", which degrades the Tools widget
 * to the Compass row alone rather than erroring.
 */
async function fetchCoverage(): Promise<CoverageCatalog> {
  const res = await fetch(COVERAGE_URL)
  if (!res.ok) throw new Error(`Failed to fetch tool coverage: ${res.status}`)
  return res.json()
}

export function useToolCoverage() {
  return useQuery({
    queryKey: ['toolCoverage'],
    queryFn: fetchCoverage,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}
