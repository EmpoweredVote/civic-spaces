import type { ImagineOption } from './exploreContent'

/**
 * A small illustrated street for "Imagine a better neighborhood". Every layer is always
 * in the DOM and fades in or out, so changing the choice animates instead of re-mounting;
 * `motion-safe:` keeps it instant for reduced-motion users.
 *
 * Decorative by itself — the caller renders the text equivalent of each change (the
 * option's sceneText) in a live region, and this SVG carries a matching label.
 */

const FADE = 'motion-safe:transition-[opacity,transform] motion-safe:duration-500 ease-out'
const GROW = { transformBox: 'fill-box', transformOrigin: 'bottom center' } as const

function shown(on: boolean) {
  return on ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
}

const TREE_X = [34, 112, 206, 290]
const LITTER: { x: number; y: number; r: number; w: number; h: number }[] = [
  { x: 70, y: 96, r: 20, w: 7, h: 4 },
  { x: 142, y: 112, r: -25, w: 6, h: 4 },
  { x: 236, y: 97, r: 40, w: 6, h: 3 },
  { x: 262, y: 136, r: -10, w: 7, h: 4 },
  { x: 98, y: 138, r: 15, w: 5, h: 3 },
]

export function NeighborhoodScene({ choice, label }: { choice: ImagineOption | null; label: string }) {
  const trees = choice === 'trees'
  const crossing = choice === 'crossings'
  const spaces = choice === 'spaces'
  const clean = choice === 'clean'

  return (
    <svg viewBox="0 0 320 150" role="img" aria-label={label} className="block w-full h-auto">
      {/* Sky */}
      <rect width="320" height="150" className="fill-brand-muted dark:fill-[#0d2230]" />
      <circle cx="282" cy="24" r="11" className="fill-brand-yellow/80 dark:fill-brand-yellow/60" />

      {/* Houses */}
      <g>
        <rect x="14" y="48" width="56" height="44" rx="3" className="fill-white dark:fill-gray-800" />
        <path d="M10 50 L42 28 L74 50 Z" className="fill-brand-coral/80 dark:fill-brand-coral/70" />
        <rect x="35" y="70" width="14" height="22" rx="2" className="fill-brand/70 dark:fill-brand-light/60" />
        <rect x="86" y="56" width="70" height="36" rx="3" className="fill-white dark:fill-gray-800" />
        <path d="M82 58 L121 38 L160 58 Z" className="fill-brand/70 dark:fill-brand/80" />
        <rect x="96" y="66" width="12" height="10" rx="1.5" className="fill-brand-yellow/70" />
        <rect x="134" y="66" width="12" height="10" rx="1.5" className="fill-brand-yellow/70" />
        <rect x="172" y="44" width="48" height="48" rx="3" className="fill-white dark:fill-gray-800" />
        <path d="M168 46 L196 26 L224 46 Z" className="fill-brand-yellow dark:fill-brand-yellow/80" />
        <rect x="190" y="72" width="12" height="20" rx="2" className="fill-brand-coral/70" />
        <rect x="234" y="58" width="66" height="34" rx="3" className="fill-white dark:fill-gray-800" />
        <path d="M230 60 L267 40 L304 60 Z" className="fill-brand-coral/60 dark:fill-brand-coral/60" />
        <rect x="246" y="68" width="12" height="10" rx="1.5" className="fill-brand/50 dark:fill-brand-light/40" />
        <rect x="276" y="68" width="12" height="10" rx="1.5" className="fill-brand/50 dark:fill-brand-light/40" />
      </g>

      {/* Sidewalks and street */}
      <rect y="92" width="320" height="12" className="fill-gray-200 dark:fill-gray-700" />
      <rect y="104" width="320" height="28" className="fill-gray-500 dark:fill-gray-800" />
      <rect y="132" width="320" height="18" className="fill-gray-200 dark:fill-gray-700" />
      {[10, 50, 90, 210, 250, 290].map((x) => (
        <rect key={x} x={x} y="117" width="20" height="2" rx="1" className="fill-white/70 dark:fill-gray-500" />
      ))}

      {/* Safer crossings: a zebra crosswalk */}
      <g className={`${FADE} ${crossing ? 'opacity-100' : 'opacity-0'}`}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={142 + i * 6} y="105" width="3.5" height="26" className="fill-white dark:fill-gray-200" />
        ))}
      </g>

      {/* Welcoming public spaces: benches and a shared table */}
      <g className={`${FADE} ${shown(spaces)}`} style={GROW}>
        <rect x="56" y="133" width="22" height="3" rx="1" className="fill-brand dark:fill-brand-light" />
        <rect x="58" y="136" width="2" height="5" className="fill-brand dark:fill-brand-light" />
        <rect x="74" y="136" width="2" height="5" className="fill-brand dark:fill-brand-light" />
        <rect x="240" y="133" width="22" height="3" rx="1" className="fill-brand dark:fill-brand-light" />
        <rect x="242" y="136" width="2" height="5" className="fill-brand dark:fill-brand-light" />
        <rect x="258" y="136" width="2" height="5" className="fill-brand dark:fill-brand-light" />
        <ellipse cx="160" cy="141" rx="26" ry="5" className="fill-brand-yellow/40" />
        <path d="M144 128 Q160 116 176 128 Z" className="fill-brand-coral" />
        <rect x="159" y="127" width="2" height="12" className="fill-gray-600 dark:fill-gray-300" />
        <rect x="148" y="137" width="24" height="3" rx="1" className="fill-brand-btn dark:fill-brand-light" />
      </g>

      {/* More trees and shade */}
      <g className={`${FADE} ${shown(trees)}`} style={GROW}>
        {TREE_X.map((x) => (
          <g key={x}>
            <ellipse cx={x + 6} cy="101" rx="16" ry="3" className="fill-gray-900/15 dark:fill-black/40" />
            <rect x={x - 2} y="82" width="4" height="18" rx="1" className="fill-[#8a5a3b]" />
            <circle cx={x} cy="76" r="12" className="fill-[#3f9a5a] dark:fill-[#3a8a52]" />
            <circle cx={x - 7} cy="82" r="7" className="fill-[#4fb06a] dark:fill-[#46a060]" />
            <circle cx={x + 7} cy="82" r="7" className="fill-[#4fb06a] dark:fill-[#46a060]" />
          </g>
        ))}
      </g>

      {/* Litter — present until "Cleaner streets" is chosen */}
      <g className={`${FADE} ${clean ? 'opacity-0' : 'opacity-100'}`}>
        {LITTER.map((l) => (
          <rect
            key={`${l.x}-${l.y}`}
            x={l.x}
            y={l.y}
            width={l.w}
            height={l.h}
            rx="1"
            transform={`rotate(${l.r} ${l.x} ${l.y})`}
            className="fill-brand-coral/70 dark:fill-brand-coral/60"
          />
        ))}
      </g>
    </svg>
  )
}

