#!/usr/bin/env node
/**
 * Run a command against a dev server, REUSING one that is already up and
 * STOPPING one we started ourselves.
 *
 * Run: node scripts/with-dev-server.mjs [--port 5173] -- <command...>
 *      node scripts/with-dev-server.mjs --status
 *      node scripts/with-dev-server.mjs --stop
 *
 * 🔴 WHY THIS EXISTS. In November 2026 this checkout accumulated TWELVE live
 * Vite dev servers over about two days, found only because an unrelated session
 * in another repo went looking. The pattern was always the same: a session
 * started `npm run dev`, found 5173 busy, silently got 5174 (then 5175, 5176…),
 * ran its guards, and ended without stopping anything — and a background
 * process outlives the session that started it. One session alone left 5181
 * through 5187. Each attempt stepped AROUND the previous server instead of
 * cleaning up, because `--port <n>` was documented as the fix for a busy port
 * and nothing anywhere said "stop it when you are done".
 *
 * Two changes close that. `server.strictPort` in vite.config.ts makes the
 * silent walk to the next port a loud EADDRINUSE. This script makes the loud
 * failure unnecessary: it reuses what is already there, and when it does start
 * a server it owns it and tears it down in a `finally`.
 *
 * THE OWNERSHIP RULE, which is the entire contract:
 *   - reused a server we did not start  → leave it running, it is not ours
 *   - started one ourselves             → kill the whole tree, always, even on
 *                                         Ctrl-C, a throw, or a failed command
 *
 * IDENTITY, and why it is not just "is the port open". Another EV project's
 * Vite may well hold 5173 — ev-landing does. Running this checkout's guards
 * against ev-landing's server produces confident nonsense, and "a live check
 * pointed at the wrong port looks exactly like contract drift"
 * (.planning/phases/17-the-signed-out-arrival/17-VALIDATION.md). So the probe
 * asks for a module that exists only in THIS repo and insists the answer is
 * JavaScript:
 *
 *   GET /src/lib/writeAccess.ts  →  200 + content-type: text/javascript
 *
 * 🔴 A 200 alone proves nothing. Vite's SPA fallback serves index.html for any
 * unknown path, so a foreign Vite answers 200 `text/html` for this exact URL —
 * measured, not assumed. The content-type is the whole discriminator. (Another
 * worktree of this same repo does match, and that is fine: it is the same app.)
 *
 * PLACEHOLDERS. The command may contain {port} and {origin}; both are
 * substituted before it runs. That is deliberate rather than auto-appending
 * `--port`: the browser guards take `--port`, but check-place-resolve.mjs
 * --live takes `--origin`, and guessing wrong points a check at nothing.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The module the identity probe asks for. Must exist, and must be real source
 *  Vite will transform — not an asset, which would come back as itself. */
const PROBE_MODULE = 'src/lib/writeAccess.ts'

/** Ports we sweep for --status / --stop. 5173 is Vite's default; the strays
 *  this was written for reached 5187. */
const SWEEP_FROM = 5173
const SWEEP_TO = 5199

const READY_TIMEOUT_MS = 90_000
const PROBE_TIMEOUT_MS = 2_000

function parseArgs(argv) {
  const out = { port: 5173, mode: 'run', all: false, command: [] }
  let i = 0
  for (; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { i++; break }
    else if (a === '--port') { out.port = Number(argv[++i]) }
    else if (a.startsWith('--port=')) { out.port = Number(a.slice('--port='.length)) }
    else if (a === '--status') { out.mode = 'status' }
    else if (a === '--stop') { out.mode = 'stop' }
    else if (a === '--all') { out.all = true }
    else if (a === '--help' || a === '-h') { out.mode = 'help' }
    else break
  }
  out.command = argv.slice(i)
  return out
}

/**
 * Is a dev server for THIS checkout answering on `port`?
 * Returns 'ours' | 'foreign' | 'none'.
 */
