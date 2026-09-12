#!/usr/bin/env node
/**
 * Generates src/lib/cityBanners.generated.ts — geoid → { url, credit } for every city and
 * county banner in the org's shared library that we are ALLOWED to display.
 *
 * 🔴 WHY GENERATED, AND WHY KEYED BY GEOID.
 * Essentials keys city banners by city NAME and matches by substring. Civic Spaces only
 * ever holds a Census geoid — it never geocodes and never stores an address. The join is
 * done HERE, once, at commit time: Essentials' own browse_label appears on both sides
 * (coverage.json's `label`, and the CURATED_LOCAL key), so the match is exact and the
 * geoid comes from Essentials' own catalog. At runtime it is a map lookup — no name
 * matching, no network, no guessing.
 *
 * 🔴 IT REFUSES RATHER THAN GUESSES.
 * The registry's convention is `title | author | license`, and it is not always followed:
 * Treasury Tracker found two Georgia lines with the LICENCE sitting in the author slot,
 * which a positional reader publishes as the photographer's name
 * (ESSENTIALS-TEAM-NOTE-registry-attribution-gaps, 2026-09-10). So every credit is
 * validated — field 3 must look like a licence and field 2 must not. Anything failing
 * that, and anything with no credit line at all, is OMITTED and reported. Under-covering
 * costs a banner; mis-crediting breaches a CC BY licence.
 *
 *   node scripts/generate-city-banners.mjs [--registry <path to buildingImages.js>]
 *
 * Re-run when Essentials adds banners. A stale table under-covers (those slices fall
 * through to the Wikipedia path) but can never mis-serve: Essentials does not repurpose a
 * slug for a different place.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const REGISTRY = arg('--registry', 'C:/Transparent Motivations/essentials/src/lib/buildingImages.js')
const COVERAGE = 'https://essentials.empowered.vote/coverage.json'
const OUT = 'src/lib/cityBanners.generated.ts'

const LICENCE = /^(CC BY(-SA)? ?[0-9.]+( US)?(\s*\/\s*GFDL)?|CC0(\s*\/\s*Public Domain)?|Public Domain)$/i

/**
 * A licence field often carries a trailing production note the operator added —
 * "CC BY-SA 2.5 (anchor .85)", "CC BY-SA 3.0 (levelled -1.0 deg)", "[brightened]".
 * Those annotate the crop, not the licence, so strip both bracket styles before testing.
 * Not stripping them made this refuse nine perfectly good credits.
 */
const stripNotes = (s) => String(s).replace(/\s*[[(].*?[\])]\s*/g, ' ').trim()

/**
 * The licence is the LEADING token of its field; operators append prose after it
 * ("CC BY-SA 3.0. Full-width 4510x1433 window of the ..."). So match a prefix and keep
 * only that, rather than demanding the whole field be a bare licence — which dropped
 * every banner whose line carried a crop note.
 */
const LICENCE_PREFIX = /^(CC BY(-SA)?\s?[0-9]+(?:\.[0-9]+)*(\s*US)?(\s*\/\s*GFDL)?|CC0|Public Domain)/i
const licenceOf = (s) => {
  const m = LICENCE_PREFIX.exec(stripNotes(s))
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}
const looksLikeLicence = (s) => licenceOf(s) !== null
const slug = (s) => String(s).toLowerCase().trim().replace(/\./g, '').replace(/\s+/g, '-')

const src = readFileSync(REGISTRY, 'utf8')

/* 1. Credits, from the `//   <key> - <title> | <author> | <licence>` comment blocks.
 *
 * 🔴 A CREDIT CAN WRAP ONTO THE NEXT COMMENT LINE, and several do (Bend, Macon). Read
 * line-by-line they split into two fields and look malformed, so the place silently
 * loses its banner. Lines are therefore folded into one logical record first: a line
 * that opens a new `<key> - ` record starts one, anything else continues the current. */
