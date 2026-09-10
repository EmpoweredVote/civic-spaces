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
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

const sha = (buf) => createHash('sha256').update(buf).digest('hex')

async function get(path, bust) {
  const url = `${BASE}/${path}${bust ? `?v=${Date.now()}` : ''}`
  const res = await fetch(url)
  if (!res.ok) return { error: `HTTP ${res.status}` }
  const buf = Buffer.from(await res.arrayBuffer())
  return { sha: sha(buf), bytes: buf.length }
}

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
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Re-recorded ${drifted.length + inFlight.length} of ${total} assets.`)
  console.log('🔴 Now RE-DERIVE the affected credits from essentials/src/lib/buildingImages.js')
  console.log('   and verify each author on its Commons File: page. Do not copy another')
  console.log("   app's table — that is how this drift reaches production in the first place.")
  process.exit(0)
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

const bad = broken.length + drifted.length + inFlight.length
if (bad === 0) {
  console.log(`All ${total} shared-library banners match their recorded bytes.`)
  process.exit(0)
}

console.error(
  `\n${bad} of ${total} assets need attention. The image changed; the credit did not.\n` +
    'Re-derive the credits from Essentials\' registry, verify authors on Commons, then\n' +
    'run with --write to re-record.'
)
process.exit(1)
