import { initialState } from "./data";
import type { AppState } from "./types";

const storageKey = "flowwwww-state-v4";

export function loadState(): AppState {
  if (typeof window === "undefined") {
    return initialState;
  }

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return initialState;
  }

  try {
    return { ...initialState, ...JSON.parse(stored) } as AppState;
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}
