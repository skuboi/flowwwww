import { initialState } from "./data";
import type { AppState } from "./types";

const storageKey = "flowwwww-state-v5";
const crewSessionKey = "flowwwww-crew-session";

export type CrewSession = {
  crewId: string;
  memberId: string;
};

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

export function loadCrewSession(): CrewSession | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(crewSessionKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as CrewSession;
  } catch {
    return null;
  }
}

export function saveCrewSession(session: CrewSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(crewSessionKey, JSON.stringify(session));
}

export function clearCrewSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(crewSessionKey);
}
