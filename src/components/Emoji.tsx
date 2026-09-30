/**
 * A decorative emoji icon — the playful icon style of the dashboard mockup.
 *
 * Always aria-hidden: every use sits next to a text label that already says the
 * same thing, so a screen reader announcing "house building emoji" as well would be
 * noise. The explicit emoji font stack keeps it in colour; Manrope has no emoji
 * glyphs, and some fallbacks render the monochrome text presentation instead.
 */
export function Emoji({ symbol, className = '' }: { symbol: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-shrink-0 items-center justify-center leading-none ${className}`}
      style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
    >
      {symbol}
    </span>
  )
}
