// Generates the offline geoid -> place-name table the hero banner titles read.
//
//   node scripts/generate-geo-names.mjs          # regenerate public/geo/
//   node scripts/generate-geo-names.mjs --check  # fail if the committed files drift
//
// WHY THIS EXISTS
// ---------------
// `useJurisdictionName` used to call api.census.gov at runtime. As of 2026-09-24
// that endpoint answers every keyless request with `302 -> missing_key.html`, so
// the lookup failed silently and every city and county slice rendered the literal
// fallback "City" / "County" in production. The failure was invisible because the
// hook falls back to the tab label by design.
//
// Census place names are static reference data, so they do not belong behind a
// runtime API call at all. This pulls them once from the Census *gazetteer* —
// plain files on www2.census.gov that need no API key and are not rate limited —
// and shards them by state, because a member's city and county always share the
// state FIPS that prefixes their geoid.
//
// Only two geoid shapes ever reach a lookup (verified against production):
//   7-digit place FIPS  -> "3702140" -> Asheville
//   5-digit county FIPS -> "37021"   -> Buncombe County
// federal / state / unified / volunteer resolve synchronously in geoidToWiki.ts
// and never come through here.

import { createHash } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'geo')

const GAZETTEER = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer'
const SOURCES = [
  { kind: 'place', file: '2024_Gaz_place_national.zip', geoidLength: 7 },
  { kind: 'county', file: '2024_Gaz_counties_national.zip', geoidLength: 5 },
  { kind: 'state', file: '2024_Gaz_state_national.zip', geoidLength: 2 },
]

// 2020 Decennial PL 94-171. P1_001N is total resident population.
//
// Unlike the gazetteer this DOES need a key, because api.census.gov started
// answering keyless requests with a 302 — the very failure this script exists
// to route around. That is fine here: the key is read from the environment at
// build time and the numbers are committed, so nothing about it reaches the
// browser. It is deliberately CENSUS_API_KEY and not VITE_CENSUS_API_KEY,
// since Vite bundles every VITE_-prefixed variable into the client.
//
// Get one free at https://api.census.gov/data/key_signup.html and put it in
// .env.local, which is gitignored. Without a key the script still runs and
// simply omits population — a fresh clone is never broken by a missing key.
const CENSUS_PL = 'https://api.census.gov/data/2020/dec/pl'

// ---------------------------------------------------------------------------
// Minimal zip reader
// ---------------------------------------------------------------------------

// The gazetteer archives hold a single deflated .txt each. Node ships zlib but
// no zip reader, and this is the only place in the repo that needs one, so it
// reads the central directory rather than taking a dependency. The central
// directory is used, not the local header, because the local header's sizes may
// be zeroed in favour of a trailing data descriptor.
function unzipSingleFile(buf) {
  // End of central directory: signature, then a comment whose length lives in
  // the last 2 bytes of the 22-byte fixed part. Scan back for the signature.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip archive: no end-of-central-directory record')

  const cdOffset = buf.readUInt32LE(eocd + 16)
  if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error('corrupt central directory')

  const method = buf.readUInt16LE(cdOffset + 10)
  const compressedSize = buf.readUInt32LE(cdOffset + 20)
  const localOffset = buf.readUInt32LE(cdOffset + 42)

  if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('corrupt local file header')
  const localNameLen = buf.readUInt16LE(localOffset + 26)
  const localExtraLen = buf.readUInt16LE(localOffset + 28)
  const dataStart = localOffset + 30 + localNameLen + localExtraLen
  const data = buf.subarray(dataStart, dataStart + compressedSize)

  if (method === 0) return data
  if (method === 8) return inflateRawSync(data)
  throw new Error(`unsupported zip compression method ${method}`)
}

// ---------------------------------------------------------------------------
// Gazetteer parsing
// ---------------------------------------------------------------------------

// The gazetteer is tab separated, but several columns are right-padded with
// spaces (INTPTLONG most visibly), so every cell is trimmed.
function parseGazetteer(text) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0].split('\t').map((h) => h.trim())
  const col = (name) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`gazetteer is missing the ${name} column`)
    return i
  }
  const [gi, ni, la, lo] = [col('GEOID'), col('NAME'), col('INTPTLAT'), col('INTPTLONG')]

  return lines.slice(1).map((line) => {
    const c = line.split('\t')
    return {
      geoid: c[gi].trim(),
      name: c[ni].trim(),
      lat: Number(c[la].trim()),
      lon: Number(c[lo].trim()),
    }
  })
}

