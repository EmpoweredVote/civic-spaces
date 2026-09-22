interface EmpoweredBadgeProps {
  className?: string
}

export default function EmpoweredBadge({ className = '' }: EmpoweredBadgeProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`w-4 h-4 text-red-500 flex-shrink-0 ${className}`}
      aria-label="Empowered civic leader"
      role="img"
    >
      <title>Empowered civic leader</title>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
