/**
 * The Civic Spaces pin/chat-bubble mark, recoloured for the header: the pin takes
 * "Civic"'s teal (with the same dark counterpart the text uses), the bubble is white. Same geometry as assets/tools/civic-spaces-symbol-*.svg,
 * which the nav rail keeps in the shared tool palette (blue/yellow).
 */
export function CivicSpacesMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path
        className="fill-brand dark:fill-brand-light"
        d="M16 30.5C16 30.5 4.5 20 4.5 12.5C4.5 6.149 9.649 1 16 1C22.351 1 27.5 6.149 27.5 12.5C27.5 20 16 30.5 16 30.5Z"
      />
      <path
        className="fill-white"
        d="M11.5 6.5H20.5C22.157 6.5 23.5 7.843 23.5 9.5V14.5C23.5 16.157 22.157 17.5 20.5 17.5H15L11.25 20.75L11.9 17.45C10.001 17.2 8.5 16.03 8.5 14.5V9.5C8.5 7.843 9.843 6.5 11.5 6.5Z"
      />
      {/* Teal dots on the white bubble. Dark mode keeps the deeper teal: the light pin
          teal is too faint on white to read as dots. */}
      <g className="fill-brand">
        <circle cx="11.75" cy="12" r="1.4" />
        <circle cx="16" cy="12" r="1.4" />
        <circle cx="20.25" cy="12" r="1.4" />
      </g>
    </svg>
  )
}
