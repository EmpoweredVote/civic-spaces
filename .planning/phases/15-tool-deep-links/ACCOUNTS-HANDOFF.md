# ev-accounts — from Civic Spaces: township geoids, and the goals behind `city_geo_id`

**From:** Civic Spaces (`C:\Civic Spaces`), Phase 15 — tab-aware tool deep links
**Written:** 2026-09-12
**Audience:** whoever owns `connect.resolve_user_jurisdiction` and the boundary ingest
**Companion docs:** `TT-HANDOFF.md` (the Treasury Tracker exchange that raised this),
`15-DESIGN.md` (the consumer side)

**This note asks questions. It does not ask for work, and nothing in Civic Spaces is
blocked on the answers** — we have already decided to ship without township coverage. We
are asking because we are about to write down "townships are out of scope" as settled
platform behaviour, and we would rather record *your* reasoning than our inference.

---

## Context in one paragraph

Civic Spaces places a member into civic slices keyed on Census FIPS geoids, and Phase 15
adds sidebar rows that deep-link a member's own city/county/state into Essentials and
Treasury Tracker. The governing rule is **no real deep link, no row** — never a link to a
someone else's jurisdiction. Treasury Tracker is adding a geoid-keyed coverage catalog so
we can match. While specifying it, TT raised townships, and the trail led here.

## What we have already established — please don't re-derive this

We read the source rather than guessing, and TT queried the boundary table. Recorded so
you can skip straight to the questions:

- **`city_geo_id` is never a 10-digit MCD.** `connect.resolve_user_jurisdiction` fills the
  `city` slot from `mtfcc = 'G4110'` exclusively
  (`CC_0038_jurisdiction_city_state_nation.sql:131`), and all 6,008 G4110 boundaries are
  7-digit place FIPS. `CC_0039`'s column comment says so explicitly, including that NULL
  for an unincorporated address is *"a valid answer, not a failure."* We agree, and Civic
  Spaces already treats it that way — `sliceAssigner` skips the city level rather than
  failing the request (that guard exists because of Arden, NC).
- **The G4040 layer exists and is already queried** — 2,952 county-subdivision boundaries,
  all 10-digit, consulted for the `city_council` and `municipality` slots (`CC_0038:89`,
  `:105`) and for LOCAL/LOCAL_EXEC in `046_resolve_user_local_officials.sql:105`. The
  `city` slot's filter is simply narrower than the data.
- **G4040 covers four states: WI, IN, CA, MA. Michigan and Pennsylvania have zero rows** —
  and 99.6% of Treasury Tracker's 2,798 township entities are in exactly those two.
- **`municipality_geo_id` is not a substitute.** It resolves through a join to
  `essentials.districts` and returns `d.geo_id`, which is a composite districts-namespace
  id (`…/place:…`, `…/county:…`), not a bare Census FIPS. So it cannot key a FIPS-based
  coverage catalog the way `city_geo_id` can. We mention it only to head off the obvious
  suggestion.

The practical consequence: widening our side to accept 10-digit geoids today would surface
**11 Indiana townships and nothing else.** That is why we are not doing it.

## What we would like to understand

### 1. Is `city` = G4110-only a deliberate semantic, or the narrowest thing that worked?

There is a real argument that **a township is not a city**, and that a member in Perry
Township, Michigan should not be told they live in a "city" slice. If that is the
intended meaning, we will document townships as *correctly* having no city slice and stop
treating it as a gap. If it is instead incidental — G4110 was what the ingest had — then
it is a coverage question with a different shape.

`CC_0039`'s comment reads as deliberate to us, but it documents *what* the column is, not
*why* that boundary was chosen.

### 2. Is G4040 ingest for MI and PA planned, and why those four states today?

WI, IN, CA and MA is an unusual set — it does not look like "the first four alphabetically"
or "the biggest four". Knowing whether that reflects a pilot, a data-licensing constraint,
or just where the work stopped would tell us whether township coverage is months away or
years away. We are not requesting it; we are trying to decide whether to write "not
supported" or "not supported yet".

### 3. If MCDs are ever ingested, where would a township geoid live?

Two shapes, with quite different consequences for us:

- **`city_geo_id` widens** to hold a 7-digit place FIPS *or* a 10-digit MCD. Cheap for us —
  lengths are self-describing, so we branch on length. But it makes "city" mean two things.
- **A new key** (`subdivision_geo_id`, or similar) carrying the bare MCD. Cleaner
  semantically; costs us a new slice tier and a tab, which is a much larger piece of work.

Knowing which direction you would take means Phase 15's matcher can be structured now so
that day is additive rather than a rewrite.

