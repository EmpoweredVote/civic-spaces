interface FABProps {
  onClick: () => void
  disabled?: boolean
}

export default function FAB({ onClick, disabled }: FABProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Create new post"
      style={{
        position: 'fixed',
        bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))',
        right: '1.5rem',
        zIndex: 50,
      }}
      className={[
        'w-14 h-14 rounded-full bg-brand-btn text-white shadow-lg flex items-center justify-center text-2xl',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-brand-hover hover:scale-105 transition-all',
      ].join(' ')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  )
}
