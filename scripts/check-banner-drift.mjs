#!/usr/bin/env node
/**
 * Detects drift in the shared banner library that NOTHING ELSE CAN SEE.
 *
 * 🔴 WHY THIS EXISTS. Essentials replaces a banner by swapping the bytes behind a
 * stable URL. That changes no path, no import and no type, so `tsc -b`, the Vite
 * build, a 404 check and every test in the repo stay green while the credit we
 * publish beside the image silently becomes the wrong photographer's name. Treasury
 * Tracker rendered the new Texas photograph under the old photographer's name for
 * three weeks for exactly this reason (TT-TEAM-NOTE-state-banner-staleness,
 * ESSENTIALS-TEAM-NOTE-registry-attribution-gaps, both 2026-09-10). A generation
 * date in a comment documents the risk; it does not detect it. This does.
 *
 * Attribution on a CC BY / CC BY-SA image is a licence condition, so a drifted
 * credit is a compliance problem, not a cosmetic one.
 *
 * 🔴 THERE ARE TWO KINDS OF DRIFT AND THE BYTE CHECK SEES ONLY ONE. Swapping the
 * bytes behind a path is one. The other is the catalog moving underneath us:
 * Essentials adds a place, or republishes a state at a versioned path, and our
 * generated table — a CACHE of their catalog — keeps serving the old set with no
 * symptom at all. The byte check cannot see it, because it only ever looks at the
 * assets we already know about; an asset we never recorded is invisible to it by
 * construction. That is how this repo sat 43 places behind for two months with a
 * green guard, and why a member looking at Reno got the generic fallback while a
 * credited Reno banner was published and sitting unused. `checkCatalog` below is
 * the half that looks at what Essentials offers rather than at what we already
 * took, and it is a PATH join in both directions — never a name join. See the
 * Portland ME / Portland OR note in scripts/generate-banners.mjs.
 *
 *   node scripts/check-banner-drift.mjs           check, exit 1 on drift
 *   node scripts/check-banner-drift.mjs --write    re-record after verifying credits
 *
 * NOT part of `npm run build` on purpose — it needs the network, and a flaky
 * connection must never fail a typecheck. Run it when touching lib/banners.ts, and
 * periodically regardless: drift arrives with no deploy on our side.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const MANIFEST = resolve(HERE, '../src/lib/banners.manifest.json')
const BASE =
  'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos'

const write = process.argv.includes('--write')
const rebuild = process.argv.includes('--rebuild')

/**
 * --rebuild re-derives the whole asset list from source, so banners added by
 * scripts/generate-city-banners.mjs come under the guard too. Every credit we publish
 * needs to be watched, not just the ones that happened to exist when this was written.
 * Source files are read as text rather than imported: this is a plain .mjs script and
 * the tables are .ts.
 */