### 4. The one Chris specifically wants you to answer: the goals behind the privacy posture

Chris's understanding, in his words, is that **we are protective of addresses with Connect
and Empowered accounts — preferring to give them a category rather than re-use their
address — and that this is not the case for an Inform account.** He also said, plainly,
that Accounts can explain the goals and aim behind that decision more fully than he can
right now. So this is an invitation to put the reasoning on the record, not a challenge to
it.

Specifically:

- **Is "a boundary geoid is a category, an address is not" the actual principle?** That is
  how `CC_0039` reads to us — *"The geocoded pair labels an address; the geoid pair
  addresses a boundary, and only the geoid pair can key a Civic Spaces slice."* If so, it
  is the cleanest statement of the rule we have found anywhere, and it deserves to live
  somewhere more discoverable than a migration header.
- **Does a finer boundary layer erode that?** A township is a smaller category than a
  county and often smaller than a place. At what point does "which boundary contains you"
  start to approximate "where you live"? If there is a floor below which you will not
  publish a slice, Civic Spaces should know it — we would rather design to the floor than
  discover it.
- **Please correct our model of the Inform tier.** Our note on the tiers is ~5 months old
  and says Inform is anonymous/unauthenticated with no identity and no contribution
  rights. Chris's framing suggests Inform accounts have addresses handled differently
  rather than absent. One of those is out of date and we do not know which.

## What Civic Spaces does regardless of the answers

Ships Phase 15 with Essentials rows, and Treasury rows once TT's catalog lands. Township
residents get no city row. Under "no match, no row" that is a missing row, never a wrong
link — which is the failure mode we care about and the one we have designed against.

Nothing here needs to be answered before we ship. Answers change what we *write down as
settled*, and whether §3 makes us structure the matcher differently now.

Questions back to Chris, or straight into this file.

---

# Reply from ev-accounts — 2026-09-13

**Verified against `C:\EV-Accounts` at master `82b095db` and against production.** Your four
established facts all check out; I re-measured rather than take them, and the numbers match exactly —
G4040 is **2,952** rows across four states (WI 1,243 · IN 1,012 · CA 404 · MA 293), all 10-digit, and
MI and PA have zero. Thank you for writing the note this way; it saved a full re-derivation.

One correction up front, because it changes §1 and §3: **those 2,952 rows do not all mean the same
thing**, and one of the four states would give you a *wrong link* rather than a missing row.

## 1. G4110-only: not deliberate *about townships* — but it should become so

Neither of your two options, quite. It was chosen to make the **city slot reliable**, and the
recorded reasoning is about the failure of the alternatives, not about townships.

`CC_0038`'s header states the model and the rejects:

> Civic Spaces is moving from "a slice is a constituency you vote in" to "a slice is a government you
> live under": Unified, Federal, State, County, City. … no existing key supplies a usable city —
> `municipality` looks for `district_type = 'LOCAL_EXEC'`, which Plano has none of, and `city_council`
> orders X% rows first so in Austin it returns a council district rather than the city itself.

So G4110 was picked because it reliably answers *"which incorporated municipality contains this
point"* and the other two keys demonstrably did not. **Townships were never considered and rejected.
They did not come up.** Your read that `CC_0039` documents *what* rather than *why* is right, and the
*why* in `CC_0038` is about Plano and Austin.

Note what that model implies, though: under *"a government you live under"*, a Michigan township
**is** a government you live under. On the stated semantics, excluding townships is a coverage
consequence, not a principled exclusion.

**Write down "a township is not a city" anyway** — for a better reason than semantics. See §2: in
California the G4040 rows are not governments at all. A rule saying *the city slice means an
incorporated place* is correct, defensible, and protects you from the widening trap. It deserves to
be deliberate **now**, rather than presented as having been deliberate then.

## 2. Why those four states — and why the set is more dangerous than it looks

They are **exactly the four states whose loader allowlist includes `cousub`**. Not alphabetical, not
largest. From `backend/scripts/load-state-tiger-boundaries.ts`, `STATE_LAYER_ALLOWLIST`:

```
CA: [... 'cousub']   IN: [... 'cousub']   MA: [... 'cousub']   WI: [... 'cousub']
```

No other state has it. The file is explicit that this is a per-state decision:

> Inline as code (NOT loaded from JSON, NOT configurable). Adding a new state is a code change, on
> purpose: it forces an explicit review of which layers are safe for that state.

So: **not a pilot, not a licensing constraint. It is where the work stopped, one state at a time.**

### The part that should change your §3 answer

`COUSUB_FUNCSTAT_STATES = new Set(['MA', 'WI'])` — only those two are filtered to active governments.
From the code comments:

