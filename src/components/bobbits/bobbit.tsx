import { useMemo } from 'react'
import { ANIMATIONS, CFG, computePose, draw } from './leremyRig'
import type { Joints } from './leremyRig'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'

/**
 * Bobbits for Civic Spaces' illustrations: the EV figure, drawn by the shared Leremy rig
 * (./leremyRig.ts, verbatim) so its proportions and line weight are the ones every other EV
 * product uses — never a hand-drawn stick figure.
 *
 * A Bobbit here is a still: one pose at one moment, rendered once to an offscreen canvas and
 * reused as an image, so it can sit inside an SVG scene and scale with it. Nothing animates,
 * which also keeps it quiet for reduced-motion users.
 */

/**
 * The brand-derived figure palette, copied from Civic-Trivia-Championships'
 * `rigExtras.ts` (FIG_COLORS / figColor) — tuned per theme for legibility.
 * 0 teal | 1 coral | 2 gold | 3 green | 4 purple | 5 orange.
 */
export const FIG_COLORS = {
  light: ['#007D99', '#FF5740', '#B8860B', '#2E9E5B', '#7A4FD0', '#E0641C'],
  dark: ['#1DA8C6', '#FF6B52', '#FFD740', '#43D07E', '#B49BFF', '#FF9A4D'],
}

export function figColor(tone: number, darkMode: boolean): string {
  const pal = darkMode ? FIG_COLORS.dark : FIG_COLORS.light
  return pal[tone % pal.length] ?? pal[0]!
}

export interface BobbitPose {
  /** A rig animation key — 'stroll', 'friendly', 'toddle', 'bored', … */
  anim: string
  /** The moment in that animation, in seconds. Picks the frame. */
  t?: number
  /** Palette tone; see FIG_COLORS. */
  tone?: number
  /** Face the other way. */
  flip?: boolean
}

export interface BobbitSprite {
  url: string
  /** Size of the cropped figure, in rig units. */
  width: number
  height: number
  /** Distance from the top of the crop to where the feet meet the ground, in rig units. */
  groundY: number
  /**
   * Distance from the top of the crop to the top of the head. Not 0 when a hand is raised
   * above it (a wave), which is why a figure's size is measured from here, not the crop.
   */
  headTopY: number
  /** Where the pelvis sits across the crop, 0–1, so a figure can be centred on its body. */
  centerX: number
}

/** Pixels per rig unit in the bitmap. High enough to stay crisp on a 2x phone at card size. */
const PX = 3

const cache = new Map<string, BobbitSprite>()

function jointPoints(j: Joints) {
  return [j.P, j.M, j.N, j.shoulderC, j.sR, j.sL, j.eR, j.hR, j.eL, j.hL, j.hipR, j.hipL, j.kR, j.kL, j.fR, j.fL]
}

/** One posed Bobbit as an image, cropped tight to the figure. Cached by pose and colour. */
export function renderBobbit({ anim, t = 0, tone = 0, flip = false }: BobbitPose, darkMode: boolean): BobbitSprite | null {
  if (typeof document === 'undefined') return null
  const color = figColor(tone, darkMode)
  const key = `${anim}|${t}|${color}|${flip}`
  const hit = cache.get(key)
  if (hit) return hit

  const animation = ANIMATIONS[anim]
  if (!animation) return null
  const j = computePose(animation.frame(t), CFG, { x: 0, y: 0 })

  // Bounds: every joint padded by the thickest capsule, and the head by its radius.
  const pad = Math.max(CFG.torsoW, CFG.legW, CFG.armW) / 2 + 1
  let minX = j.H.x - CFG.R, maxX = j.H.x + CFG.R, minY = j.H.y - CFG.R, maxY = j.H.y + CFG.R
  for (const p of jointPoints(j)) {
    minX = Math.min(minX, p.x - pad); maxX = Math.max(maxX, p.x + pad)
    minY = Math.min(minY, p.y - pad); maxY = Math.max(maxY, p.y + pad)
  }
  const width = maxX - minX
  const height = maxY - minY
  const ground = Math.max(j.fR.y, j.fL.y) + CFG.legW / 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * PX)
  canvas.height = Math.ceil(height * PX)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(PX, PX)
  if (flip) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }
  ctx.translate(-minX, -minY)
  draw(ctx, j, CFG, { color })

  const sprite: BobbitSprite = {
    url: canvas.toDataURL('image/png'),
    width,
    height,
    groundY: ground - minY,
    headTopY: j.H.y - CFG.R - minY,
    centerX: flip ? (maxX - j.P.x) / width : (j.P.x - minX) / width,
  }
  cache.set(key, sprite)
  return sprite
}

/** renderBobbit, re-drawn when the theme flips so each tone keeps its legible variant. */
export function useBobbit(pose: BobbitPose): BobbitSprite | null {
  const dark = useIsDarkMode()
  const { anim, t, tone, flip } = pose
  return useMemo(() => renderBobbit({ anim, t, tone, flip }, dark), [anim, t, tone, flip, dark])
}

/**
 * A Bobbit standing in an SVG scene. `x` is where its body is centred and `groundY` the
 * line its feet stand on, both in the scene's own viewBox units; `size` is its height from
 * the top of the head to the ground. Decorative — the scene carries the label.
 */
export function SvgBobbit({ x, groundY, size, ...pose }: BobbitPose & { x: number; groundY: number; size: number }) {
  const sprite = useBobbit(pose)
  if (!sprite) return null
  // Head to feet, whatever the hands are doing — so a waving Bobbit is as tall as a walking one.
  const s = size / (sprite.groundY - sprite.headTopY)
  const w = sprite.width * s
  const h = sprite.height * s
  return (
    <image
      href={sprite.url}
      x={x - sprite.centerX * w}
      y={groundY - sprite.groundY * s}
      width={w}
      height={h}
      preserveAspectRatio="none"
      aria-hidden="true"
    />
  )
}

/** A Bobbit as an inline image, for an icon slot. `className` sets its height. */
export function BobbitImg({ className = '', ...pose }: BobbitPose & { className?: string }) {
  const sprite = useBobbit(pose)
  if (!sprite) return null
  return <img src={sprite.url} alt="" aria-hidden="true" className={`w-auto ${className}`} />
}
