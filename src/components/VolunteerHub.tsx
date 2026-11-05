import type { ComposeRequest } from './PostComposer'
import { FOCUS } from './explore/exploreUi'
import { Emoji } from './Emoji'

/**
 * The volunteer team's quick starts, above its feed.
 *
 * 🔴 Ordinary posts, nothing more. Each button opens the same composer the Post
 * button does, with a title prefix and a few labelled lines to fill in — the
 * structure a team update or a set of meeting notes needs, using only what
 * `civic_spaces.posts` already stores (a title and a body). There is no post
 * type, channel or pin behind it, because the backend has none; those are listed
 * as future work in .planning/research/volunteer-hub.md rather than faked here.
 *
 * Written so it reads the same if the space is ever opened to the public: it
 * describes what the space is for, and the access line states today's rule
 * without promising it.
 */

interface QuickStart {
  key: string
  emoji: string
  label: string
  hint: string
  request: () => ComposeRequest
}

/** "4 November 2026", for a meeting-notes title. Local date — the meeting was local. */
function today(): string {
  return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

const QUICK_STARTS: readonly QuickStart[] = [
  {
    key: 'update',
    emoji: '📣',
    label: 'Share an update',
    hint: 'What you worked on and what is next',
    request: () => ({
      title: 'Update: ',
      body: 'What I worked on:\n\nWhat’s next:\n\nWhere I could use help:\n',
    }),
  },
  {
    key: 'question',
    emoji: '🙋',
    label: 'Ask the team',
    hint: 'A question anyone on the team can answer',
    request: () => ({ title: 'Question: ', body: '' }),
  },
  {
    key: 'idea',
    emoji: '💡',
    label: 'Propose an idea',
    hint: 'Something the team could try',
    request: () => ({
      title: 'Idea: ',
      body: 'The idea:\n\nWhy it would help:\n\nWhat it would take:\n',
    }),
  },
  {
    key: 'notes',
    emoji: '📝',
    label: 'Post meeting notes',
    hint: 'Decisions and next steps, written down',
    request: () => ({
      title: `Meeting notes — ${today()}`,
      body: 'Who was there:\n\nWhat we decided:\n\nNext steps (who, by when):\n',
    }),
  },
]

export function VolunteerHub({ onCompose }: { onCompose: (request: ComposeRequest) => void }) {
  return (
    <section
      aria-labelledby="volunteer-hub-title"
      className="rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 p-4 sm:p-5"
    >
      <h2 id="volunteer-hub-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
        Team discussion
      </h2>
      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
        Plan together, keep each other posted, and ask for help. Start with one of these:
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {QUICK_STARTS.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={() => onCompose(q.request())}
            className={`flex min-h-[2.75rem] items-start gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5 text-left hover:border-brand/40 hover:bg-brand-muted dark:hover:border-brand-light/30 dark:hover:bg-brand/10 motion-safe:transition-colors ${FOCUS}`}
          >
            <Emoji symbol={q.emoji} className="mt-px text-[15px]" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{q.label}</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400">{q.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        <Emoji symbol="🔒" className="text-[12px]" />
        <span>
          Only Empowered.vote volunteers can see this space. Keep personal contact details and private matters out of posts.
        </span>
      </p>
    </section>
  )
}