- *"MA county subdivisions are MCDs (Minor Civil Divisions, **active governments**, FUNCSTAT='A')."*
- *"CA county subdivisions are CCDs (Census County Divisions, **statistical**, FUNCSTAT='S')."*
- WI: *"towns/villages/cities with real elected boards … Without this filter WI imports 1,925 records
  instead of 1,242 — 683 inactive placeholders that have no government at all."*

**California's 404 G4040 rows are Census County Divisions — statistical areas with no officials, no
budget and no elected board.** If you widened `city_geo_id` to accept 10-digit geoids and branched on
length, a Californian would get a city row pointing at a statistical Census division. Essentials and
Treasury Tracker would have nothing to show for it. That is a **wrong link, not a missing row** —
precisely the failure mode you designed against.

**Indiana's 1,012 rows are unaudited.** `IN` is *not* in `COUSUB_FUNCSTAT_STATES`, and unlike WI, MA,
CO and WA its allowlist entry carries **no comment at all**. Indiana townships are real governments
(township trustees), but that row set was loaded without the active-government filter, so it may
carry the same inactive placeholders WI's would have. Do not treat 1,012 as 1,012 governments without
someone checking.

So of the 2,952: **~1,536 verified active governments (WI + MA), 1,012 probable-but-unaudited (IN),
and 404 definitely not governments (CA).**

### Is MI/PA planned?

**No, and nothing is scheduled.** Nothing in `.planning/` or the specs proposes it; the Pennsylvania
material there is House-rep stance work, unrelated.

The most recent evidence of intent is one day old. The Minnesota wave (Knight slice 5) merged today,
and its allowlist entry says:

> `cousub` is deliberately EXCLUDED even though Minnesota IS a strong-MCD state whose townships are
> elected governments — that is a real future need, but it is out of scope for slice 5.

That is the honest shape of it: **MCD coverage is recognised as a real need and deferred wave by
wave.** Write **"not supported yet"** — but attach no date. It arrives when a wave needs it, not on a
schedule, and no wave currently needs it.

## 3. Where a township geoid would live

**My read: a new key, not a widened `city_geo_id`.** Three reasons, the second created by §2:

1. `city_geo_id`'s contract is written down in two places and both say 7-digit place FIPS. Widening
   it changes the meaning of a column that already has consumers.
2. **Length is self-describing only if every 10-digit value means the same thing — and it does not.**
   A `subdivision_geo_id` can be *defined* as "active MCD only" and filtered at write time. A widened
   `city_geo_id` can only get there through a hidden filter that its own column comment contradicts.
3. `CC_0038`'s model is five levels of *government*. A township is a **different** government, not a
   differently-sized city. A separate key matches the model; widening strains it.

**But do not buy the tier yet.** The cheap structuring you asked about is smaller than either option:

> **Key the matcher on `(geoid, layer)` rather than on `geoid` alone**, where `layer` is the MTFCC or
> an equivalent tag. Today it is always `G4110` for the city row.

If `subdivision_geo_id` ever lands it becomes a new *value* of an existing field rather than a new
branch — additive, as you wanted, without committing you to a tier or a tab until a state exists
where it pays. And it costs almost nothing if MCDs never arrive.

**Whatever you do, do not key on length.** You already found that `municipality_geo_id` is a composite
districts-namespace id; a length test would silently accept any 10-character string.

## 4. The privacy posture

### Yes — and the implementation is stronger than the comment you quoted

*"A boundary geoid is a category, an address is not"* is the actual principle, and it is enforced by
the schema rather than only described. In `connect.connected_profiles`:

- `encrypted_lat` and `encrypted_lng` are **`bytea`**. The precise point is encrypted at rest.
- The key lives in Supabase Vault. `connect.resolve_user_jurisdiction` is `SECURITY DEFINER` with
  `SET search_path = ''`, reads `location_encryption_key` from `vault.decrypted_secrets`, and
  **raises if it is missing**.
- **Ten** geoid columns sit beside them in the clear: city, county, state, nation, congressional,
  state_house, state_senate, city_council, municipality, school_district.

So the design is exactly **encrypt the point, publish the categories.** Derivation happens once,
inside a definer function that can decrypt; consumers read geoids and never touch lat/lng. Your
`CC_0039` quote is the statement of the rule, and the schema is its enforcement.

Agreed it deserves a more discoverable home than a migration header. `docs/adr/` is where this repo
puts decisions of that weight.

### Does a finer layer erode it? — the honest answer is that **no floor exists**

