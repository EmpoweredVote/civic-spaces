interface SignInPromptProps {
  isAuthenticated: boolean
  loginUrl: string
}

/**
 * Anonymous-visitor sign-in nudge for the right sidebar. Renders nothing once
 * signed in — profile identity (avatar, tier, account settings) already
 * lives in the header's ProfileMenu, so this isn't duplicated here.
 */
export function SignInPrompt({ isAuthenticated, loginUrl }: SignInPromptProps) {
  if (isAuthenticated) return null

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Sign in to post, reply, and see your civic community.
      </p>
      <a
        href={loginUrl}
        className="inline-flex items-center justify-center w-full px-4 py-2 bg-brand-btn text-white text-sm font-semibold rounded-full hover:bg-brand-hover transition-colors"
      >
        Log in
      </a>
    </div>
  )
}