function assetsFromSource() {
  const assets = {}
  const gen = readFileSync('src/lib/banners.generated.ts', 'utf8')

  const fed = /FEDERAL_BANNER: Banner = \{ url: "([^"]+)", credit: "([^"]+)" \}/.exec(gen)
  if (fed) assets['federal'] = { path: fed[1].split('/politician_photos/')[1], credit: fed[2] }

  const stateBlock = gen.slice(gen.indexOf('STATE_BANNERS'), gen.indexOf('PLACE_BANNERS'))
  for (const m of stateBlock.matchAll(/^ {2}([A-Z]{2}): \{ url: "([^"]+)", credit: "([^"]+)" \}/gm)) {
    assets['state:' + m[1]] = { path: m[2].split('/politician_photos/')[1], credit: m[3] }
  }

  const placeBlock = gen.slice(gen.indexOf('PLACE_BANNERS'))
  for (const m of placeBlock.matchAll(/^ {2}'(\d+)': \{ url: "([^"]+)", credit: "([^"]+)" \}/gm)) {
    assets['place:' + m[1]] = { path: m[2].split('/politician_photos/')[1], credit: m[3] }
  }
  return assets
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex')

async function get(path, bust) {
  const url = `${BASE}/${path}${bust ? `?v=${Date.now()}` : ''}`
  const res = await fetch(url)
  if (!res.ok) return { error: `HTTP ${res.status}` }
  const buf = Buffer.from(await res.arrayBuffer())
  return { sha: sha(buf), bytes: buf.length }
}

const BANNERS_JSON = 'https://essentials.empowered.vote/banners.json'

/**
 * What Essentials publishes today, against what our generated table actually points at.
 *
 * 🔴 EVERY COMPARISON HERE IS ON BUCKET PATH. The place NAME is never touched, in
 * either direction. Essentials keys Portland ME and Portland OR identically and they
 * differ only by filename, which is precisely how a sibling app published one under
 * the other's photographer. A guard that joined on name would be a second instance of
 * the bug it is meant to catch.
 *
 * Three findings, and they are not the same severity:
 *
 *  - `retired`    we reference a path Essentials no longer lists. The asset may still
 *                 be served, so the byte check can stay green while we point at
 *                 something upstream has superseded. This is how a state republished
 *                 at `-v2` shows up on our side of the join.
 *  - `uncredited` we reference a path Essentials publishes with NO author. The
 *                 generator excludes these by design; if one is here, something put it
 *                 back by hand. A banner we cannot credit is a banner we cannot show.
 *  - `unused`     Essentials publishes a credited asset we reference nowhere. Usually
 *                 it means regenerate. Sometimes it cannot be fixed here at all: six
 *                 of these are curated images for places coverage.json gives no geoid
 *                 for, and a geoid is the only key we are allowed to use. Those are an
 *                 upstream ask, so this one is checked against a recorded baseline
 *                 rather than required to be empty.
 */
async function catalogState() {
  const res = await fetch(BANNERS_JSON)
  const text = await res.text()
  if (!res.ok || text.trimStart().startsWith('<')) {
    // A SPA origin answers an unknown path with index.html and a 200, so a withdrawn
    // export arrives as HTML rather than a 404. Say which, instead of dying in a parser.
    throw new Error(`banners.json unreadable at ${BANNERS_JSON} (HTTP ${res.status})`)
  }
  const banners = JSON.parse(text)

  const gen = readFileSync(resolve(HERE, '../src/lib/banners.generated.ts'), 'utf8')
  const used = new Set([...gen.matchAll(/politician_photos\/([^"]+)"/g)].map((m) => m[1]))
  const published = new Set(banners.assets.map((a) => a.path))
  const noAuthor = new Set((banners.uncredited || []).map((u) => u.path))

  return {
    retired: [...used].filter((p) => !published.has(p) && !noAuthor.has(p)).sort(),
    uncredited: [...used].filter((p) => noAuthor.has(p)).sort(),
    unused: banners.assets.filter((a) => !used.has(a.path)).map((a) => a.path).sort(),
  }
}

if (rebuild) {
  const assets = assetsFromSource()
  const keys = Object.keys(assets)
  console.log(`rebuilding manifest from source: ${keys.length} assets…`)
  const rebuilt = {}
  let failed = 0
  for (const k of keys) {
    const r = await get(assets[k].path, false)
    if (r.error) {
      console.error(`  FETCH FAILED ${k} ${assets[k].path} — ${r.error}`)
      failed++
      continue
    }
    rebuilt[k] = { path: assets[k].path, sha256: r.sha, bytes: r.bytes, credit: assets[k].credit }
  }
  const cat = await catalogState()
  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        note: 'Generated by scripts/check-banner-drift.mjs --rebuild. See that script and src/lib/banners.ts.',
        generatedAt: new Date().toISOString().slice(0, 10),
        unusedAssets: {
          note:
            'Credited assets Essentials publishes that our generated table references nowhere. ' +
            'Each is a banner a member could be seeing and is not. Shrink this list, never grow it ' +
            'to make the check pass: first run `npm run gen:banners`, and only record what survives.',
          paths: cat.unused,
        },
        assets: rebuilt,
      },
      null,
      2
    )}\n`
  )
  console.log(`wrote ${MANIFEST}: ${Object.keys(rebuilt).length} assets${failed ? `, ${failed} unreachable` : ''}`)
  console.log(`  catalog baseline: ${cat.unused.length} published assets unused`)
  process.exit(failed ? 1 : 0)
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

/* ---- catalog drift, checked BEFORE the bytes ---- */
// It needs two HTTP calls rather than 280, and it is the half that can report an asset
// the byte loop will never look at. A stale table is silent in every other check we own.
const catalog = await catalogState()
const unusedBaseline = new Set(manifest.unusedAssets?.paths ?? [])
const newlyUnused = catalog.unused.filter((p) => !unusedBaseline.has(p))
const nowUsed = [...unusedBaseline].filter((p) => !catalog.unused.includes(p))

const drifted = []
const inFlight = []
const broken = []

for (const [key, rec] of Object.entries(manifest.assets)) {
  const plain = await get(rec.path, false)
  if (plain.error) {
    broken.push({ key, ...rec, detail: plain.error })
    continue
  }

  // A cache-busted read that disagrees with the plain one means a swap is
  // propagating: the plain URL is serving an edge copy that is already obsolete.
  // Our credit is about to be wrong even though it matches right now.
  const bust = await get(rec.path, true)

  if (plain.sha !== rec.sha256) {
    drifted.push({ key, ...rec, got: plain })
  } else if (!bust.error && bust.sha !== plain.sha) {
    inFlight.push({ key, ...rec, got: bust })
  }
}

const total = Object.keys(manifest.assets).length

if (write) {
  for (const d of [...drifted, ...inFlight]) {
    manifest.assets[d.key].sha256 = d.got.sha
    manifest.assets[d.key].bytes = d.got.bytes
  }
  manifest.generatedAt = new Date().toISOString().slice(0, 10)
  if (manifest.unusedAssets) manifest.unusedAssets.paths = catalog.unused
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Re-recorded ${drifted.length + inFlight.length} of ${total} assets.`)
  if (newlyUnused.length) {
    console.log(
      `🔴 Also recorded ${newlyUnused.length} newly-unused published asset(s). --write does NOT`
    )
    console.log('   add them to the app. Run `npm run gen:banners` and check they are still unused.')
  }
  console.log('🔴 Now RE-DERIVE the affected credits from essentials/src/lib/buildingImages.js')
  console.log('   and verify each author on its Commons File: page. Do not copy another')
  console.log("   app's table — that is how this drift reaches production in the first place.")
  process.exit(0)
}

