const LOCATION_SETTINGS_URL = 'https://app.empowered.vote/settings/location'

/**
 * What a member sees when their account has no jurisdiction yet.
 *
 * 🔴 There is deliberately no address field here. Civic Spaces never geocodes
 * and never stores a location — identity and location live in ev-accounts, and
 * this app only reads the slices that come back. An input here would either
 * have to geocode (which this repo does not do) or forward the text to the
 * accounts app, which already asks for it properly, with validation and the
 * privacy controls that belong beside it.
 *
 * It replaces the older dismissible banner, which could be dismissed down to a
 * completely blank page — the one state in which a member has no way forward.
 */
export default function LocationPrompt() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted dark:bg-brand/15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-brand dark:text-brand-light"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.5-7-10.5a7 7 0 1114 0C19 15.5 12 21 12 21z" />
            <circle cx="12" cy="10.5" r="2.5" />
          </svg>
        </span>

        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Add your address to join your civic spaces
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Your city, county, state and federal spaces are set by where you live. Add
          your address to your Empowered Vote account and they will appear here.
        </p>

        <a
          href={LOCATION_SETTINGS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-brand-btn px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          Add your address
        </a>

        <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Civic Spaces never sees or stores your address. It stays in your
          Empowered Vote account, which tells this app only which communities
          you belong to.
        </p>
      </div>
    </div>
  )
}
