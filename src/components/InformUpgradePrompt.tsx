interface InformUpgradePromptProps {
  isOpen: boolean
  onClose: () => void
}

export default function InformUpgradePrompt({ isOpen, onClose }: InformUpgradePromptProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Join the conversation
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Create a Connected account to post, reply, and participate in your civic community.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="https://accounts.empowered.vote"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-md bg-brand-btn px-4 py-2 text-sm font-semibold text-white text-center hover:bg-brand-hover transition-colors"
          >
            Create Connected Account
          </a>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