async function probe(port) {
  // 🔴 `/@fs/<ABSOLUTE ROOT>/…`, and the absolute part is the whole point. A
  // bare `/src/lib/writeAccess.ts` only proves the server is THIS APP; it
  // cannot tell one worktree of this repo from another. That is not an edge
  // case — holding two branches is the only reason to make a second worktree,
  // and `strictPort` aims both at the same 5173. Measured with the bare probe:
  // another worktree's server was reported "THIS checkout", reused for a guard
  // run against the wrong branch, and killed by `--stop` from here. That is
  // exactly the failure this script exists to prevent, a check pointed at the
  // wrong server reporting nonsense that reads like a real failure.
  //
  // Vite serves `/@fs/` only for paths inside its own `server.fs.allow`, which
  // defaults to its workspace root, so a server rooted elsewhere will not
  // transform OUR absolute path: it 403s or falls through to the SPA fallback.
  // Either way the answer is not JavaScript.
  const abs = ROOT.replace(/\\/g, '/')
  const url = `http://localhost:${port}/@fs/${encodeURI(abs)}/${PROBE_MODULE}`
  let res
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { accept: '*/*' },
    })
  } catch {
    return 'none'
  }
  // A 5xx is OUR server having a bad moment — a syntax error mid-edit, or Vite
  // re-optimising deps — not someone else's server. Calling that `foreign`
  // printed "held by a server that is NOT this checkout" and sent you hunting
  // for a port conflict that did not exist.
  if (res.status >= 500) return 'ours'
  if (!res.ok) return 'foreign'
  const type = (res.headers.get('content-type') || '').toLowerCase()
  // text/javascript means Vite transformed a real module at OUR absolute path.
  // text/html is the SPA fallback — a Vite rooted somewhere else.
  return type.includes('javascript') ? 'ours' : 'foreign'
}

/** PIDs listening on a port. Windows-first, with a POSIX fallback. */
function listenersOn(port) {
  if (process.platform === 'win32') {
    const r = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
       `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | ` +
       'Select-Object -ExpandProperty OwningProcess -Unique'],
      { encoding: 'utf8' },
    )
    return (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  }
  const r = spawnSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  return (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
}

/**
 * Kill a process and everything under it.
 *
 * 🔴 The tree, not the process. `npm run dev` is node spawning node: killing
 * only the parent orphans the child that actually holds the port, which is a
 * tidier-looking version of the exact bug this script exists to prevent.
 */
function killTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try { process.kill(-pid, 'SIGTERM') } catch { /* already gone */ }
    try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ }
  }
}

function startServer(port) {
  // Spawn Vite's JS entry through this same node binary rather than the
  // .bin shim: no shell, no .cmd quoting rules, and the PID we get back is
  // the process that will hold the port.
  const entry = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(entry)) {
    console.error(`[dev-server] cannot find ${entry} — run \`npm install\` first.`)
    process.exit(1)
  }
  const child = spawn(
    process.execPath,
    [entry, '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' },
  )
  const log = []
  const keep = (buf) => {
    log.push(buf.toString())
    if (log.length > 200) log.shift()
  }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  return { child, log }
}

async function waitForReady(port, started) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (started.child.exitCode !== null) {
      console.error(`[dev-server] vite exited early (code ${started.child.exitCode}):`)
      console.error(started.log.join(''))
      return false
    }
    if (await probe(port) === 'ours') return true
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error(`[dev-server] vite did not answer on ${port} within ${READY_TIMEOUT_MS / 1000}s:`)
  console.error(started.log.join(''))
  return false
}

function runCommand(command, port) {
  const origin = `http://localhost:${port}`
  const sub = (a) => a.replaceAll('{port}', String(port)).replaceAll('{origin}', origin)
  // One argument is taken as a raw shell line, so a caller can chain several
  // guards against ONE server: `-- "npm run a -- --port {port} && npm run b"`.
  // Several arguments are an argv, quoted only where an argument has spaces.
  const line = command.length === 1
    ? sub(command[0])
    : command.map(sub).map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')
  console.log(`[dev-server] → ${line}`)
  const r = spawnSync(line, { cwd: ROOT, stdio: 'inherit', shell: true })
  return r.status === null ? 1 : r.status
}

/**
 * Run every command, even after one fails, and return the worst exit code.
 *
 * 🔴 NOT `a && b && c`, and that is from evidence: the first run of this suite
 * went red on two place-entry assertions and `&&` silently skipped explore-gate
 * and explore-rooms entirely, so one known-red guard hid the other two. A guard
 * suite that stops at the first failure tells you less than one guard would.
 * Each command is its own shell line, which also keeps this working the same
 * under cmd.exe and sh instead of depending on the shell's chaining operators.
 */
function runAll(commands, port) {
  const results = []
  for (const c of commands) {
    const status = runCommand([c], port)
    // Record the SUBSTITUTED line. Recording the raw one printed a summary
    // saying `-- --port {port}`, which cannot be copied and re-run — the one
    // thing you want from a failure summary.
    results.push({ c: c.replaceAll('{port}', String(port)).replaceAll('{origin}', `http://localhost:${port}`), status })
  }
  console.log('\n[dev-server] ── suite ──')
  for (const r of results) {
    console.log(`[dev-server] ${r.status === 0 ? 'ok  ' : 'FAIL'}  ${r.c}`)
  }
  return results.some((r) => r.status !== 0) ? 1 : 0
}

