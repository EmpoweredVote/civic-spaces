import { useEffect, useRef } from 'react'
import { CFG, REST, computePose, draw } from './leremyRig'
import { ALL_ANIMATIONS, figColor } from './rigExtras'
import { initWander, wanderAdvance, wanderAnim } from './wanderReducer'
import type { WanderState } from './wanderReducer'
import { greetReduce, greetClock, greetingIds, isGreeting } from './greetReducer'
import type { GreetState } from './greetReducer'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'

/**
 * Bobbits for Civic Spaces' illustrations — animated the way Civic Trivia's are.
 *
 * Everything that decides how a Bobbit looks and moves is Civic Trivia's own code, copied
 * verbatim into this folder: the rig (leremyRig.ts, empowered.vote's leremy-rig.js), the
 * extra poses and the six-tone palette (rigExtras.ts), stroll/pause/turn wandering
 * (wanderReducer.ts) and the hover greet with its linger (greetReducer.ts). This file is
 * only the stage: one canvas, one requestAnimationFrame loop, the same rules as CTC's
 * BobitField — a hovered Bobbit stops and greets (or plays its `hoverAnim`), walkers stroll,
 * pause and turn at the ends, and every figure runs on its own phase so none move in
 * lockstep.
 *
 * Without BobitField's game-only machinery (the collection tableau, speech bubbles, the
 * hold-to-poof gesture, confetti): none of it has a place in a civic illustration.
 *
 * 🔴 prefers-reduced-motion draws ONE still frame and never starts the loop. The loop also
 * stops while the stage is off screen or the tab is hidden, so an Explore page scrolled past
 * its illustrations costs nothing.
 */

export interface StageFigure {
  id: string
  /** Rig animation while idle — 'friendly', 'bored', 'toddle', … Ignored while wandering. */
  anim: string
  /** Palette tone: 0 teal | 1 coral | 2 gold | 3 green | 4 purple | 5 orange. */
  tone: number
  /** Body centre, in the stage's own units. The starting point for a wanderer. */
  x: number
  /** The line the feet stand on, in stage units. */
  groundY: number
  /** Height from the top of the head to the ground, in stage units. */
  size: number
  flip?: boolean
  /** Seconds added to the shared clock, so figures do not move in lockstep. */
  phase?: number
  /** What it plays while greeted. Defaults to the rig's `greet`, as in CTC. */
  hoverAnim?: string
  /** Stroll, pause and turn between these x bounds (stage units), via wanderReducer. */
  wander?: { min: number; max: number }
  /** For a wanderer: the gait it walks with. Defaults to wanderReducer's `stroll`. */
  walkAnim?: string
}

/**
 * Pelvis height above the feet in rig units — fieldGeometry.ts's `pelvisOffset` for a
 * standing pose (ev-figures.js's `feetY - 112 * S`). None of the poses used here sit.
 */
const PELVIS_ABOVE_GROUND = 112

/** Head-top to ground at rest, in rig units: what `size` is measured against. */
const HEAD_TO_GROUND = (() => {
  const j = computePose(REST, CFG, { x: 0, y: 0 })
  return PELVIS_ABOVE_GROUND - (j.H.y - CFG.R)
})()

/** Half a figure's width for hit-testing, in rig units — fieldGeometry's HALF_W. */
const HALF_W = 34

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * The loop. `pxPerUnit` says how many backing pixels one stage unit is right now — it
 * differs between an SVG scene (scaled by its viewBox) and a plain HTML slot.
 */
