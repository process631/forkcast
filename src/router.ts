import { useSyncExternalStore } from 'react';

/** A tiny hash router: "#/recipe/mdb-52772" → ['recipe', 'mdb-52772']. */
function getPath(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** How many in-app pages deep we are, so "Back" never leaves the app. */
let depth = 0;
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => depth++);

export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, getPath, () => '/');
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const hash = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (opts.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    depth--; // replacing doesn't add a history entry
  } else {
    window.location.hash = hash;
  }
}

export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

/** Go back inside the app, or to `fallback` when this page was opened directly. */
export function goBack(fallback = '/') {
  if (depth > 0) {
    depth -= 2; // the back navigation itself fires a hashchange
    window.history.back();
  } else {
    navigate(fallback);
  }
}