for (const p of catalog.retired) {
  console.error(`RETIRED   ${'catalog'.padEnd(14)} ${p}`)
  console.error('          we point at this path; banners.json no longer lists it. Essentials')
  console.error('          has superseded it (a state republished at -vN looks exactly like')
  console.error('          this). Run `npm run gen:banners`, then --rebuild the manifest.')
}
for (const p of catalog.uncredited) {
  console.error(`UNCREDITED${' '.padEnd(4)}catalog      ${p}`)
  console.error('          we point at this path and Essentials publishes NO author for it.')
  console.error('          Attribution is a licence condition — remove it or get it credited.')
}
for (const p of newlyUnused) {
  console.error(`UNUSED    ${'catalog'.padEnd(14)} ${p}`)
  console.error('          Essentials publishes this credited banner and we reference it')
  console.error('          nowhere, so some place is showing the generic fallback instead.')
  console.error('          Run `npm run gen:banners`. If it is STILL unused afterwards,')
  console.error('          coverage.json gives it no geoid — tell Essentials, then --write.')
}
for (const p of nowUsed) {
  console.log(`resolved  ${'catalog'.padEnd(14)} ${p} is now in use — re-record with --write`)
}
for (const b of broken) {
  console.error(`GONE      ${b.key.padEnd(14)} ${b.path} — ${b.detail}`)
}
for (const d of drifted) {
  console.error(`DRIFTED   ${d.key.padEnd(14)} ${d.path}`)
  console.error(`          credited: ${d.credit}`)
  console.error(`          expected: ${d.sha256.slice(0, 16)} (${d.bytes} b)`)
  console.error(`          serving:  ${d.got.sha.slice(0, 16)} (${d.got.bytes} b)`)
}
for (const f of inFlight) {
  console.error(`IN FLIGHT ${f.key.padEnd(14)} ${f.path}`)
  console.error(`          plain URL matches, but a cache-busted read differs — a swap`)
  console.error(`          is propagating and this credit is about to be wrong:`)
  console.error(`          ${f.credit}`)
}

const bytesBad = broken.length + drifted.length + inFlight.length
const catalogBad = catalog.retired.length + catalog.uncredited.length + newlyUnused.length

if (bytesBad === 0 && catalogBad === 0) {
  console.log(`All ${total} shared-library banners match their recorded bytes.`)
  console.log(
    `Catalog matches too: every credited asset Essentials publishes is either in use or ` +
      `one of the ${unusedBaseline.size} recorded as blocked upstream.`
  )
  process.exit(0)
}

if (bytesBad) {
  console.error(
    `\n${bytesBad} of ${total} assets need attention. The image changed; the credit did not.\n` +
      'Re-derive the credits from Essentials\' registry, verify authors on Commons, then\n' +
      'run with --write to re-record.'
  )
}
if (catalogBad) {
  // Deliberately a separate paragraph: the fix is a different one. Byte drift is
  // re-verify-then---write. Catalog drift is regenerate, and --write there only records
  // that we have given up on an asset we cannot key.
  console.error(
    `\n${catalogBad} catalog finding(s). These are NOT byte drift and --write is not the fix:\n` +
      'our generated table is a cache of Essentials\' catalog and has fallen behind it.\n' +
      'Run `npm run gen:banners`, then `node scripts/check-banner-drift.mjs --rebuild`.'
  )
}
process.exit(1)