function useStage(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  figures: readonly StageFigure[],
  stage: { width: number; height: number },
  pxPerUnit: () => number,
) {
  const dark = useIsDarkMode()
  // Read inside the loop through refs, so a theme flip or new props never restart it.
  const live = useRef({ figures, dark, stage, pxPerUnit })
  live.current = { figures, dark, stage, pxPerUnit }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let wander: WanderState | null = null
    let greet: GreetState = {}
    let hovered: string | null = null
    let clock = 0
    let raf = 0
    let last = 0
    let visible = true

    const scaleOf = (f: StageFigure) => f.size / HEAD_TO_GROUND

    const paint = () => {
      const { figures: figs, dark: isDark, stage: st, pxPerUnit: ppu } = live.current
      const k = ppu()
      const w = Math.max(1, Math.round(st.width * k))
      const h = Math.max(1, Math.round(st.height * k))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)

      for (const f of figs) {
        const s = scaleOf(f)
        const e = wander?.[f.id]
        const greeting = isGreeting(greet, f.id)
        const key = greeting
          ? f.hoverAnim ?? 'greet'
          : e
            ? (e.phase === 'walk' ? f.walkAnim ?? wanderAnim(e) : wanderAnim(e))
            : f.anim
        const animation = ALL_ANIMATIONS[key] ?? ALL_ANIMATIONS[f.anim]
        if (!animation) continue
        const t = greeting ? greetClock(greet, f.id) : clock + (f.phase ?? 0)
        const x = e ? e.x : f.x
        const flip = e ? e.dir < 0 : !!f.flip

        ctx.setTransform(k * s * (flip ? -1 : 1), 0, 0, k * s, x * k, (f.groundY - PELVIS_ABOVE_GROUND * s) * k)
        draw(ctx, computePose(animation.frame(t), CFG, { x: 0, y: 0 }), CFG, { color: figColor(f.tone, isDark) })
      }
    }

    const step = (now: number) => {
      raf = 0
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      clock += dt
      greet = greetReduce(greet, hovered, dt)

      const { figures: figs } = live.current
      const walkers = figs.filter((f) => f.wander)
      if (walkers.length > 0) {
        if (!wander) {
          wander = initWander(
            walkers.map((f, i) => ({ id: f.id, x: f.x, dir: (f.flip ? -1 : i % 2 === 0 ? 1 : -1) as 1 | -1 })),
            Math.random,
          )
        }
        // wanderReducer turns at 0..width; each walker's own bounds are applied by
        // shifting into its range and back, so two walkers can share a sidewalk.
        const next: WanderState = { ...wander }
        for (const f of walkers) {
          const range = f.wander!
          const own = wander[f.id]
          if (!own) continue
          const shifted = wanderAdvance(
            { [f.id]: { ...own, x: own.x - range.min } },
            dt,
            { width: range.max - range.min, scale: scaleOf(f), greeting: greetingIds(greet), rand: Math.random },
          )[f.id]
          if (shifted) next[f.id] = { ...shifted, x: shifted.x + range.min }
        }
        wander = next
      }

      paint()
      if (visible && !document.hidden) raf = requestAnimationFrame(step)
    }

    const start = () => {
      if (raf || !visible || document.hidden) return
      last = 0
      raf = requestAnimationFrame(step)
    }

    if (prefersReducedMotion()) {
      paint()
      const redraw = () => paint()
      const ro = new ResizeObserver(redraw)
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Hover greet, as in CTC: the figure under the pointer stops and greets.
    const hitTest = (ev: PointerEvent): string | null => {
      const rect = canvas.getBoundingClientRect()
      const { stage: st, figures: figs } = live.current
      const ux = ((ev.clientX - rect.left) / rect.width) * st.width
      const uy = ((ev.clientY - rect.top) / rect.height) * st.height
      for (let i = figs.length - 1; i >= 0; i--) {
        const f = figs[i]!
        const s = scaleOf(f)
        const x = wander?.[f.id]?.x ?? f.x
        if (Math.abs(ux - x) <= HALF_W * s && uy <= f.groundY + 4 * s && uy >= f.groundY - (HEAD_TO_GROUND + 30) * s) return f.id
      }
      return null
    }
    const onMove = (ev: PointerEvent) => {
      hovered = hitTest(ev)
      canvas.style.cursor = hovered ? 'pointer' : ''
    }
    const onLeave = () => {
      hovered = null
      canvas.style.cursor = ''
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting
      if (visible) start()
    })
    io.observe(canvas)
    const onVisibility = () => { if (!document.hidden) start() }
    document.addEventListener('visibilitychange', onVisibility)

    start()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [canvasRef])
}

/**
 * Bobbits inside an SVG scene. Covers the scene's viewBox (`width` × `height`) with one
 * canvas in a <foreignObject>, so figures are placed in the scene's own units and scale and
 * crop with it. Decorative: the scene carries the label.
 */
export function SvgBobbits({ width, height, figures }: { width: number; height: number; figures: readonly StageFigure[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useStage(ref, figures, { width, height }, () => {
    // The canvas sits in a <foreignObject>, whose own CTM carries the viewBox scale.
    const fo = ref.current?.parentElement as SVGForeignObjectElement | null | undefined
    const ctm = fo?.getScreenCTM?.()
    // Screen pixels per viewBox unit, times the device ratio, so the figures stay crisp.
    return (ctm ? Math.hypot(ctm.a, ctm.b) : 1) * (window.devicePixelRatio || 1)
  })
  return (
    <foreignObject x={0} y={0} width={width} height={height} aria-hidden="true">
      <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%' }} />
    </foreignObject>
  )
}

/** One Bobbit in an HTML slot (an icon). The slot's CSS box sets its size. */
export function BobbitIcon({ figure, className = '' }: { figure: Omit<StageFigure, 'id' | 'x' | 'groundY' | 'size'>; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  // A 40 × 40 unit box: feet near the bottom, room above for a raised arm.
  const fig: StageFigure = { id: 'icon', x: 20, groundY: 38, size: 30, ...figure }
  useStage(ref, [fig], { width: 40, height: 40 }, () => {
    const el = ref.current
    return ((el?.clientWidth || 24) / 40) * (window.devicePixelRatio || 1)
  })
  return <canvas ref={ref} aria-hidden="true" className={`block ${className}`} />
}
