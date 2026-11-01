#!/usr/bin/env node
/**
 * prosrc-diff.mjs — step 0c of 18-02-APPLY.md: do the six live function bodies match
 * the bytes of the file that was reviewed?
 *
 * Run:  SCRATCH_DB_URL=postgres://... node scripts/prosrc-diff.mjs /tmp/apply/20261030000100_public_read.sql
 *
 * Why this exists: every rehearsal of 20261030000100_public_read.sql before 2026-11-01 ran a
 * comment-stripped copy pasted through the MCP, so nobody had ever compared what the database
 * holds against what the repo says. The failures that matter are silent and syntactically
 * valid — a `--` comment swallowing the line below it and taking `AND cp.is_suspended IS NOT
 * TRUE` or the slice-type allowlist with it. `prosrc` is exactly the text between the `$$`
 * delimiters, so it can be compared byte for byte, and that is the only comparison that sees
 * this class of bug.
 *
 * 🔴 Compare BYTES, not psql's stdout. On Windows psql writes stdout in TEXT mode, so every
 * \n inside prosrc comes back as \r\n: a naive string compare reports all six as DIFFERS,
 * each longer than the file by exactly its own line count, and the reader is left rejecting
 * clean SQL. Same shape as the `grep -c $'\r'` bug in step 0a. base64 is transport-safe, so
 * what is decoded here is the server's bytes and nothing else.
 *
 * 🔴 A pass is worth nothing until you have seen this report a failure. Replace one function
 * with a one-line body and re-run: it must print DIFFERS with the offset. The runbook asks
 * for that control explicitly.
 *
 * Exit 0 = all six identical and no CR in any live body. Exit 1 = anything else.
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const file = process.argv[2]
const url = process.env.SCRATCH_DB_URL

if (!file || !url) {
  console.error('usage: SCRATCH_DB_URL=postgres://... node scripts/prosrc-diff.mjs <public_read.sql>')
  process.exit(1)
}

const sql = fs.readFileSync(file, 'utf8')
const blocks = [...sql.matchAll(/CREATE OR REPLACE FUNCTION civic_spaces\.(\w+)\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)]

// Not a style check: a file that parsed to five blocks would silently skip one function,
// and skipping is the outcome this script exists to prevent.
if (blocks.length !== 6) {
  console.error(`expected 6 function blocks in ${file}, found ${blocks.length}`)
  process.exit(1)
}

let bad = 0

for (const [, name, body] of blocks) {
  // The SQL goes in on stdin, never as a `-c` argv entry: Node encodes argv in the system
  // ANSI codepage on Windows, which mangles any non-ASCII byte. Same fix as the two guards.
  const query = `select encode(convert_to(prosrc, 'UTF8'), 'base64')
                   from pg_proc
                  where pronamespace = 'civic_spaces'::regnamespace and proname = '${name}'`
  const b64 = execFileSync('psql', [url, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: query,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  }).replace(/\s+/g, '')

  if (!b64) {
    console.log(`MISSING   ${name} — not defined in civic_spaces`)
    bad++
    continue
  }

  const live = Buffer.from(b64, 'base64')
  const want = Buffer.from(body, 'utf8')
  const same = live.equals(want)

  console.log(`${same ? 'IDENTICAL' : 'DIFFERS  '} ${name.padEnd(26)} ${live.length} bytes`)

  if (!same) {
    bad++
    const n = Math.min(live.length, want.length)
    let i = 0
    while (i < n && live[i] === want[i]) i++
    const ctx = (s) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 40))
    console.log(`  first difference at byte ${i}`)
    console.log(`    file: ${ctx(body)}`)
    console.log(`    live: ${ctx(live.toString('utf8'))}`)
  }

  // Separate from the comparison on purpose: a CR that is in BOTH the file and the database
  // compares equal and is still a CR inside a $$ body.
  if (live.includes(0x0d)) {
    console.log(`  !! ${name}: live body contains a CR byte`)
    bad++
  }
}

console.log(bad ? `FAIL — ${bad} problem(s)` : 'ALL 6 IDENTICAL, no CR in any live body')
process.exit(bad ? 1 : 0)
