/**
 * Origin for the ev-accounts API (Essentials, Compass, meetings).
 *
 * Production calls the API host directly; its CORS allow-list includes
 * civicspaces.empowered.vote. Local dev calls the dev server's own `/api`,
 * which vite.config.ts proxies to the live API — localhost gets no CORS header,
 * so a direct call from dev always failed and the panels fell back to fixtures.
 */
export const EV_API_ORIGIN = import.meta.env.DEV ? '' : 'https://api.empowered.vote'
