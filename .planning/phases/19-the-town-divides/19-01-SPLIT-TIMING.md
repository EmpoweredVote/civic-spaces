# How long a 6000-member split actually takes

Measured 2026-11-02, against the question `19-01-APPLY.md` "Still to do" item 1 asks and
ev-accounts#1281 is blocked on: **does a split fit inside the 10s `statement_timeout` on the
pool that serves `POST /api/civic-spaces/assign`?**

**Answer: sometimes, and the margin is thinner than it looks. A quiet or ordinary
jurisdiction splits in well under a second. A busy one does not, and the failure is silent
and permanent.** Two triggers that have nothing to do with splitting account for two thirds
of the cost, and one of them is a correctness bug on its own.

## How it was measured

A throwaway local cluster, `fsync=on` and `synchronous_commit=on` (deliberately **not** the
faster unsafe settings — this question deserves a conservative answer). Schema restored from
a **schema-only** `pg_dump -n civic_spaces` of production, asserted to contain zero
`COPY`/`INSERT` lines; 12 tables, 11 triggers, 29 indexes, 24 functions. The `split_slice`
under test is therefore the exact deployed definition, not a local copy. Every row of content
is generated — no production row was copied. Cluster and dump destroyed afterwards.

Each scenario runs on a **truncated database**, because the first version of this benchmark
appended to the same tables each time and every later measurement sat on a bigger table than
the one before it. Harness: `scripts/rehearsal/19-01-split-bench.sql`.

🔴 **These are lower bounds.** Local x86 with an NVMe disk, one connection, no concurrent
load. Production is Supabase on shared aarch64 with network-attached storage. Assume
production is some multiple slower; nothing here measures that multiple.

## The numbers

6000 members, 3000 moved, default 14-day seed window, all triggers enabled as in production.

| jurisdiction | posts in window | replies copied | **split takes** |
|---|---|---|---|
| silent | 0 | 0 | **78 ms** |
| quiet, ~10 posts/day | 140 | 840 | **244 ms** |
| active, ~60 posts/day | 840 | 5,040 | **1,127 ms** |
| busy, ~200 posts/day | 2,800 | 16,800 | **3,362 ms** |
| heavy, ~600 posts/day | 8,400 | 50,400 | **10,084 ms** |

**The 3000-member move is not the problem.** It is 78 ms — the `ORDER BY joined_at DESC,
user_id DESC LIMIT 3000` plus the UPDATE, on an indexed column, is nothing. Item 4 of "Still
to do" worries about that `UPDATE` holding the parent's row lock; at 78 ms it does not need
batching. **The seed is the whole cost**, and it is linear in copied replies at roughly
**0.2 ms per reply**.

So the local ceiling is about **46,000–50,000 replies** in the seed window. On production
hardware it is lower by whatever the hardware multiple is: at 3× slower, the **busy** row
above (3.4 s here) is already at ~10 s there.

## What the time is actually spent on

Same fixture, 2,800 posts / 16,800 replies, triggers disabled one at a time **after** the
fixture is built:

| configuration | time | what that trigger costs |
|---|---|---|
| all triggers on (production) | 3,535 ms | — |
| `reply_notification` off | 2,351 ms | **1,184 ms — 33%** |
| `reply_notification` + `trg_reply_count` off | 1,142 ms | **1,209 ms — 34%** |

**Two thirds of a split is trigger overhead from triggers that exist for live replies and
have no business firing on an archival copy.** On the heavy scenario, suppressing both takes
the split from **10,213 ms to 2,640 ms — 3.9× faster**, which moves the ceiling from ~46,000
replies to ~185,000.

🔴 An earlier version of this comparison measured nothing: `bench.build` ends with
`ALTER TABLE ... ENABLE TRIGGER USER`, so triggers disabled *before* the build were silently
re-enabled and every "disabled" run still fired. The tell was the notification count coming
back non-zero in a run that should have produced none. Disable after the build, and check the
side-effect count, not just the clock.

## 🔴 A correctness bug, found by reading the trigger list

