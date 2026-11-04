# The volunteer community as the team's discussion hub

2026-11-04. What changed on the Volunteer tab, how access works today, what the backend
does not support yet, and what a team discussion space would still want — kept separate
from the build so it does not become a Discord rebuild by accident.

## What it is now

- **Named as the team.** Nav rail and phone tab read "Volunteer team"; the banner reads
  "Volunteer community · Empowered.vote volunteer team". It stays under **Community** in
  the rail, apart from the fixed civic spaces (City → Unified), so the distinction between
  a place and an additional community is unchanged.
- **Branded.** The stock Unsplash photo (someone else's event) and the ❤️ are gone. The
  banner is the EV teal ground with the EV logo on a white plate and the EV mark as a
  quiet watermark; the nav row uses the EV mark (`/favicon.png`). No new assets.
- **An "Invite only" chip** on the banner states today's rule, with the detail behind it.
- **Team discussion quick starts** above the feed: Share an update, Ask the team, Propose
  an idea, Post meeting notes. Each opens the ordinary composer with a title prefix and a
  few labelled lines. They are plain posts — no new backend.

Nothing about privacy changed. Volunteer is outside `PUBLIC_SLICE_TYPES` (D-27), the
public RPCs refuse it, and every write still needs membership.

## How access works today (invite-only)

Access is a **platform role in ev-accounts**, not anything in this repo:

1. Someone with the role is a volunteer (`checkVolunteerRole` — `getCachedUserRoles` +
   `checkRole`, per the slice-splitting design §6).
2. The slice-assignment engine (`POST /api/civic-spaces/assign`, fired on app load)
   calls `assignVolunteerIfEligible`, which adds them to the single volunteer slice.
3. When the role is gone, the next assignment run removes the membership.

The UI follows membership: the tab shows only when `slices['volunteer']` exists.

## Missing backend support — for Chris

| Gap | Effect today | What would close it |
|---|---|---|
| **No way to invite from Civic Spaces** | Granting the role happens in ev-accounts, outside this app. A team lead cannot add someone from here. | An admin path in ev-accounts to grant/revoke the volunteer role, or an invite endpoint the team can call. Decide who may grant it. |
| **Revocation waits for the next assignment run** | Someone whose role is removed keeps access until they next load the app (the assign POST is fire-and-forget on load). | Revoke the `slice_members` row when the role is removed, server-side, rather than on the member's next visit. |
| **Joining waits for the next assignment run too** | A newly invited volunteer sees nothing until they reload. | Same server-side hook on grant; or have the client re-run assignment after a role change. |
| **No "who is on the team" view scoped to this space** | Member Directory is platform-wide. | A members list for the volunteer slice (names only, members-only RLS). |
| **Topics are not stored on posts** | A quick start's type lives only in its title prefix ("Update:"). | The `topic_id` column already asked for in `explore-local-starters.md` would serve here too. |

## Future discussion capabilities — not built, on purpose

Listed so they can be prioritised separately. None of these exist in the backend today.

1. **Pinned posts** — a team handbook or "start here" post that stays at the top.
2. **Announcements vs discussion** — a post type that only leads can make.
3. **Project or working-group threads** — lightweight grouping, not chat channels.
4. **@mentions with notifications** — the notification system exists; mentions do not.
5. **Reactions / quick acknowledgements** — "seen it" without a reply.
6. **Attachments** — documents and images on a post (needs storage policy for a
   members-only space).
7. **Meeting scheduling** — dates on a post, or a link to a shared calendar.
8. **Server-side search** — the feed search only searches posts already loaded.
9. **Read state** — what is new since you last visited.

Real-time chat, direct messages and voice are deliberately out of scope: that is the
Discord replacement this space should not become.

## If the space opens later

The design already reads correctly for a public audience: the banner names the team, the
quick starts describe what the space is for, and the access line states today's rule
without promising it. Opening it would mean adding `volunteer` to the public allowlist
(SQL and `writeAccess.ts`, pinned by `check:write-access`) and changing the 🔒 chip and
the hub's access line — `VOLUNTEER_ACCESS` in `HeroBanner.tsx` and the last line of
`VolunteerHub.tsx`.
