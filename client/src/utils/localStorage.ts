import type { SavedTierListState } from "../types/steam";

const LEGACY_STORAGE_KEY = "steam-tier-list-state";
const STORAGE_PREFIX = "steam-tier-list-state:";
const DEFAULT_SCOPE = "draft";

function getStorageKey(scope = DEFAULT_SCOPE) {
  return `${STORAGE_PREFIX}${scope}`;
}

function parseSavedState(raw: string | null): SavedTierListState | null {
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as SavedTierListState;

  if (!Array.isArray(parsed.games) || !Array.isArray(parsed.rows)) {
    return null;
  }

  return parsed;
}

export function loadSavedState(scope = DEFAULT_SCOPE): SavedTierListState | null {
  try {
    const scopedState = parseSavedState(localStorage.getItem(getStorageKey(scope)));

    if (scopedState || scope !== DEFAULT_SCOPE) {
      return scopedState;
    }

    return parseSavedState(localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveState(state: SavedTierListState, scope = DEFAULT_SCOPE) {
  try {
    localStorage.setItem(getStorageKey(scope), JSON.stringify(state));
  } catch {
    // Large manually uploaded covers can exceed the browser storage quota.
    // Keep the app alive and leave the current in-memory state untouched.
  }
}

export function clearSavedState(scope?: string) {
  if (scope) {
    localStorage.removeItem(getStorageKey(scope));
    return;
  }

  localStorage.removeItem(LEGACY_STORAGE_KEY);

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(STORAGE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