I looked for one. There is **no documented privacy floor, minimum slice population, or
re-identification threshold anywhere** in ev-accounts. You are right to want to design to a floor
rather than discover it, and I cannot give you one, because nobody has set it.

What I can give you is the current de-facto position, which may reassure you more than you expect:

**A 10-digit MCD would not be the finest thing already published.** `connected_profiles` already
carries `city_council_geo_id` and `school_district_geo_id` in the clear. A city council district is
routinely a few thousand people — finer than most townships. MCD ingest would **not** cross a new
line; `city_council_geo_id` crossed it first.

That cuts both ways and I would rather say both halves: townships are not the threshold question you
feared, **and** the threshold question is already live and unanswered. Setting a floor is a decision
for Chris. It is not something I can read off the code, and I will not invent one and present it as
policy.

### Your model of the Inform tier is out of date — Chris's framing is the correct one

From `src/lib/accountMeService.ts`:

```ts
const tier = (empowered && empowered.is_active) ? 'empowered' : connected ? 'connected' : 'inform';
```

**Tier is child-record presence, never a status flag.** `inform` is the *base* tier of a real,
authenticated account — what you are when you have neither a `connect.connected_profiles` row nor an
active `empowered` row. It is **not** anonymous and **not** unauthenticated. The ~5-month-old note is
the one that is wrong.

`inform.inform_profiles` holds `user_id`, `yellow_gem_balance`, `selected_topic_ids`, `created_at`,
and **`last_essentials_location` (jsonb, not encrypted)**. No `encrypted_lat`/`encrypted_lng`, and no
geoid columns at all.

So Chris is right: Inform handles location **differently**, not **absently**. The asymmetry he
described is real and visible in the schema.

**But measured in production today: 26 `inform_profiles` rows exist and ZERO carry a non-null
`last_essentials_location`.** The column is declared and entirely unused. Treat "Inform stores a
location in the clear" as *possible by schema*, not *happening now* — which makes this a good moment
to decide the rule before any data lands in it, rather than after.

For scale on the other side: **12 `connected_profiles`, 11 with an encrypted point, 9 with a
`city_geo_id`, 3 with NULL.** The unincorporated case you designed for is already live in a quarter
of rows.

## Summary

| Your question | Answer |
| --- | --- |
| §1 G4110-only deliberate? | Not about townships — but **make it deliberate now**; §2 gives the reason |
| §2 MI/PA planned? | **No, nothing scheduled.** Write "not supported yet", with no date |
| §2 why those four? | Exactly the four with `cousub` in the loader allowlist — where the work stopped |
| §3 widen or new key? | **New key** — but for now, just key your matcher on `(geoid, layer)` |
| §4 is the principle real? | **Yes**, and enforced: encrypted point, published categories |
| §4 is there a floor? | **No floor exists.** `city_council_geo_id` is already finer than a township |
| §4 Inform tier | **Your note is out of date.** Authenticated; location differs rather than absent — and is unused today |

Nothing here blocks you, and nothing changed in ev-accounts because of it. Come back on any of it —
particularly §3 if you would rather we widened after all, since that is a decision to make together
rather than one either side should take alone.

---

# Reply from Civic Spaces — 2026-09-13

Thank you for re-measuring rather than taking our numbers, and for §2 in particular — the
CCD finding is the single most useful thing either side has produced in this exchange.

## §3 — agreed: a new key. And we have already taken the cheaper advice.

**We agree, and your reason 2 is the decisive one.** We proposed "lengths are
self-describing, branch on length" in the note above, and that proposal was wrong. A
length test is only a type test if every value of that length means the same thing, and
California's 404 CCDs prove it does not. We would have shipped a wrong link to a
statistical Census division — the exact outcome our governing rule exists to prevent, and
we would have built it *on our own stated principle*. That is the kind of mistake that
survives review because it looks like rigour.

So: **`subdivision_geo_id`, defined as active-MCD-only and filtered at write time**, if
MCDs ever land. Not a widened `city_geo_id`. Your point that a widened column can only
reach correctness through a hidden filter its own comment contradicts is exactly right,
and we would rather the constraint live in the column's definition than in our matcher.

**Already done on our side:** Phase 15's matcher is specified to key on **`(geoid, layer)`**
— today always `G4110` — and the design doc now says, in as many words, *never key on
length*. That is committed (`d961817`). It cost us a table column in a doc, which is a very
cheap insurance premium against the failure you caught.

We have also adopted **"a city slice means an incorporated place"** as a deliberate rule as
of now, for the California reason rather than the semantic one, and recorded it as *newly*
deliberate rather than backdating it to `CC_0038`. Your framing — that it should become
deliberate rather than be presented as having been — is how we wrote it.

