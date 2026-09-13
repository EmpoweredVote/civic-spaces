#!/usr/bin/env node
/**
 * Generates src/lib/banners.generated.ts — every shared-library banner we display, with
 * its attribution, keyed the way Civic Spaces can actually look it up.
 *
 * 🔴 CREDITS COME FROM Essentials' /banners.json. NEVER PARSE THE REGISTRY COMMENTS.
 * An earlier version of this script read the `title | author | license` prose block in
 * buildingImages.js. It was wrong four times in ways that looked fine — most sharply, it
 * published Portland, ME under Portland, OR's photographer, because both entries are
 * keyed `portland` in that file and only the FILENAME separates them. Essentials now
 * publishes the same data as JSON, keyed by bucket path, CI-guarded against going stale
 * (docs/shared-banner-assets.md §5). Join on `path`. Never on a name.
 *
 * 🔴 `license_note` IS NOT PART OF THE CREDIT. Fields like "(anchor .85)" or
 * "[brightened]" describe Essentials' crop, not the licensor's terms, and are split out
 * deliberately. Display `author` and `license` verbatim and nothing else. (Our first
 * hand-built table appended "brightened" to four state credits. That was ours to stop.)
 *
 * The geoid join still needs the registry, but only its STRUCTURED parts — the
 * CURATED_LOCAL / CURATED_COUNTY object literals, which are code, not prose. Essentials'
 * own browse_label appears both there and in coverage.json, so place -> geoid is exact.
 *
 *   node scripts/generate-banners.mjs [--registry <buildingImages.js>] [--banners <url|path>]
 *
 * Stale is safe: Essentials never repurposes a slug, so an out-of-date table under-covers
 * (those slices fall through to the Wikipedia path) and can never name the wrong place.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const REGISTRY = arg('--registry', 'C:/Transparent Motivations/essentials/src/lib/buildingImages.js')
const BANNERS = arg('--banners', 'https://essentials.empowered.vote/banners.json')
const COVERAGE = arg('--coverage', 'https://essentials.empowered.vote/coverage.json')
const OUT = 'src/lib/banners.generated.ts'

async function loadJson(where, label) {
  if (!/^https?:/.test(where)) return JSON.parse(readFileSync(where, 'utf8'))
  const res = await fetch(where)
  const text = await res.text()
  if (!res.ok || text.trimStart().startsWith('<')) {
    // A SPA origin answers an unknown path with index.html, not a 404 — so a missing
    // export arrives as HTML with status 200. Say so plainly instead of dying in a parser.
    throw new Error(
      `${label} is not published yet at ${where} (got ${res.status} ${text.trimStart().slice(0, 14)}…). ` +
        `Pass --${label} with a local path, e.g. <essentials>/public/${label}.json`
    )
  }
  return JSON.parse(text)
}

const banners = await loadJson(BANNERS, 'banners')
const cov = await loadJson(COVERAGE, 'coverage')

if (banners.unmatched_credits?.length) {
  // Essentials asks to hear about this: a credit that matches no shipping asset is their
  // bug, and it means some asset may be quietly uncredited.
  console.warn(`⚠ banners.json reports ${banners.unmatched_credits.length} unmatched_credits — tell the Essentials team.`)
}

const BASE = (banners.bucket_base || '').replace(/\/$/, '')
const byPath = new Map(banners.assets.map((a) => [a.path, a]))
const uncredited = new Set((banners.uncredited || []).map((u) => u.path))

const creditOf = (a) => `${a.author}, ${a.license}, via Wikimedia Commons`
const urlOf = (p) => `${BASE}/${p}`

/* ---- place -> asset path, from the registry's structured tables ---- */
const src = readFileSync(REGISTRY, 'utf8')
const localBody = src.slice(src.indexOf('const CURATED_LOCAL = {'), src.indexOf('\nconst CURATED_COUNTY'))

// Each entry is bounded by the NEXT entry. A fixed-width window overruns into following
// entries and, because a later match overwrites an earlier one, silently gives a place
// its neighbour's image.
const byName = new Map()
const keyRe = /^ {2}(?:'([^']+)'|([a-z0-9-]+)):\s*(\[|\{)/gm
const starts = []
let m
while ((m = keyRe.exec(localBody))) starts.push({ name: m[1] || m[2], index: m.index })
for (let i = 0; i < starts.length; i++) {
  const entry = localBody.slice(starts[i].index, i + 1 < starts.length ? starts[i + 1].index : localBody.length)
  for (const v of entry.matchAll(/state:\s*'([A-Z]{2})'[^}]*?src:\s*'([^']+)'/g)) {
    byName.set(starts[i].name.toLowerCase().trim() + '|' + v[1], v[2])
  }
}