const KEY_LINE = /^\/\/\s+([a-z0-9][a-z0-9 .'-]*?)\s+-\s+(.+)$/
const records = []
for (const raw of src.split(/\r?\n/)) {
  const line = raw.trim()
  if (!line.startsWith('//')) {
    records.length && (records[records.length - 1].closed = true)
    continue
  }
  const m = KEY_LINE.exec(line)
  if (m) {
    records.push({ key: m[1], text: m[2], closed: false })
    continue
  }
  const open = records[records.length - 1]
  /*
   * Fold a continuation only while the record still lacks its three fields AND the line
   * actually carries a `|`. The registry wraps in more than one shape —
   *   bend:    `//        | CC BY-SA 3.0 ...`
   *   midvale: `//        (File:Midvale CIty Old Town sign.JPG) | An Errant Knight | CC BY-SA 4.0`
   * — so keying on "starts with a pipe" missed all nineteen Utah credits. Keying on
   * "contains a pipe" catches both, while the field-count guard stops the fold running on
   * into the prose paragraphs that follow: an earlier version swallowed whole essays into
   * the licence field. Prose almost never contains a pipe, and if a record still ends up
   * short it is refused rather than guessed, which is the safe direction.
   */
  if (open && !open.closed && open.text.split('|').length < 3 && line.includes('|')) {
    open.text += ' ' + line.replace(/^\/\/\s*/, '')
  }
}

const credits = new Map()
const rejected = []
for (const rec of records) {
  const parts = rec.text.split('|').map((x) => x.trim())
  if (parts.length < 3) continue
  const author = parts[1]
  const licence = parts[2]
  if (!looksLikeLicence(licence) || looksLikeLicence(author)) {
    rejected.push(rec.key + ' -> author=[' + author + '] licence=[' + licence + ']')
    continue
  }
  const mods = /\[brightened\]/i.test(rec.text) ? ['brightened'] : []
  const clean = licenceOf(licence)
  const norm = /^public domain$/i.test(clean) ? 'public domain' : clean
  const text = [author, norm].concat(mods).concat(['via Wikimedia Commons']).join(', ')
  const key = slug(rec.key)
  if (!credits.has(key)) credits.set(key, text)
}

/* 2. Banner assets, from CURATED_LOCAL (name-keyed) and CURATED_COUNTY (geoid-keyed). */
const localBody = src.slice(src.indexOf('const CURATED_LOCAL = {'), src.indexOf('\nconst CURATED_COUNTY'))
const byName = new Map()
const keyRe = /^ {2}(?:'([^']+)'|([a-z0-9-]+)):\s*(\[|\{)/gm

/**
 * 🔴 EACH ENTRY IS BOUNDED BY THE NEXT ENTRY, not by a fixed character window.
 * A fixed window overruns into the following entries, and since a later match for the
 * same "name|STATE" key overwrites an earlier one, entries silently inherited a
 * neighbour's image. That is how Long Beach, Glendale and Downey were reported as
 * sitting on the retired la_county path when they had been migrated off it in July.
 */
const starts = []
let m
while ((m = keyRe.exec(localBody))) starts.push({ name: m[1] || m[2], index: m.index })
for (let i = 0; i < starts.length; i++) {
  const { name, index } = starts[i]
  const entry = localBody.slice(index, i + 1 < starts.length ? starts[i + 1].index : localBody.length)
  for (const v of entry.matchAll(/state:\s*'([A-Z]{2})'[^}]*?src:\s*'([^']+)'/g)) {
    byName.set(name.toLowerCase().trim() + '|' + v[1], v[2])
  }
}

const countyBody = src.slice(src.indexOf('const CURATED_COUNTY = {'))
const byGeoid = new Map()
for (const c of countyBody.matchAll(/'(\d{5})':\s*\{\s*state:\s*'([A-Z]{2})',\s*src:\s*'([^']+)'/g)) {
  byGeoid.set(c[1], c[3])
}

/*
 * 3. Find the credit for an asset.
 *
 * 🔴 THE FILENAME IS THE ASSET'S IDENTITY, NOT THE PLACE NAME. Where a city name recurs
 * across states, Essentials disambiguates in the FILE (cities/portland.jpg is Oregon's
 * Japanese Garden; cities/portland-me.jpg is Maine's skyline) while both entries are
 * keyed 'portland'. Looking the credit up by place name therefore hands one city's
 * photographer to the other's photograph. It did exactly that — Portland, ME was
 * published as Daderot/CC0, which is Oregon's credit — and Maine's asset has no credit
 * line of its own at all, so the correct outcome is to refuse it.
 *
 * So: match on the filename, and only fall back to the place name when the filename IS
 * the place name (no disambiguation, so no ambiguity to get wrong).
 */
