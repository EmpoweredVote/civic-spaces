import type { ImagineOption } from './exploreContent'

/**
 * A small illustrated block for "Imagine a better neighborhood": hills, two houses, a
 * neighbor on the sidewalk, and a street. Every optional layer is always in the DOM and
 * fades in or out, so changing the choice animates rather than re-mounting;
 * `motion-safe:` keeps it instant for reduced-motion users.
 *
 * The caller renders the text equivalent of each change (the option's sceneText) as a
 * visible caption in a live region; this SVG carries a matching label.
 */

const FADE = 'motion-safe:transition-[opacity,transform] motion-safe:duration-500 ease-out'
const GROW = { transformBox: 'fill-box', transformOrigin: 'bottom center' } as const
const shown = (on: boolean) => (on ? 'opacity-100 scale-100' : 'opacity-0 scale-75')

const INK = 'fill-[#12182A] dark:fill-[#0b0f1a]'
const WINDOW = 'fill-[#6CC5D0] stroke-white dark:stroke-[#2a3446]'
const TREE_X = [24, 190, 296, 456]
const LITTER = [
  { x: 172, y: 186 },
  { x: 436, y: 184 },
  { x: 120, y: 191 },
]

export function NeighborhoodScene({ choice, label }: { choice: ImagineOption | null; label: string }) {
  const trees = choice === 'trees'
  const crossing = choice === 'crossings'
  const spaces = choice === 'spaces'
  const clean = choice === 'clean'

  return (
    <svg viewBox="0 0 480 240" role="img" aria-label={label} className="block w-full h-auto">
      {/* Sky, sun, cloud */}
      <rect width="480" height="240" className="fill-[#DDF1EC] dark:fill-[#10282d]" />
      <circle cx="416" cy="44" r="18" className="fill-brand-yellow" />
      <g className="fill-white dark:fill-[#2b4247]">
        <ellipse cx="78" cy="56" rx="22" ry="11" />
        <ellipse cx="96" cy="50" rx="16" ry="13" />
        <ellipse cx="112" cy="58" rx="18" ry="9" />
      </g>

      {/* Hills */}
      <path d="M0 176 L0 128 L64 96 L120 150 L212 60 L300 150 L352 108 L480 172 L480 176 Z" className="fill-[#9ECBB0] dark:fill-[#1d4a3c]" />

      {/* House 1 — cream, teal roof */}
      <rect x="58" y="126" width="100" height="50" className="fill-[#FBF1D9] dark:fill-[#3a3a34]" />
      <polyline points="44,134 108,94 172,134" fill="none" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" className="stroke-[#0F7A74] dark:stroke-[#1f9a92]" />
      <rect x="70" y="138" width="18" height="14" strokeWidth="2" className={WINDOW} />
      <rect x="128" y="138" width="18" height="14" strokeWidth="2" className={WINDOW} />
      <rect x="97" y="146" width="22" height="30" className={INK} />

      {/* House 2 — pink, coral roof */}
      <rect x="318" y="136" width="86" height="40" className="fill-[#F6DACE] dark:fill-[#4a3a38]" />
      <polyline points="304,142 361,106 418,142" fill="none" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-coral" />
      <rect x="328" y="146" width="16" height="13" strokeWidth="2" className={WINDOW} />
      <rect x="380" y="146" width="16" height="13" strokeWidth="2" className={WINDOW} />
      <rect x="352" y="152" width="18" height="24" className={INK} />

      {/* Sidewalk and street */}
      <rect y="176" width="480" height="22" className="fill-[#E8DDD0] dark:fill-[#3b3f4a]" />
      <rect y="198" width="480" height="42" className="fill-[#646E80] dark:fill-[#262c38]" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={6 + i * 30} y="217" width="16" height="3" rx="1.5" className="fill-brand-yellow" />
      ))}

      {/* Safer crossings: a bright crosswalk */}
      <g className={`${FADE} ${crossing ? 'opacity-100' : 'opacity-0'}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={226 + i * 13} y="199" width="7" height="40" className="fill-white dark:fill-gray-200" />
        ))}
      </g>

      {/* Welcoming public spaces: benches and a shared table */}
      <g className={`${FADE} ${shown(spaces)}`} style={GROW}>
        {[18, 420].map((x) => (
          <g key={x} className="fill-brand dark:fill-brand-light">
            <rect x={x} y="178" width="34" height="5" rx="2" />
            <rect x={x} y="170" width="34" height="4" rx="2" />
            <rect x={x + 3} y="183" width="3" height="10" />
            <rect x={x + 28} y="183" width="3" height="10" />
          </g>
        ))}
        <path d="M170 168 Q190 150 210 168 Z" className="fill-brand-coral" />
        <rect x="189" y="167" width="2.5" height="16" className="fill-gray-600 dark:fill-gray-300" />
        <rect x="174" y="182" width="32" height="4" rx="1.5" className="fill-[#0F7A74] dark:fill-brand-light" />
      </g>

      {/* More trees and shade */}
      <g className={`${FADE} ${shown(trees)}`} style={GROW}>
        {TREE_X.map((x) => (
          <g key={x}>
            <ellipse cx={x + 8} cy="190" rx="22" ry="4" className="fill-gray-900/15 dark:fill-black/40" />
            <rect x={x - 3} y="156" width="6" height="32" rx="1.5" className="fill-[#8a5a3b]" />
            <circle cx={x} cy="146" r="17" className="fill-[#3f9a5a] dark:fill-[#3a8a52]" />
            <circle cx={x - 10} cy="156" r="10" className="fill-[#4fb06a] dark:fill-[#46a060]" />
            <circle cx={x + 10} cy="156" r="10" className="fill-[#4fb06a] dark:fill-[#46a060]" />
          </g>
        ))}
      </g>

      {/* A neighbor on the sidewalk */}
      <g className="stroke-[#12182A] dark:stroke-gray-200" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M262 162 V176 M262 176 L254 188 M262 176 L270 188 M254 168 H270" />
      </g>
      <circle cx="262" cy="155" r="6" strokeWidth="2.5" className="fill-brand-coral stroke-[#12182A] dark:stroke-gray-200" />

      {/* Litter — present until "Cleaner streets" is chosen */}
      <g className={`${FADE} ${clean ? 'opacity-0' : 'opacity-100'}`}>
        {LITTER.map((l) => (
          <rect key={`${l.x}-${l.y}`} x={l.x} y={l.y} width="7" height="7" transform={`rotate(45 ${l.x + 3.5} ${l.y + 3.5})`} className="fill-brand-coral" />
        ))}
      </g>
    </svg>
  )
}

/** The featured topic's fallback illustration: a sidewalk walk, drawn rather than a stock photo. */
export function WalkingScene() {
  return (
    <svg viewBox="0 0 240 160" aria-hidden="true" className="block w-full h-full" preserveAspectRatio="xMidYMid slice">
      <rect width="240" height="160" className="fill-brand-muted dark:fill-[#0d2230]" />
      <circle cx="196" cy="30" r="14" className="fill-brand-yellow/80 dark:fill-brand-yellow/60" />
      <rect x="10" y="44" width="52" height="60" rx="3" className="fill-white dark:fill-gray-800" />
      <path d="M6 46 L36 24 L66 46 Z" className="fill-brand-coral/80" />
      <rect x="78" y="56" width="62" height="48" rx="3" className="fill-white dark:fill-gray-800" />
      <path d="M74 58 L109 38 L144 58 Z" className="fill-brand/70" />
      <rect x="160" y="62" width="70" height="42" rx="3" className="fill-white dark:fill-gray-800" />
      <path d="M156 64 L195 46 L234 64 Z" className="fill-brand-yellow dark:fill-brand-yellow/80" />
      <path d="M0 104 H240 V160 H0 Z" className="fill-gray-500 dark:fill-gray-800" />
      <path d="M0 104 H240 V118 H0 Z" className="fill-gray-200 dark:fill-gray-700" />
      {[20, 60, 100, 140, 180, 220].map((x) => (
        <rect key={x} x={x} y="140" width="22" height="3" rx="1.5" className="fill-white/70 dark:fill-gray-500" />
      ))}
      <rect x="150" y="66" width="3" height="40" className="fill-gray-600 dark:fill-gray-400" />
      <path d="M151 66 h12" className="stroke-gray-600 dark:stroke-gray-400" strokeWidth="3" strokeLinecap="round" />
      <circle cx="164" cy="69" r="3.5" className="fill-brand-yellow" />
      <g className="fill-brand-btn dark:fill-brand-light">
        <circle cx="70" cy="80" r="5" />
        <path d="M66 87 h8 l2 18 h-4 l-2 -9 l-2 9 h-4 Z" />
      </g>
      <g className="fill-brand-coral">
        <circle cx="88" cy="84" r="4" />
        <path d="M85 90 h6 l1.5 15 h-3 l-1.5 -7 l-1.5 7 h-3 Z" />
      </g>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={190 + i * 8} y="120" width="4.5" height="40" className="fill-white/90 dark:fill-gray-300" />
      ))}
    </svg>
  )
}
