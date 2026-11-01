# Phase 18: The Public Square — verification

**Date:** 2026-10-31
**Branches:** `phase/18-01` (merged, PR #136) · `phase/18-02-public-read-path` (PR #137) ·
`phase/18-03-frontend-read-path` (PR #138) · `phase/18-04-the-closed-door`

🔴 **The code is complete. Nothing is applied.** Three migrations are written, reviewed and
unapplied, in a fixed order — `20261030000000` → `20261030000100` → `20261030000200` — and
`18-02-APPLY.md` is the runbook. `main` auto-deploys in ~3 minutes, so the apply comes first
and the merges come after. Until then a signed-out visitor at a public place sees
"Failed to load posts", which is the gate working, not a defect.

## 1. The guards

Recorded as they actually printed, on the day. 🔴 A guard that was not run is recorded as not
run, and the two that cannot pass yet say why rather than being omitted.

| Guard | Result | Notes |
|---|---|---|
| `npm run build` | clean | `tsc -b && vite build` |
| `check:write-access` | **56 PASS / 0 FAIL** | 34 at the start of the phase |
| `check:composition` | **90 PASS / 0 FAIL** | 62 at the start of the phase |
| `check:place-resolve` | **42 PASS / 0 FAIL** | pure variant; `--live` not run |
| `check:agenda-topics` | **13 PASS / 0 FAIL** | |
| `check:place-entry` | **20 PASS / 0 FAIL** | browser |
| `check:explore-gate` | **64 PASS / 0 FAIL** | browser |
| `check:explore-rooms` | **21 PASS / 0 FAIL / 0 SKIP** | browser; 35 (level, room) pairs |
| `check:grants` | **1 PASS / 0 FAIL / 5 NOT RUN — exit 2** | 🔴 NOT a pass. `SUPABASE_DB_URL` is unset, so the catalog half never ran. |
| `check:anon-read` | **26 PASS / 7 FAIL / 7 NOT RUN — exit 1** | 🔴 Every FAIL is "the RPCs are not granted yet". This guard going green is the apply's definition of done. |

🔴 **The browser guards were run against a CI-LIKE server** — `npm run dev` with
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` cleared, which is what CI does on a fresh
checkout with no `.env`. A local `.env.local` changes which code path runs and hid a
permanently-red assertion during 18-03; see § 4.

## 2. Three Phase 17 assertions were retired, deliberately

Each asserted the absence of something this phase builds. In every case the claim was kept and
only the evidence moved — and in every case a positive term was added or restored, because an
assertion made only of absences is satisfied by a page that failed to load.

| Guard | Was | Is |
|---|---|---|
| `check:place-entry` #3 | zero post cards + the Phase 17 honest card | **`postCards > 0`** + zero composer affordances + the gate present |
| `check:place-entry` NET ×2 | *nothing* about a visited place reaches the database | **only the four public RPCs may**, as an allowlist; anything else still fails |
| `check:explore-gate` #7 | the honest card on a level the viewer does not hold | **`hasPosts`** + `data-read-only-notice="other-place"` + zero write controls |

`check:place-entry` #3's `readOnly` probe was also changed from a copy match to a structural
one when 18-04 replaced the notice: the exact sentence is pinned where it can be read without
a browser (`check:write-access` 49 and 50), and the browser asserts that the gate is present.

🔴 **And `check:explore-gate` stopped transcribing prose for the feed and thread**, because
editing it was becoming a habit — three times in this phase a guard went red for a copy change
rather than a behaviour change. The **feed/thread** vocabulary is now derived from
`replyClosedCopy` at run time, which is why the script runs under
`--experimental-strip-types`. **Explore's is still hand-written** against `ReadOnlyNotice`,
and five of the six `namesReason` call sites use it — so this is a partial fix, not a general
one. The word check still earns its keep either way: `notice.reason` comes from a data
attribute, so without it a notice could carry the right attribute and the wrong sentence.

🔴 **What is and is not pinned, stated plainly, because the first draft of this section
overstated it.** `check:write-access` 49, 50 and 52 pin the `signed-out` sentence and label
verbatim and forbid account/sign-in wording on `other-place`. They run the *function*, never a
call site. The `sibling-shard` and `no-slice` sentences are asserted only structurally. The
browser guards now assert that the feed notice carries the reason `signed-out`
(`check:place-entry` #3) and that the THREAD notice is the visible one
(`check:explore-gate` assertion 10's precondition) — both of which were missing until the
whole-branch review found that deleting `ThreadView`'s notice, or nulling `noWriteReason`,
left every guard green.

🔴 **Explore keeps its own vocabulary, and the first attempt at this flattened that.**
Deriving *every* surface from `replyClosedCopy` turned four Explore assertions red against
copy that is correct: Explore still renders `ReadOnlyNotice`, deliberately, and its sentences
are about drafting and exploring a shard rather than replying. `namesReason` now takes the
vocabulary as a parameter — `REPLY_WORDS` for the feed and thread, `EXPLORE_WORDS` for
Explore. The one place prose is still transcribed is the one surface whose copy does not live
in a function.

### The two guard fixes are mutation-proven, not just read

The whole-branch review found both of these regressions passing every guard in the repo. Each
fix was then verified by reproducing the exact regression and watching the intended assertion —
and only that assertion — go red.

| Mutation | Guard | Result |
|---|---|---|
| `noWriteReason={null}` on the public feed — no sentence, no explainer button, i.e. 18-04's whole surface gone | `check:place-entry` | **#3 red, and only #3** (19/1) |
| `ThreadView`'s `<ReplyClosedNotice>` deleted, composer still suppressed | `check:explore-gate` | **#10 red on city AND federal, nothing else** (62/2) |

🔴 **Mutation A also broke `tsc` — and that is not the safety net it looks like.** The build
failed only on two now-unused identifiers (`TS6133`). Anyone actually removing that notice
would remove its import too, and the build would be clean while a member on a sibling-shard
thread got no composer and no explanation. The guard is the only thing that catches it.

🔴 **The first attempt at mutation B tested nothing**: the dev server had been killed during
cleanup, so the guard ran against a dead port and produced no result line at all. The *empty*
output was the tell — a check for "no FAIL lines" would have read a dead server as a pass,
which is the same vacuous shape as everything else in § 4. Both mutations were re-run against
a live server, and the tree was verified clean between and after each.

## 3. Four-way visual evidence

Light + dark × desktop + mobile, with the `ev_theme` cookie set on the browser context and
`documentElement.classList.contains('dark')` asserted to match **before** every shot —
Playwright's `colorScheme` option does nothing in this app.

| Screen | What was looked at |
|---|---|
| A visited place's feed, signed out | Three posts render; mixed author visibility; one read-only notice, not two |
| A public thread, signed out | A narrow-projection reply with a **wide reply nested under it** — the case that breaks if `parent_reply_id` is dropped for unidentified authors |
| The closed door, feed and thread | Teal outline, no fill, no coral; hit-tested with `elementFromPoint` (resolves to itself); contrast by canvas `fillRect` + `getImageData` |
| `/accounts`, signed out, no referrer | Renders standalone; all three tiers; both ceilings; a way back; no login form |

**Contrast, resolved by painting** — never by reading `ctx.fillStyle`, which hands the
`oklch()` string back and reports ~1:1 for legible text:

| | button text | button border | sentence |
|---|---|---|---|
| light | 6.37 | 6.37 | 7.23 |
| dark | 7.13 | 7.13 | 12.05 |

Thresholds: 4.5:1 for text, 3:1 for the border. Both themes clear both.

🔴 **The signed-in production pass still cannot be done on localhost**, as in Phases 15, 16
and 17: there is no local login, so `AppShell`'s real `photoUrl`/credit precedence and real
sibling shards are unverified here. Unchanged by this phase, and still outstanding.

## 4. Two defects the numbers called clean

Both were found by looking at an image, with every assertion green.

- **18-03 shipped two identical read-only banners, stacked** — one from `AppShell` and one
  from the panel. No assertion counts a component that renders correctly twice.
- **18-04's notice rendered as a light grey block on a near-black page**, with barely legible
  text, while the contrast probe reported it fine. Two bugs on top of each other: the probe
  skipped the box's own semi-transparent background and measured an ancestor; and
  `dark:bg-white/[0.03]` never applied at all.

  🔴 **The first explanation recorded here was wrong, and is corrected.** It said a `dark:`
  variant carries no extra specificity in Tailwind v4, so a base utility emitted later wins.
  Measured in the built CSS, that is false: every `dark:` rule sits in a **trailing block**
  (`.dark\:bg-white\/5` at offset 78942) long after every bare utility (`.bg-gray-50` at
  27652, last bare `bg-*` at 29777), so a `dark:` variant always wins on order.

  The real cause was a **stale dev server**: it was started before `ReplyClosedNotice.tsx`
  existed, and classes new to the whole project were missing from its generated CSS, while
  `bg-gray-50` — already used elsewhere — applied normally. That asymmetry is what made it
  look like a cascade problem. Proved by putting `dark:bg-white/5` back and probing a freshly
  started server: `oklab(… / 0.05)`, correct. The lesson is to restart the dev server after
  adding a component, before trusting any screenshot or computed-style probe.

An earlier run of the same probe reported dark contrast as 2.42/1.51/1.43 — pure measurement
error, because Tailwind serialises backgrounds as `oklab(... / a)` and the "is this opaque"
test only matched `rgba(`. CLAUDE.md says a ratio near 1:1 is that bug and not a finding; it
was. The instrument was wrong in both directions in one session, which is why the images are
the gate and the numbers are the corroboration.

## 5. D-24's production aggregate, re-run on the day

Counts only, read-only, no row content — the same method and the same sign-off as 2026-10-26.

| | 2026-10-26 | 2026-10-31 |
|---|---|---|
| connected profiles | 11 | **11** |
| with an avatar | 0 | **0** |
| matching a real-name shape | 0 | **0** |
| suspended | — | 0 |
| live posts | 12 | **12** |
| live replies | 8 | **8** |
| distinct post authors | 7 | **7** |
| `slices` rows | 15 | **15** (14 public, 1 volunteer) |
| blocks | — | **0** |
| friendships (`FRIEND`) | — | **0** |

🔴 **Identical on every measure D-42 was signed off against**, so the accepted risk is still
the risk that was accepted. D-24's two riders stand: re-run this immediately before the
migration, and add handle validation in ev-accounts so the next real name cannot arrive
silently.

🔴 **Two new facts, and they matter.** There are **zero blocks and zero friendships** in
production. So D-49's friendship exception and D-50's block filter are both unexercised: the
first real test of either is the first friendship or block anyone creates, after the door is
open. Neither can be verified by applying the migration.

## 6. What shipped, and what did not

**Shipped (written, reviewed, unapplied):** the `public.*` reconcile and the grant-surface
guard (18-01) · four anon-executable RPCs, two internal helpers, the allowlist gate and the
D-50 block filter (18-02) · the frontend read path, the per-author projection and the fourth
`locatePost` outcome (18-03) · the closed door and the `/accounts` explainer (18-04).

**Did not ship, carried forward:**

- **Search-engine indexing and link unfurling (D-25).** No SSR, no prerender, no `robots.txt`.
- **The Empowered cross-shard reply (D-21, D-40).** The seam is reserved in `whyNoWrite` and
  `replyClosedCopy` has the sentence; nothing else exists. → a future phase.
- **The per-author sharing store (D-45).** → a future phase.
- **A federal or unified public post has no working deep link for a signed-out visitor.**
  `ResolvedPlace.state` is not nullable and a placeless slice names no state, so
  `placeForPublicPost` returns null rather than inventing one. City, county and state work.
- **The tier model has two disagreeing definitions** — the primer's additive child records
  versus `connected_profiles.tier`. Recorded in `AccountsExplainer.tsx`, deliberately not
  resolved here; it belongs to ev-accounts.