function creditFor(name, url) {
  const file = url.split('/').pop().replace(/\.jpg$/i, '')
  const base = file.replace(/-v\d+$/, '')
  for (const k of [file, base]) if (credits.has(k)) return credits.get(k)
  const named = slug(name)
  if ((named === file || named === base) && credits.has(named)) return credits.get(named)
  return null
}

/* 4. Join to geoids through Essentials' own published catalog. */
const cov = await (await fetch(COVERAGE)).json()
const out = new Map()
const skipped = { noBanner: [], noCredit: [], legacy: [] }

function consider(record, url, name) {
  if (!url) return 'noBanner'
  // Four LA-county assets still sit on the legacy path and carry no credit line at all.
  if (url.includes('la_county/building_photos')) return 'legacy'
  const credit = creditFor(name, url)
  if (!credit) return 'noCredit'
  for (const g of record.geoids || []) {
    out.set(g, { url, credit, label: record.label, state: record.state })
  }
  return 'ok'
}

for (const c of cov.cities || []) {
  const r = consider(c, byName.get((c.label || '').toLowerCase().trim() + '|' + c.state), c.label)
  if (r !== 'ok') skipped[r].push(c.label + ', ' + c.state)
}

for (const c of cov.counties || []) {
  let url = null
  for (const g of c.geoids || []) if (byGeoid.has(g)) url = byGeoid.get(g)
  if (!url) url = byName.get((c.label || '').toLowerCase().trim() + '|' + c.state)
  const r = consider(c, url, c.label)
  if (r !== 'ok') skipped[r].push(c.label + ', ' + c.state)
}

/* 5. Emit. */
const rows = [...out.entries()].sort((a, b) => a[0].localeCompare(b[0]))
const body = rows
  .map(
    ([geoid, v]) =>
      "  '" + geoid + "': { url: '" + v.url + "', credit: " + JSON.stringify(v.credit) + ' }, // ' + v.label + ', ' + v.state
  )
  .join('\n')

const header = [
  '/**',
  ' * GENERATED FILE — DO NOT EDIT BY HAND.',
  ' *   node scripts/generate-city-banners.mjs',
  ' *',
  " * City and county banners from the org's shared library, keyed by Census geoid.",
  ' * Generated ' + new Date().toISOString().slice(0, 10) + " from Essentials' registry",
  ' * (src/lib/buildingImages.js) joined to its published catalog (coverage.json).',
  ' *',
  ' * 🔴 Entries whose author could not be established are DELIBERATELY ABSENT. Attribution',
  ' * is a condition of the CC BY / CC BY-SA licences these are published under, so a',
  ' * banner we cannot credit is a banner we cannot show. The generator says what it',
  ' * refuses and why — if a place you expect is missing, look there before adding it here.',
  ' *',
  ' * Stale is safe. Essentials never repurposes a slug for a different place, so an',
  ' * out-of-date table under-covers (those slices fall through to the Wikipedia path) and',
  ' * can never point at the wrong city.',
  ' */',
  "import type { Banner } from './banners'",
  '',
  'export const CITY_BANNERS: Record<string, Banner> = {',
].join('\n')

writeFileSync(OUT, header + '\n' + body + '\n}\n')

console.log('wrote ' + OUT + ': ' + rows.length + ' geoids')
console.log(
  'skipped — no banner: ' + skipped.noBanner.length +
    ', no credit: ' + skipped.noCredit.length +
    ', legacy path: ' + skipped.legacy.length
)
if (skipped.noCredit.length) console.log('  NO CREDIT: ' + skipped.noCredit.join('; '))
if (skipped.legacy.length) console.log('  LEGACY: ' + skipped.legacy.join('; '))
if (rejected.length) console.log('  malformed credit lines refused: ' + rejected.length)
for (const r of rejected) console.log('     ' + r)
