import { useState } from 'react'

export default function NoJurisdictionBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 mx-4 mt-4">
      <span className="flex-1 text-sm text-amber-800">
        Add your address to join your civic community.{' '}
        <a
          href="https://accounts.empowered.vote/profile"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline hover:text-amber-900"
        >
          Update your profile
        </a>
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-amber-500 hover:text-amber-700 text-lg leading-none"
      >
        &times;
      </button>
    </div>
  )
}
