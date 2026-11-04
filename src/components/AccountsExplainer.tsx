import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { FOCUS } from './explore/exploreUi'

/**
 * `/accounts` — what the three account types are, reached by pressing the closed
 * door rather than pushed in front of it.
 *
 * 🔴 D-37: THE EXPLAINER COMES AFTER THE ATTEMPT, NEVER BEFORE. First visit is not
 * a trigger; *trying to reply* is. So this page renders nothing on arrival at the
 * square, has no login form, and does not redirect on load. If you are reading this
 * because you want to show it earlier, that is the decision being reversed.
 *
 * 🔴 It must render standalone, signed out, with no referrer. It is a real URL
 * people will paste to each other, and a page that only makes sense as a modal over
 * a thread is a dead end for everyone who arrives that way. Hence the way back into
 * the square at the bottom, which is a link and not browser history.
 *
 * 🔴 THE TIER MODEL HAS TWO DISAGREEING DEFINITIONS AND THIS PAGE DEPENDS ON
 * NEITHER. `empowered-vote-primer.md` § Account Architecture says *"Presence of a
 * child record IS the tier. No record = Inform."* — tiers are additive child tables.
 * `civic_spaces.connected_profiles` instead carries a `tier text CHECK (tier IN
 * ('connected','inform'))` column, which is a status flag on a wide record: the
 * exact shape the primer says never to use. These are two different models of the
 * same fact and one of them is wrong.
 *
 * Do not reconcile them here, and do not make this page read either one. Phase 18's
 * rules are membership-based and need no tier signal at all (D-48) — the copy below
 * is descriptive prose, not a rendering of anybody's data. The discrepancy belongs
 * to ev-accounts, which owns identity; raise it there. Quietly picking one in this
 * repo would make Civic Spaces the place the platform's tier model was decided by
 * accident.
 */
export default function AccountsExplainer() {
  const [, navigate] = useLocation()

  /**
   * 🔴 Scroll to the top on arrival. Nothing else does: `App.tsx` HIDES the shell
   * rather than unmounting it, so the document collapses to this page's height and
   * the browser merely clamps the existing `scrollY`. A reader who pressed the door
   * at the bottom of a long thread — which is where the door lives — landed below
   * the heading that says what they are looking at, and on a phone near the footer.
   */
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Account types on Empowered Vote
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-gray-300">
          Reading a civic space is open to everyone. Taking part in one — posting, replying,
          voting — needs a Connected account, and it happens in the spaces where you live.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <Tier
            name="Inform"
            tagline="No account needed"
            body="Everything built to help you vote responsibly, faster: the issue compass, your
                  representatives, elections and meetings near you, bills, budgets and trivia.
                  Open to anyone, including you right now. You can read civic conversations
                  here too — you just cannot join one."
          />
          <Tier
            name="Connected"
            tagline="Needed to take part in Civic Spaces"
            body="A verified, pseudonymous membership of the communities you actually live in.
                  You pick a display name; your legal identity stays private. That privacy is
                  protection — from a neighbour, an employer, or someone who means you harm —
                  and it is not cover for being awful to people: there is a record behind every
                  account, and moderation uses it."
          />
          <Tier
            name="Empowered"
            tagline="For people who stand for something publicly"
            body="An extension of Connected, never a separate identity, for candidates and civic
                  leaders. Empowered members appear under their real names and their positions
                  become public and searchable. The trade is explicit: privacy for influence.
                  It never costs money to Connect or Empower an account."
          />
        </div>

        {/* 🔴 The two actual ceilings, said plainly, because a reader who presses the
            door and is told only "get a Connected account" hits both of these next
            and has to work out why on their own. */}
        <section className="mt-8 rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-gray-900">
          <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Two things worth knowing before you start
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
              Connected needs an address.
            </strong>{' '}
            Not to publish it — it is encrypted, and it is never shown to anyone. It is how we
            work out which city, county and state you belong to, because a civic space is only
            meaningful if the people in it actually live under that government.
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {/* D-39, and the part a reader will be surprised by. */}
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
              You reply where you live.
            </strong>{' '}
            A Connected account can read any public civic space, and can post in its own. If you
            are reading a question from another city and cannot answer it, that is the rule
            working, not a fault — the people who live under a government are the ones who get
            to speak in its space.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="https://app.empowered.vote"
            className={`inline-flex items-center rounded-xl border border-brand px-4 py-2 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/5 ${FOCUS} dark:border-brand-light dark:text-brand-light dark:hover:border-brand-light dark:hover:bg-brand-light/10`}
          >
            Set up an Empowered Vote account
          </a>
          {/* Review Focus 5: a shareable URL must not dead-end. A link, not history —
              someone who pasted this in never had a previous page here. */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-gray-600 underline hover:no-underline dark:text-gray-300"
          >
            Back to the conversations
          </button>
        </div>
      </div>
    </div>
  )
}

function Tier({ name, tagline, body }: { name: string; tagline: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-gray-900">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">{name}</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {tagline}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{body}</p>
    </div>
  )
}