> **Fixed 2026-11-02 in `20261102000300_no_notify_on_fork.sql`** (issue #145), by making
> `notify_on_reply` return early on `forked_from IS NOT NULL`. Pinned by S13/S14/S15 in
> `19-01-split-seed.sql`, written first and watched failing. Applied to production 2026-11-02.
> The rest of this section is left as it was written, because it is the measurement.

`reply_notification` fires `AFTER INSERT` on **every copied reply**. The copy keeps the
original byline, so the copied post's owner is the original author — and they get notified.

A split of the busy jurisdiction created **2,800 notification rows**: one per seeded post, to
its original author, with `event_count` counting the copied replies underneath it. So the
moment a town divides, every member who posted in the last fortnight is told they have new
replies. They do not. The replies are forks of conversations that already happened, and
`reference_id` points at the **copy**, so following the notification lands them in a slice
they may not even belong to.

This is not a performance issue — it is 33% of the time, but it would be worth fixing at 0%.
It is also not covered by any rehearsal: `19-01-split-seed.sql` asserts what lands in
`posts` and `replies`, and never looks at `notifications`.

## What a timeout does

Reproduced directly: heavy fixture, `SET statement_timeout='10s'`, `split_slice` issued as
its own top-level statement exactly as the engine issues it.

- It is **cancelled at 10 s with SQLSTATE 57014**, inside the reply-copy statement.
- **The rollback is clean.** Afterwards: 1 slice for that geoid, all 6,000 members still in
  it, 0 forked posts. No half-split, no orphaned sibling, no partially-moved member. The
  function is atomic and that property holds under cancellation.

So the immediate failure is safe. **The consequence is not.** `openNextSliceForGeoid` treats
any non-`P0001` failure as "degrade, do not wedge" and opens an **empty overflow sibling** —
and that empty slice becomes the frontier, so the jurisdiction **never splits again**. A
jurisdiction busy enough to need splitting is exactly the one that times out, and the
punishment for being busy is the empty room this entire phase exists to prevent. It fails
closed in the safe direction and permanently in the wrong one, with nothing but a log line.

## What this means for ev-accounts#1281

The design is right that `split_slice` cannot live in the assign request, and the measurement
says why in numbers: **the thing that decides whether it fits is how busy the jurisdiction
is, and busy jurisdictions are the ones that split.** Recommendation, cheapest first:

1. **Stop the two triggers firing on seeded rows.** Biggest win by far — 3.9× — and it fixes
   the notification bug and preserves `updated_at` (the S6b wart) at the same time.
   `ALTER TABLE ... DISABLE TRIGGER` takes an ACCESS EXCLUSIVE lock and must not be used on a
   live table.

   **Half of this is done.** `notify_on_reply` now returns early on a forked row
   (`20261102000300`), which removes the correctness bug and the 33% it cost. The guard is
   `forked_from`, a fact about the row, rather than the session-local setting this paragraph
   originally proposed — see the runbook for why a GUC is the worse of the two.

   `trg_reply_count` — the other ~34%, and the cause of the S6b wart — is **not** done, and it
   is not the same kind of change. Suppressing it means `split_slice` must maintain
   `posts.reply_count` itself, and a mistake there opens every seeded thread reading
   "0 replies" while holding them: silent, and the exact failure this phase exists to avoid.
   It is a performance change with a correctness risk, so it belongs here, with the scheduling
   decision, and not in a bug fix. Remaining win from it alone: roughly 2×.
2. **Move the call out of the request** regardless. Even at 2.6 s the heavy case is far too
   slow for a fire-and-forget endpoint, and 1 only buys headroom — it does not make the
   placement correct. `pg_cron` is already installed in `public`.
3. **Then reconsider `p_seed_window`.** 14 days is a placeholder (§7.1), and it is the one
   knob that directly sets the cost: the seed is linear in what the window admits.

Until 1 and 2 are done, the honest statement is that splitting works and will quietly stop
working for the busiest jurisdictions, which are the ones that need it.