const countyBody = src.slice(src.indexOf('const CURATED_COUNTY = {'))
const countyByGeoid = new Map()
for (const c of countyBody.matchAll(/'(\d{5})':\s*\{\s*state:\s*'([A-Z]{2})',\s*src:\s*'([^']+)'/g)) {
  countyByGeoid.set(c[1], c[3])
}

/* ---- build the tables ---- */
const places = new Map()
const skipped = { noBanner: [], uncredited: [], unknown: [] }

function add(geoids, url, label) {
  if (!url) return 'noBanner'
  const path = url.replace(BASE + '/', '')
  if (uncredited.has(path)) return 'uncredited'
  const asset = byPath.get(path)
  if (!asset) return 'unknown'
  for (const g of geoids) places.set(g, { url: urlOf(path), credit: creditOf(asset), label })
  return 'ok'
}

for (const c of cov.cities || []) {
  const r = add(c.geoids || [], byName.get((c.label || '').toLowerCase().trim() + '|' + c.state), `${c.label}, ${c.state}`)
  if (r !== 'ok') skipped[r].push(`${c.label}, ${c.state}`)
}

for (const c of cov.counties || []) {
  let url = null
  for (const g of c.geoids || []) if (countyByGeoid.has(g)) url = countyByGeoid.get(g)
  if (!url) url = byName.get((c.label || '').toLowerCase().trim() + '|' + c.state)
  const r = add(c.geoids || [], url, `${c.label}, ${c.state}`)
  if (r !== 'ok') skipped[r].push(`${c.label}, ${c.state}`)
}

// Counties Essentials curates but does NOT publish in coverage.json (Palm Beach is one),
// so they are reachable only through the registry's own geoid-keyed map.
for (const [geoid, url] of countyByGeoid) {
  if (!places.has(geoid)) add([geoid], url, `county ${geoid}`)
}

const states = {}
for (const a of banners.assets.filter((x) => x.kind === 'state' && x.state)) {
  states[a.state] = { url: urlOf(a.path), credit: creditOf(a) }
}

const federalAsset = banners.assets.find((a) => a.kind === 'federal')
if (!federalAsset) throw new Error('banners.json has no federal asset')

/* ---- emit ---- */
const q = (s) => JSON.stringify(s)
const lines = [
  '/**',
  ' * GENERATED FILE — DO NOT EDIT BY HAND.',
  ' *   npm run gen:banners',
  ' *',
  " * Every shared-library banner Civic Spaces displays, with its attribution, generated",
  ` * ${new Date().toISOString().slice(0, 10)} from Essentials' /banners.json (credits, joined on`,
  " * bucket PATH) and /coverage.json (geoids, joined on Essentials' own browse_label).",
  ' *',
  ' * 🔴 Attribution is a licence condition. Assets Essentials publishes with no author are',
  ' * absent by design — a banner we cannot credit is a banner we cannot show. The',
  ' * generator reports exactly which, and why, on every run.',
  ' */',
  "import type { Banner } from './banners'",
  '',
  `export const FEDERAL_BANNER: Banner = { url: ${q(urlOf(federalAsset.path))}, credit: ${q(creditOf(federalAsset))} }`,
  '',
  '/** All 50 states. Paths are whatever Essentials designates canonical, including -vN.',
  '  * DC is absent: there is no DC banner, so a DC slice falls through to Wikipedia. */',
  'export const STATE_BANNERS: Record<string, Banner> = {',
  ...Object.keys(states)
    .sort()
    .map((ab) => `  ${ab}: { url: ${q(states[ab].url)}, credit: ${q(states[ab].credit)} },`),
  '}',
  '',
  '/** Cities and counties, keyed by Census FIPS geoid — exactly what slices.geoid holds. */',
  'export const PLACE_BANNERS: Record<string, Banner> = {',
  ...[...places.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([g, v]) => `  '${g}': { url: ${q(v.url)}, credit: ${q(v.credit)} }, // ${v.label}`),
  '}',
  '',
]
writeFileSync(OUT, lines.join('\n'))

console.log(`wrote ${OUT}`)
console.log(`  federal: 1   states: ${Object.keys(states).length}   places: ${places.size} geoids`)
console.log(
  `  skipped — no banner: ${skipped.noBanner.length}, uncredited by Essentials: ${skipped.uncredited.length}` +
    `, not in banners.json: ${skipped.unknown.length}`
)
if (skipped.uncredited.length) console.log('    UNCREDITED: ' + skipped.uncredited.join('; '))
if (skipped.unknown.length) console.log('    NOT IN banners.json: ' + skipped.unknown.join('; '))
