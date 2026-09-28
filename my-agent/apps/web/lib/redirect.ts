const BASE = "https://bezbot.invalid";

/**
 * A same-origin path to send someone after sign-in. The value is parsed the
 * way a browser would, so tricks like `/\evil.example` or `//evil.example`
 * (which resolve to another host) fall back to `/app`.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
