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
  { kind: 'place', file: '2024_Gaz_place_national.zip' },
  { kind: 'county', file: '2024_Gaz_counties_national.zip' },
]

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
  /\s+(city and borough|consolidated government|metropolitan government|unified government|city|town|township|borough|municipality|village|CDP|comunidad|zona urbana)$/i

function cleanPlaceName(name) {
  // Only ", {State}" style trailers appear in gazetteer NAMEs, but strip
  // defensively: the API form carried them and the two should agree.
  const base = name.split(', ')[0] ?? name
  const stripped = base.replace(PLACE_SUFFIX, '').trim()
  // "Town of Purgatory" style names are entirely suffix once stripped; never
  // return an empty label.
  return stripped.length > 0 ? stripped : base
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

async function fetchSource({ kind, file }) {
  const url = `${GAZETTEER}/${file}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`${url} -> HTTP ${resp.status}`)
  const text = unzipSingleFile(Buffer.from(await resp.arrayBuffer())).toString('utf8')
  const rows = parseGazetteer(text)
  console.log(`  ${file}  ${rows.length.toLocaleString()} rows`)
  return { kind, rows }
}

function buildShards(sources) {
  /** @type {Map<string, Record<string, { name: string, lat: number, lon: number }>>} */
  const byState = new Map()

  for (const { kind, rows } of sources) {
    for (const row of rows) {
      // Places are 7-digit and counties 5-digit; anything else is a gazetteer
      // row we do not serve and would only bloat the shard.
      const expected = kind === 'place' ? 7 : 5
      if (row.geoid.length !== expected) continue
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue

      const stateFips = row.geoid.slice(0, 2)
      if (!byState.has(stateFips)) byState.set(stateFips, {})
      byState.get(stateFips)[row.geoid] = {
        name: kind === 'place' ? cleanPlaceName(row.name) : row.name,
        lat: row.lat,
        lon: row.lon,
      }
    }
  }

  const shards = new Map()
  for (const [stateFips, names] of [...byState].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Sorted keys keep the output byte-stable, so --check only fires on real
    // data changes rather than on object insertion order.
    const sorted = Object.fromEntries(Object.keys(names).sort().map((k) => [k, names[k]]))
    shards.set(stateFips, JSON.stringify({ state: stateFips, names: sorted }, null, 0) + '\n')
  }
  return shards
}

function digest(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 12)
}

async function main() {
  const check = process.argv.includes('--check')

  console.log(check ? 'Checking public/geo/ against the Census gazetteer…' : 'Generating public/geo/…')
  const sources = []
  for (const source of SOURCES) sources.push(await fetchSource(source))

  const shards = buildShards(sources)
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
      const actual = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n')
      if (actual !== content) drift.push(`changed   ${file}  ${digest(actual)} -> ${digest(content)}`)
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
