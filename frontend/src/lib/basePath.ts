/**
 * Base path utility for GitHub Pages (or any sub-path) deployments.
 *
 * Usage:  VITE_BASE_PATH=/ekusasaizu/ bun run build
 * Locally: just `bun run dev` (defaults to `/`)
 *
 * Use `p('/login')` everywhere instead of hard-coded `"/login"`.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefix an internal path with the deploy base path. */
export const p = (path: string) => BASE + path;