/** The featured topic's illustration: a sidewalk walk, drawn rather than a stock photo. */
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
      {/* Sidewalk receding into the street */}
      <path d="M0 104 H240 V160 H0 Z" className="fill-gray-500 dark:fill-gray-800" />
      <path d="M0 104 H240 V118 H0 Z" className="fill-gray-200 dark:fill-gray-700" />
      {[20, 60, 100, 140, 180, 220].map((x) => (
        <rect key={x} x={x} y="140" width="22" height="3" rx="1.5" className="fill-white/70 dark:fill-gray-500" />
      ))}
      {/* Streetlight */}
      <rect x="150" y="66" width="3" height="40" className="fill-gray-600 dark:fill-gray-400" />
      <path d="M151 66 h12" className="stroke-gray-600 dark:stroke-gray-400" strokeWidth="3" strokeLinecap="round" />
      <circle cx="164" cy="69" r="3.5" className="fill-brand-yellow" />
      {/* Two people walking */}
      <g className="fill-brand-btn dark:fill-brand-light">
        <circle cx="70" cy="80" r="5" />
        <path d="M66 87 h8 l2 18 h-4 l-2 -9 l-2 9 h-4 Z" />
      </g>
      <g className="fill-brand-coral">
        <circle cx="88" cy="84" r="4" />
        <path d="M85 90 h6 l1.5 15 h-3 l-1.5 -7 l-1.5 7 h-3 Z" />
      </g>
      {/* Crosswalk */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={190 + i * 8} y="120" width="4.5" height="40" className="fill-white/90 dark:fill-gray-300" />
      ))}
    </svg>
  )
}
