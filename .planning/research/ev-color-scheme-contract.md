# Cross-product colour scheme contract

**Status:** adopted estate-wide — but under the name `ev_theme`, not the one first written here
**Date:** 2026-09-21, revised 2026-10-27

> 🔴 **This document originally named the cookie `ev_color_scheme`, and that was the one thing
> it got wrong.** essentials had shipped a `.empowered.vote` cookie called **`ev_theme`** on
> **2026-05-05**, four months earlier. Neither side knew about the other, so two correct
> implementations shipped under two names and interoperated with nobody. By 2026-10-27 the
> landing page, essentials, Profile, Admin and Compass all used `ev_theme`; this repo was alone
> on the other name. Civic Spaces moved — not because `ev_theme` is the better name, only
> because it was first and outnumbered this one. Everything else below stood up unchanged.
>
> ▶ **Before writing a cross-product contract, go and read what the other products already do.**
> The rest of this document is careful about cookie attributes, domains and the dev fallback,
> and none of that mattered while the name did not match.

## The problem

A member sets light mode on one EV product, opens another, and it is dark again.
They set it again. It resets again.

The cause is not a bug in any one app. **`localStorage` is scoped per origin and
does not cross subdomains.** `civicspaces.empowered.vote` and
`compass.empowered.vote` have entirely separate stores, so a preference written
in one is invisible to the other by construction. Every EV product independently
storing `ev:color-scheme` in `localStorage` produces exactly this experience, no
matter how correct each app is on its own.

## The contract

A cookie on the **parent** domain is shared by every subdomain, so that is the
cross-product source of truth.

| | |
|---|---|
| Cookie name | `ev_theme` (was `ev_color_scheme` here until 2026-10-27; still read, never written) |
| Values | `light` \| `dark` — nothing else |
| Domain | `.empowered.vote` |
| Path | `/` |
| Max-Age | `31536000` (one year) |
| SameSite | `Lax` |
| Secure | yes on https, omitted on http so local dev works |

**Resolution order:** cookie → `localStorage['ev:color-scheme']` → **default `dark`**.

Three rules make this work:

1. **Dark is the default.** A visitor with no stored preference gets dark.
2. **`prefers-color-scheme` is not consulted.** Deliberate: the EV default is dark
   regardless of OS setting, and the member inverts it explicitly. (Noted
   trade-off: this overrides people who set light at the OS level, sometimes for
   vision reasons. The toggle is the mitigation, and it now persists.)
3. **Write both stores.** The cookie is what other products read; `localStorage`
   is the same-origin fallback for local dev (where a `.empowered.vote` cookie
   cannot be set) and for browsers blocking cookies.

## Applying it before first paint

The class must be on `<html>` before paint or the page flashes. Inline in
`index.html`, before any stylesheet:

```html
<script>
  (function(){var m=document.cookie.match(/(?:^|;\s*)ev_theme=(light|dark)(?:;|$)/)||document.cookie.match(/(?:^|;\s*)ev_color_scheme=(light|dark)(?:;|$)/);var s=m?m[1]:null;if(!s){try{s=localStorage.getItem('ev:color-scheme')}catch(e){}}if(s!=='light')document.documentElement.classList.add('dark')})();
</script>
```

Note `if (s !== 'light')` rather than `if (s === 'dark')` — that is what makes
the absence of a preference resolve to dark.

## Reference implementation

`src/lib/colorScheme.ts` in this repo. It is dependency-free and deliberately
framework-agnostic so it can be copied as-is; `src/hooks/useTheme.ts` is the
thin React wrapper over it.

One detail worth copying: the domain is only set when the host actually ends in
`empowered.vote`. A browser silently drops a cookie whose `Domain` it does not
belong to, so on `localhost` a parent-domain cookie would never persist at all —
there it falls back to a host-only cookie.

## What adoption requires

Measured live on 2026-10-27, against `ev_theme`:

| Product | reads | writes | dark default | OS ignored |
|---|---|---|---|---|
| empowered.vote (landing) | yes | yes | yes | yes |
| Essentials | yes | yes | yes | yes |
| the accounts app (Profile) | yes | yes | yes | yes |
| the accounts app (Admin) | yes | yes | yes | yes |
| **Civic Spaces** | yes (this change) | yes | yes | yes |
| Compass | yes | yes | **no** | **no** |
| Treasury Tracker / financials | second, after storage | **no** | **no** | **no** |
| Read & Rank | after first paint | **no** | **no** | **no** |
| Civic Trivia Championship | **no** | **no** | yes | yes |
| Empowered Badges | no dark mode at all | | | |
| Validation Quests | own `vq-theme` key, `data-theme` | | | |

Compass, Treasury Tracker, Read & Rank and Civic Trivia are being brought onto the
contract now. Badges has no dark mode to connect.

## Deliberately out of scope

**Persisting to the EV account.** A cookie is per-browser: it does not follow a
signed-in member to their phone, and it is lost when they clear cookies. The
durable home for this is an account preference served by ev-accounts, with the
cookie kept as the guest path and the fast path. That spans repos and is a
larger piece of work; the cookie is the part that fixes the reported complaint
(guests, same browser, product to product) without it.

`civic_spaces.connected_profiles.ui_theme` already exists in this schema, but it
is Civic Spaces' own table — writing there would not help any other product, and
`useTheme` in main already carried a TODO saying preferences belong on the
accounts API rather than in this app's schema.
