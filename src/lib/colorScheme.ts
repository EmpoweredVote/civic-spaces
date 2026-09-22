export type ColorScheme = 'light' | 'dark'

/**
 * Where a member's light/dark choice lives, and why it lives in two places.
 *
 * 🔴 localStorage does NOT cross subdomains. `civicspaces.empowered.vote` and
 * `compass.empowered.vote` have entirely separate stores, so a preference set
 * in one product is invisible to the next — you land on a new EV tool and it
 * is dark again, every time.
 *
 * A cookie scoped to the parent domain (`.empowered.vote`) IS shared by every
 * subdomain, so the cookie is the cross-product source of truth. localStorage
 * is kept in sync purely as a same-origin fallback, for the cases the cookie
 * cannot cover:
 *
 *   - local dev, where the host is `localhost` and the browser will not accept
 *     a cookie scoped to a domain it is not on
 *   - a browser blocking cookies but allowing storage
 *
 * READ ORDER is therefore cookie -> localStorage -> default. The default is
 * DARK: an EV visitor gets dark until they say otherwise, and `prefers-color-scheme`
 * is deliberately not consulted.
 *
 * Any other EV app can adopt this by reading and writing the same cookie under
 * the same name — see `.planning/research/ev-color-scheme-contract.md`.
 */
export const COOKIE_NAME = 'ev_color_scheme'
export const STORAGE_KEY = 'ev:color-scheme'
export const DEFAULT_SCHEME: ColorScheme = 'dark'

/** One year. Long enough that a preference outlives a campaign season. */
const MAX_AGE_SECONDS = 31_536_000

function isScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark'
}

function readCookie(): ColorScheme | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + COOKIE_NAME + '=(light|dark)(?:;|$)'),
  )
  return match ? (match[1] as ColorScheme) : null
}

function readStorage(): ColorScheme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isScheme(stored) ? stored : null
  } catch {
    // Private mode / storage blocked — the cookie or the default covers us.
    return null
  }
}

/**
 * The cookie domain to write, or null to let the browser scope it to this host.
 *
 * Only `*.empowered.vote` gets the shared parent-domain cookie. Anywhere else —
 * localhost, a preview deploy on another domain — gets a host-only cookie, since
 * a browser silently drops a Domain it does not belong to and the preference
 * would never persist at all.
 */
function cookieDomain(): string | null {
  if (typeof location === 'undefined') return null
  return /(^|\.)empowered\.vote$/.test(location.hostname) ? '.empowered.vote' : null
}

/** The member's stored choice, or null if they have never expressed one. */
export function readColorScheme(): ColorScheme | null {
  return readCookie() ?? readStorage()
}

/** The scheme to actually render: their choice, else dark. */
export function resolveColorScheme(): ColorScheme {
  return readColorScheme() ?? DEFAULT_SCHEME
}

/** Persist to both stores. The cookie is what other EV products will read. */
export function writeColorScheme(scheme: ColorScheme): void {
  const domain = cookieDomain()
  const parts = [
    `${COOKIE_NAME}=${scheme}`,
    'path=/',
    `max-age=${MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]
  if (domain) parts.push(`domain=${domain}`)
  // A cookie without Secure is rejected on https by some browsers when SameSite
  // is relaxed; on http (local dev) Secure would itself make it undeliverable.
  if (typeof location !== 'undefined' && location.protocol === 'https:') {
    parts.push('Secure')
  }
  try {
    document.cookie = parts.join('; ')
  } catch {
    // Cookies blocked — localStorage below still keeps it for this origin.
  }

  try {
    localStorage.setItem(STORAGE_KEY, scheme)
  } catch {
    // Storage blocked — the cookie above still carries it.
  }
}

/** Toggle the `dark` class. The class, not a media query, is this app's switch. */
export function applyColorScheme(scheme: ColorScheme): void {
  document.documentElement.classList.toggle('dark', scheme === 'dark')
}
