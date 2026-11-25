# vq-consensus spends ~22s and ~467 round trips every 5 minutes on a result that is zero by arithmetic

> **This is an ev-accounts finding, kept here because this is where it was diagnosed.** Written
> 2026-11-24; **not filed upstream as of that date** — Chris files these. It affects Civic Spaces
> only indirectly (the job shares `ev-accounts-api` with the endpoints this app's boot depends on,
> and the measurement below shows it does *not* block them). Code citations are `ev-accounts`
> `origin/master` at `b59105c3f`. Short version: `project_vq_consensus_noop` in the memory index.

**Where:** `backend/src/vq/jobs/consensusBatchJob.ts` → `runConsensusPass` (`:109`)
**Schedule:** every 5 minutes, in-process node-cron (`backend/src/vq/scheduler.ts:22-23`), registered as `vq-consensus` (`backend/src/jobs/registry.ts:120`)
**Runs in:** `ev-accounts-api` (srv-d6h1pahr0fns739kfjfg), single instance
**Measured:** 2026-11-23 and 2026-11-24 against production, `origin/master` at `b59105c3f`

---

## Summary

The consensus pass processes all 222 active quests on every cycle and resolves none. That is
not a transient state: **no quest in the system currently holds enough submissions to clear
the lowest threshold**, so the zero is guaranteed by arithmetic before the pass begins. The
work it does to discover this is ~467 sequential PostgREST round trips, about 22 seconds, 288
times a day.

This is a waste issue, not an outage. It does **not** block request handling (evidence below).

## Observed behaviour

Twelve consecutive cycles on 2026-11-24 (13:00–15:30 UTC), every one byte-identical:

```json
{"processedCount":222,"pendingCount":222,"resolvedCount":0,
 "conflictingCount":0,"finalizedCount":0,"message":"Consensus batch complete"}
```

Not a single other `Consensus batch:` log line in that window — no
`needs_more_human_verification`, no `bridging_failed`, no `conflicting`, no errors. So every
quest takes the plain `case 'pending'` branch (`consensusBatchJob.ts:318`).

## Why the result is zero by arithmetic

`computeConsensus` stage 2 returns `pending` when eligible submissions are below
`CONSENSUS_THRESHOLDS.LOW.min_submissions`, which is **4** (`consensus.ts:29`, checked at
`:207`).

Current state of the 222 quests the job selects:

| active quests | 0 submissions | 1–3 | **4 or more** | max on any quest |
|---|---|---|---|---|
| 222 | 200 | 22 | **0** | **2** |

```sql
select q.status, count(*) as quests,
       count(*) filter (where s.n is null)                     as zero_submissions,
       count(*) filter (where coalesce(s.n,0) between 1 and 3) as one_to_three,
       count(*) filter (where coalesce(s.n,0) >= 4)            as four_plus,
       max(coalesce(s.n,0))                                    as max_subs
from validation_quests.verification_quests q
left join (select quest_id, count(*) as n
             from validation_quests.verification_submissions group by quest_id) s
  on s.quest_id = q.id
where q.status in ('active','under_review')
group by q.status;
-- active | 222 | 200 | 22 | 0 | 2
```

200 of 222 have no submissions at all, and the busiest quest in the system has two. Nothing
can resolve until a quest reaches four.

## Where the ~22 seconds goes

**Not query cost.** Every lookup the loop performs is indexed:
`idx_submissions_quest_id`, `consensus_records_quest_id_key` (unique),
`user_veracity_profiles_pkey`.

The cost is **round-trip count**. `runConsensusPass` fetches every active quest in one query
(`:128-130`), then iterates them **sequentially** (`:147`) — deliberately, per the file header,
"to avoid connection pool exhaustion under high submission volumes" — and each iteration issues
its own PostgREST calls from `processQuest` (`:188`):

- `verification_submissions` (`:198`) — always
- `user_veracity_profiles` (`:226`) — only when the quest has submissions (`:223`)
- `consensus_records` (`:263`) — always

So, per cycle:

```
    1  quest list
  400  200 zero-submission quests x 2 (submissions, consensus_records)
   66   22 quests with 1-3 subs     x 3 (submissions, profiles, consensus_records)
  ---
  467  sequential round trips
```

At a measured 21–25 s per cycle that is ~47 ms per round trip, which is the expected
PostgREST latency Oregon → us-west-1. The arithmetic closes, which is why I am confident the
duration is round-trip count rather than anything else.

**Per day: 288 cycles x 467 ≈ 134,000 round trips**, roughly two hours of continuous
sequential querying, producing no state change. It also scales linearly with quest count, so
it gets slower as quests accumulate while remaining a no-op.

A detail worth noting: a quest with **zero** submissions still costs 2 round trips, because
`processQuest` has no early return — it fetches a `consensus_records` row for a quest that
cannot have one.

## What is NOT wrong

Stated so nobody re-investigates these:

- **It does not block request handling.** Measured 2026-11-23: 170 paced polls of a public
  endpoint across a cycle boundary returned mean 115 ms / max 559 ms, with 05:44:58.811 at
  173 ms and 05:45:01.461 at 178 ms bracketing the job start. The pass is await-heavy, so it
  yields the event loop.
- **The gating is correct.** The scheduler sits behind `VQ_CRONS_ENABLED`, which `vq/app.ts:21`
  documents as OFF during the parallel window with the standalone VQ service. That service
  (`empowered-validation-quests`) is now suspended, so the engine owning the cron is right —
  this is not a double-execution bug.
- **The overlap guard works.** `isRunning` is module-level and the API runs a single instance,
  so cycles cannot overlap.

## Suggested fix

**1. Let the database do the filtering.** The step-1 query (`:128-130`) should join submission
counts and return only quests with at least `CONSENSUS_THRESHOLDS.LOW.min_submissions` eligible
submissions. Today that set is empty, so a cycle would cost **one** query instead of 467. The
current shape fetches everything and then discovers ineligibility one round trip at a time.

Care is needed on two paths that must still run for quests the filter would exclude:

- quests with an existing `consensus_records` row awaiting the 48-hour contestation window
  (`:263` onward) — finalization must not be starved by a submission-count filter;
- quests already in `under_review` (currently zero).

A filter of the form "has ≥4 eligible submissions **OR** has a consensus_records row that is
not finalized" preserves both.

**2. Stop discarding the reason.** `computeConsensus` computes a `reason` string for every
pending verdict and `processQuest` drops it on the floor (`:318`). That string is exactly the
diagnostic that answers "why are 222 pending" — surfacing it, even aggregated by reason in the
completion log, would have made this issue observable without a database query.

**3. Worth deciding separately:** whether a 5-minute poll is the right trigger at all.
Consensus cannot change without a submission arriving, so an event-driven trigger on submission
insert — or a much longer cadence — would remove the steady-state cost entirely rather than
shrink it.

## Reproduce

**The identical cycles:** read `ev-accounts-api` (`srv-d6h1pahr0fns739kfjfg`) logs filtered on the
text `Consensus batch complete`. I read these through Render's MCP log tool, not the CLI — the
dashboard's log search on that service with the same text filter shows the same lines. (The
`render` CLI can do it too, but I have not run it that way and am not going to quote a flag set I
did not execute.)

**Nothing can resolve:** run the SQL block above, verbatim — that one I did run as written.