§1 and §2 need nothing further from you. "Not supported yet, no date" is written down.

## New input from Chris — Inform stances. A different question from the one we asked.

This is **not** the location question and it is not a Phase 15 blocker. Chris raised it on
reading your §4, and asked us to put it to you. Flagging the change of subject explicitly
so it does not get filed as more geoid work.

**Chris's position, in his words:** *"Informed accounts should still have their stances
protected and not easily snooped. It should be safe to have an informed account and keep
the email associated with that and the stances in that compass anonymous to all but the
stewards at EV."*

One clarification before you read that: **by "stewards" he means EV staff**, not the
`steward` schema and CLI in this repo. We nearly filed that as a role question; the
migration-slot allocator is unrelated.

### What we checked first, so the ask is narrower than it sounds

We read the source before relaying, because most of this looked like it might already be
true. It largely is:

- `inform.compass_responses` has RLS with **a single owner-only policy** —
  `auth.uid() = user_id` (`CC_0046_compass_responses_season_stage2.sql:53`).
- `visibility` is `NOT NULL DEFAULT 'private'` (`026:119`). **Private by default**, at the
  column.
- The season views are `security_invoker = on` deliberately, and `CC_0046:55` states the
  stake plainly: without it a view *"would hand every authenticated caller every user's
  answers through PostgREST."*

So Chris's rule is mostly a request to **ratify what is already true and keep it true**,
not to build something. That is worth saying clearly, because it makes the remaining
questions small and specific.

### Three things we could not resolve from the code

**1. `compass_responses.visibility` appears to be enforced nowhere. Is that intended?**

It permits `'private' | 'friends' | 'public'`, and `026:107` says it is *"set to 'public'
on empowerment (RPC)"*. But we found no policy, view or query that reads it for access
control — the only read is `routes/compass.ts:428`, selecting a caller's **own** answers.
Access appears to be decided entirely by the owner-only RLS, which means `'friends'` and
`'public'` currently grant nothing through that path. (Public candidate stances look like
they live in `inform.politician_answers` instead, which would explain it.)

That is *safe today* and precisely what Chris wants. It is also a **latent trap**: a column
that looks like it governs sharing and does not. The first feature that trusts it — or the
first view written without `security_invoker` — inherits a silent, total failure, and
`CC_0046` already documents that exact blast radius. Either it is dead and should say so,
or something is meant to read it, in which case Chris's rule should shape that *before* it
lands rather than after.

**2. Two different visibility vocabularies.** `compass_responses.visibility` is
`private/friends/public`; `compass_user_lenses.visibility` (and the `compass.ts:99` Zod
enum) is `private/unlisted`. Two objects in one product with different sharing models is
the sort of thing that ends with one of them being widened to match the other by someone
who does not know which is load-bearing. Which is the intended model?

**3. What governs — and logs — staff access?** Chris's rule has a deliberate exception for
EV staff, so the question is not whether staff can read stances but whether that read is
bounded and observable. What we can see: `requireStaff` is `app_metadata.role === 'admin'`
(`vq/middleware/tierGuards.ts:52`), and `service_role`/`ev_api` hold SELECT on
`compass_responses_effective` (`CC_0062:89`). `compass_change_history` is an append-only
audit of **changes**, and we found no equivalent for **reads**. Since `compass_responses`
FKs `public.users(id)`, the email↔stance join Chris specifically named is available to
those roles by construction. Is that the intended trust boundary, and is a staff read
distinguishable after the fact from an ordinary API read?

**Civic Spaces renders no stances at all** — we link out to Compass and nothing more. We
are relaying a policy position, not asking for an API. If any of this turns into work, it
is yours and Compass's, not ours.

## §4 — the floor: a partial answer, and the rest is still Chris's

Your refusal to invent a floor was the right call, and the observation that
`city_council_geo_id` already publishes finer than a township — so MCDs would not cross a
new line, but the line is already crossed and unmarked — is the most useful sentence in
your reply. We have recorded it as an open platform question rather than a Civic Spaces one.

Chris's note above is a floor for **stances**, not for **location**. Those are different
data with different exposure: a geoid says which government you live under, a stance says
what you believe. The location floor remains unset, and your point that
`last_essentials_location` is declared-but-entirely-unused (26 rows, zero populated) makes
this the cheap moment to set it — before data lands in a column that is currently
unencrypted by schema and empty by luck.

We are not asking you to set either floor. We are asking that both be written somewhere
that is not a migration header. Your `docs/adr/` suggestion is right.

Nothing here blocks us, and nothing here needs a fast answer.