// Strips the Census entity suffix from a place name: "Asheville city" ->
// "Asheville". Mirrors what extractDisplayName did at runtime, moved to build
// time so the shipped table is already display-ready.
//
// County names deliberately keep their suffix — "Buncombe County" is clearer
// than "Buncombe", and the county slice's banner has always read that way.
const PLACE_SUFFIX =
  /\s+(city and borough|consolidated government|metropolitan government|metro government|unified government|city|town|township|borough|municipality|village|CDP|comunidad|zona urbana)$/i

// Consolidated city-county governments carry a "(balance)" qualifier AFTER the
// entity word — "Indianapolis city (balance)", "Louisville/Jefferson County
// metro government (balance)" — which defeats an end-anchored suffix match. It
// has to come off first or the largest city in Indiana renders as
// "Indianapolis city (balance)" on its own banner. Eight places nationwide.
//
// Every other parenthetical is a Census alternate name for a CDP, such as
// "San Buenaventura (Ventura)" or "Addison (Webster Springs)". Those are part
// of the name and are deliberately kept.
const BALANCE_QUALIFIER = /\s+\(balance\)$/i

function cleanPlaceName(name) {
  // Only ", {State}" style trailers appear in gazetteer NAMEs, but strip
  // defensively: the API form carried them and the two should agree.
  const base = (name.split(', ')[0] ?? name).replace(BALANCE_QUALIFIER, '')
  const stripped = base.replace(PLACE_SUFFIX, '').trim()
  // "Town of Purgatory" style names are entirely suffix once stripped; never
  // return an empty label.
  return stripped.length > 0 ? stripped : base
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

async function fetchSource({ kind, file, geoidLength }) {
  const url = `${GAZETTEER}/${file}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`${url} -> HTTP ${resp.status}`)
  const text = unzipSingleFile(Buffer.from(await resp.arrayBuffer())).toString('utf8')
  const rows = parseGazetteer(text)
  console.log(`  ${file}  ${rows.length.toLocaleString()} rows`)
  return { kind, rows, geoidLength }
}

// ---------------------------------------------------------------------------
// Population
// ---------------------------------------------------------------------------

async function censusRows(query, key) {
  const resp = await fetch(`${CENSUS_PL}?${query}&key=${encodeURIComponent(key)}`)
  if (!resp.ok) throw new Error(`census ${query} -> HTTP ${resp.status}`)
  const rows = await resp.json()
  // [["P1_001N","state","place"], ["94589","37","02140"], …] — the header row
  // names the geography columns, and a geoid is those columns concatenated in
  // the order given.
  const [header, ...body] = rows
  const valueIdx = header.indexOf('P1_001N')
  const geoIdx = header.map((h, i) => (h === 'P1_001N' ? -1 : i)).filter((i) => i >= 0)
  return body.map((row) => ({
    geoid: geoIdx.map((i) => row[i]).join(''),
    pop: Number(row[valueIdx]),
  }))
}

/**
 * geoid -> 2020 population, for every place, county and state, plus "US".
 *
 * Wildcards keep this to 53 requests for the whole country: counties and states
 * each come back nationwide in a single call, and only places have to be asked
 * for state by state.
 */
async function fetchPopulations(key, stateFipsList) {
  const pop = new Map()
  const add = (rows) => {
    for (const { geoid, pop: n } of rows) if (Number.isFinite(n) && n >= 0) pop.set(geoid, n)
  }

  add(await censusRows('get=P1_001N&for=county:*', key))
  add(await censusRows('get=P1_001N&for=state:*', key))

  const [us] = await censusRows('get=P1_001N&for=us:1', key)
  if (us) pop.set('US', us.pop)

  // Places are not available nationwide in one call; ask per state.
  let done = 0
  for (const stateFips of stateFipsList) {
    add(await censusRows(`get=P1_001N&for=place:*&in=state:${stateFips}`, key))
    done += 1
    if (done % 10 === 0) process.stdout.write(`  …${done}/${stateFipsList.length} states\n`)
  }

  console.log(`  ${pop.size.toLocaleString()} population figures`)
  return pop
}

function buildShards(sources, pop) {
  /** @type {Map<string, Record<string, { name: string, lat: number, lon: number, pop?: number }>>} */
  const byState = new Map()

  for (const { kind, rows, geoidLength } of sources) {
    for (const row of rows) {
      // Anything that is not the level's own geoid shape is a gazetteer row we
      // do not serve, and would only bloat the shard.
      if (row.geoid.length !== geoidLength) continue
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue

      const stateFips = row.geoid.slice(0, 2)
      if (!byState.has(stateFips)) byState.set(stateFips, {})
      const entry = {
        // Only places carry a Census entity suffix worth stripping. "Buncombe
        // County" and "North Carolina" are already what the banner should read.
        name: kind === 'place' ? cleanPlaceName(row.name) : row.name,
        lat: row.lat,
        lon: row.lon,
      }
      // Omitted rather than nulled when there is no key, so a keyless run
      // produces the same shape as today's committed files for every other field.
      const n = pop.get(row.geoid)
      if (n !== undefined) entry.pop = n
      byState.get(stateFips)[row.geoid] = entry
    }
  }

  const shards = new Map()
  for (const [stateFips, names] of [...byState].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Sorted keys keep the output byte-stable, so --check only fires on real
    // data changes rather than on object insertion order.
    const sorted = Object.fromEntries(Object.keys(names).sort().map((k) => [k, names[k]]))
    shards.set(stateFips, JSON.stringify({ state: stateFips, names: sorted }, null, 0) + '\n')
  }

  // The nation is its own shard so that a federal slice reads through exactly
  // the same path as every other level, rather than needing a special case.
  // The gazetteer has no US row, so the name is spelled out here; it matches
  // what geoidToDisplayName already returns for a federal slice.
  const nation = { name: 'United States of America', lat: 39.828175, lon: -98.5795 }
  const usPop = pop.get('US')
  if (usPop !== undefined) nation.pop = usPop
  shards.set('us', JSON.stringify({ state: 'us', names: { US: nation } }, null, 0) + '\n')

  return shards
}

function digest(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 12)
}

/** Re-serialises a shard with every `pop` removed, for a keyless --check. */
function stripPop(json) {
  const shard = JSON.parse(json)
  for (const entry of Object.values(shard.names)) delete entry.pop
  return JSON.stringify(shard, null, 0) + '\n'
}

async function main() {
  const check = process.argv.includes('--check')

  console.log(check ? 'Checking public/geo/ against the Census gazetteer…' : 'Generating public/geo/…')
  const sources = []
  for (const source of SOURCES) sources.push(await fetchSource(source))

  const key = process.env.CENSUS_API_KEY
  let pop = new Map()
  if (key) {
    const states = sources
      .find((s) => s.kind === 'state')
      .rows.map((r) => r.geoid)
      .filter((g) => g.length === 2)
    pop = await fetchPopulations(key, states)
  } else {
    // Not an error. A contributor without a key gets names and coordinates,
    // which is everything the app needs today; only the population figures
    // that #87's banner wants require one.
    console.log('  no CENSUS_API_KEY — skipping population (see the header comment)')
  }

  const shards = buildShards(sources, pop)
  const total = [...shards.values()].reduce((n, s) => n + s.length, 0)
  const rows = [...shards.values()].reduce((n, s) => n + Object.keys(JSON.parse(s).names).length, 0)

  if (check) {
    if (!existsSync(OUT_DIR)) {
      console.error('public/geo/ does not exist — run `npm run geo:generate`')
      process.exit(1)
    }
    const onDisk = new Set((await readdir(OUT_DIR)).filter((f) => f.endsWith('.json')))
    const drift = []

    for (const [stateFips, content] of shards) {
      const file = `${stateFips}.json`
      onDisk.delete(file)
      const path = join(OUT_DIR, file)
      if (!existsSync(path)) {
        drift.push(`missing   ${file}`)
        continue
      }
      // Compared with line endings normalised. .gitattributes pins these files
      // to LF, but a clone made before that landed — or any checkout with
      // core.autocrlf=true and stale attributes — would otherwise report every
      // shard as drifted on nothing but a CR.
      let actual = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n')
      let expected = content
      // Without a key this run has no population to compare, so drop it from
      // both sides rather than reporting all 53 shards as drifted. A keyless
      // check still verifies every name and coordinate.
      if (!key) {
        actual = stripPop(actual)
        expected = stripPop(expected)
      }
      if (actual !== expected) drift.push(`changed   ${file}  ${digest(actual)} -> ${digest(expected)}`)
    }
    for (const stale of onDisk) drift.push(`orphaned  ${stale}`)

    if (drift.length > 0) {
      console.error(`\npublic/geo/ is ${drift.length} file(s) out of date:`)
      for (const line of drift) console.error(`  ${line}`)
      console.error('\nRun `npm run geo:generate` and commit the result.')
      process.exit(1)
    }
    console.log(`\nUp to date — ${shards.size} states, ${rows.toLocaleString()} rows.`)
    return
  }

  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })
  for (const [stateFips, content] of shards) {
    await writeFile(join(OUT_DIR, `${stateFips}.json`), content, 'utf8')
  }

  const largest = [...shards].sort((a, b) => b[1].length - a[1].length)[0]
  console.log(`\nWrote ${shards.size} shards to public/geo/`)
  console.log(`  ${rows.toLocaleString()} places and counties, ${(total / 1024).toFixed(0)} KB uncompressed`)
  console.log(`  largest shard ${largest[0]}.json at ${(largest[1].length / 1024).toFixed(0)} KB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
