interface LoginPromptModalProps {
  isOpen: boolean
  onClose: () => void
  loginUrl: string
}

export function LoginPromptModal({ isOpen, onClose, loginUrl }: LoginPromptModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        className="relative w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="login-prompt-title" className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
          Sign in to continue
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Create an account or sign in to post, reply, and join the conversation.
        </p>

        <a
          href={loginUrl}
          className="block w-full text-center px-4 py-2.5 bg-brand-btn text-white text-sm font-semibold rounded-full hover:bg-brand-hover transition-colors"
        >
          Log in
        </a>
      </div>
    </div>
  )
}
