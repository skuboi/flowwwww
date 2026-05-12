"use client";

import { motion } from "framer-motion";
import { Grid3x3, List as ListIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppState, Night } from "@/lib/types";
import { LineupScreen } from "./LineupScreen";
import { PickScreen } from "./PickScreen";
import { ScreenTitle, softSpring, spring, tap } from "./ui";

/**
 * LineupTab — single hosted screen for browsing + voting on the lineup.
 *
 * Replaces the previous arrangement of two parallel nav tabs ("Lineup" + "Pick")
 * which both wrote to the same vote store but looked unrelated. The two views
 * now live under one tab with a shared mode toggle so users instantly
 * understand they're two windows onto the same data.
 *
 * Mode persists in localStorage so each user lands on their preferred view.
 *   "list" — vertical scrollable list grouped by time block (best for
 *            *exploring* unfamiliar artists with previews + comments).
 *   "grid" — full stage-by-time calendar (best when you already know your
 *            vibe and want to see overlaps the moment they exist).
 *
 * The mode toggle uses the same shared-layoutId sliding-pill pattern as the
 * Flow screen's grid/timeline/wallpaper toggle, so the mental model carries.
 */

type ViewMode = "list" | "grid";
const STORAGE_KEY = "flowwwww:lineup-mode";

export function LineupTab({
  activeNight,
  setActiveNight,
  appState,
  setAppState,
}: {
  activeNight: Night;
  setActiveNight: (night: Night) => void;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  // SSR-safe initial value, hydrated from localStorage on mount to avoid
  // a content-flash mismatch between server and client.
  const [mode, setModeState] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? (window.localStorage.getItem(STORAGE_KEY) as ViewMode | null)
      : null;
    if (stored === "list" || stored === "grid") setModeState(stored);
  }, []);

  function setMode(next: ViewMode) {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode — non-fatal, just won't persist.
    }
  }

  const modes: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "list", label: "List", icon: <ListIcon size={14} /> },
    { key: "grid", label: "Grid", icon: <Grid3x3 size={14} /> },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ScreenTitle
          eyebrow="Voting surface"
          title="Lineup"
          copy="Two views, one set of hearts. Switch between scrollable list (best for exploring) and calendar grid (best for spotting clashes)."
        />
        <div className="relative shrink-0 rounded-full border border-white/10 bg-white/5 p-1">
          <div className="flex">
            {modes.map((m) => {
              const active = mode === m.key;
              return (
                <motion.button
                  key={m.key}
                  whileTap={tap}
                  transition={softSpring}
                  className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${
                    active ? "text-night" : "text-white/65 hover:text-white"
                  }`}
                  onClick={() => setMode(m.key)}
                >
                  {active && (
                    <motion.span
                      layoutId="lineup-mode-active"
                      className="absolute inset-0 rounded-full bg-cyan shadow-glowCyan"
                      transition={spring}
                    />
                  )}
                  <span className="relative">{m.icon}</span>
                  <span className="relative">{m.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {mode === "list" ? (
        <LineupScreen
          embedded
          activeNight={activeNight}
          setActiveNight={setActiveNight}
          appState={appState}
          setAppState={setAppState}
        />
      ) : (
        <PickScreen
          embedded
          activeNight={activeNight}
          setActiveNight={setActiveNight}
          appState={appState}
          setAppState={setAppState}
        />
      )}
    </div>
  );
}