async function sweep(kill) {
  let failed = false
  const found = []
  for (let port = SWEEP_FROM; port <= SWEEP_TO; port++) {
    const what = await probe(port)
    if (what === 'none') continue
    found.push({ port, what, pids: listenersOn(port) })
  }
  if (found.length === 0) {
    console.log(`[dev-server] nothing listening on ${SWEEP_FROM}-${SWEEP_TO}.`)
    return 0
  }
  for (const f of found) {
    const who = f.what === 'ours' ? 'THIS checkout' : 'another project (left alone)'
    console.log(`[dev-server] ${f.port}  ${who}  pid ${f.pids.join(', ') || '?'}`)
    if (kill && f.what === 'ours') {
      // 🔴 Only claim it stopped if we had something to kill AND it is gone.
      // `listenersOn` returns [] whenever the lookup itself fails — no `lsof`
      // on a minimal image, a blocked `Get-NetTCPConnection` — and the kill
      // loop is then a no-op. Printing "stopped." there is the one lie this
      // script must not tell: a `dev:stop` that says stopped while the server
      // runs on is the bug it was written to kill.
      if (f.pids.length === 0) {
        console.log(`[dev-server] ${f.port}  could NOT find the owning pid — still running.`)
        failed = true
        continue
      }
      for (const pid of f.pids) killTree(pid)
      const after = await probe(f.port)
      if (after === 'none') {
        console.log(`[dev-server] ${f.port}  stopped.`)
      } else {
        console.log(`[dev-server] ${f.port}  STILL ANSWERING after kill — stop it by hand.`)
        failed = true
      }
    }
  }
  if (!kill && found.some((f) => f.what === 'ours')) {
    console.log('[dev-server] run with --stop to shut the ones belonging to this checkout.')
  }
  // Non-zero when a --stop could not actually stop something, so a script that
  // chains off `npm run dev:stop` does not sail on believing the port is free.
  return failed ? 1 : 0
}

async function main() {
  const { port, mode, all, command } = parseArgs(process.argv.slice(2))
  const run = (p) => (all ? runAll(command, p) : runCommand(command, p))

  if (mode === 'help') {
    console.log(`Usage:
  node scripts/with-dev-server.mjs [--port 5173] -- <command...>
  node scripts/with-dev-server.mjs --all -- "<cmd a>" "<cmd b>" ...
  node scripts/with-dev-server.mjs --status     list dev servers on ${SWEEP_FROM}-${SWEEP_TO}
  node scripts/with-dev-server.mjs --stop       stop the ones from this checkout

{port} and {origin} in a command are substituted. Reuses a running server; stops
one only if it started it. --all runs EVERY command even after one fails (so a
red guard cannot hide the next one) and exits non-zero if any did.`)
    return 0
  }
  if (mode === 'status') return sweep(false)
  if (mode === 'stop') return sweep(true)

  if (command.length === 0) {
    console.error('[dev-server] no command given. See --help.')
    return 1
  }
  if (!existsSync(join(ROOT, PROBE_MODULE))) {
    // Fail loudly rather than silently deciding every server is foreign and
    // starting a duplicate on every run — which is the original bug.
    console.error(`[dev-server] the identity probe targets ${PROBE_MODULE}, which no longer exists.`)
    console.error('[dev-server] point PROBE_MODULE at another repo-unique source module.')
    return 1
  }

  const existing = await probe(port)
  if (existing === 'ours') {
    console.log(`[dev-server] reusing the dev server already on ${port} (not ours to stop).`)
    return run(port)
  }
  if (existing === 'foreign') {
    console.error(`[dev-server] port ${port} is held by a server that is NOT this checkout.`)
    console.error('[dev-server] running the guards against it would report nonsense that looks')
    console.error('[dev-server] like a real failure. Stop it, or pass --port <n> deliberately.')
    return 1
  }

  console.log(`[dev-server] starting a dev server on ${port} (ours — will stop it at the end).`)
  const started = startServer(port)
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    killTree(started.child.pid)
  }
  // Belt and braces: a throw, a signal, or a plain exit all tear it down.
  process.on('exit', stop)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(sig, () => { stop(); process.exit(130) })
  }

  try {
    if (!(await waitForReady(port, started))) return 1
    return run(port)
  } finally {
    stop()
    console.log(`[dev-server] stopped the dev server on ${port}.`)
  }
}

main().then(
  (code) => { process.exitCode = code },
  (err) => { console.error(err); process.exitCode = 1 },
)
