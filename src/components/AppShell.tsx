"use client";

import { AnimatePresence } from "framer-motion";
import { Heart, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { crew, initialState, lineup } from "@/lib/data";
import { resolveFlow } from "@/lib/flow";
import { loadState, saveState } from "@/lib/storage";
import type { AppState, Night } from "@/lib/types";
import { FlowScreen } from "./FlowScreen";
import { HomeScreen } from "./HomeScreen";
import { LineupScreen } from "./LineupScreen";
import { NavButton, ScreenFrame } from "./ui";

type Screen = "home" | "lineup" | "flow";

export function AppShell() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeNight, setActiveNight] = useState<Night>("saturday");
  const [appState, setAppState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAppState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(appState);
  }, [appState, hydrated]);

  const activeUser = crew.find((member) => member.id === appState.activeUserId) ?? crew[0];
  const flow = useMemo(
    () => resolveFlow(lineup.sets, appState.votes, appState.overrides, activeNight, appState.attendOverrides),
    [activeNight, appState.overrides, appState.votes, appState.attendOverrides]
  );

  return (
    <main className="min-h-screen bg-rave-radial text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="border-b border-white/10 bg-night/82 -mx-4 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <button className="group flex items-center gap-2 text-left" onClick={() => setScreen("home")}>
              <span className="grid size-10 place-items-center rounded-2xl bg-pink/15 text-xl shadow-glowPink transition group-hover:scale-105">
                🦉
              </span>
              <span>
                <span className="block font-display text-2xl font-bold tracking-tight text-white">flowwwww</span>
                <span className="block text-xs uppercase tracking-[0.28em] text-cyan/80">EDC LV 2026</span>
              </span>
            </button>

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              {crew.map((member) => (
                <button
                  key={member.id}
                  className={`grid size-9 place-items-center rounded-full border text-base transition ${
                    appState.activeUserId === member.id ? "scale-105 bg-white/12 shadow-glowCyan" : "bg-night/60 opacity-70"
                  }`}
                  style={{ borderColor: member.color }}
                  title={`Acting as ${member.name}`}
                  onClick={() => setAppState((state) => ({ ...state, activeUserId: member.id }))}
                >
                  {member.emoji}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 py-6">
          <AnimatePresence mode="wait">
            <ScreenFrame key={screen}>
              {screen === "home" && (
                <HomeScreen
                  activeUserName={activeUser.name}
                  setScreen={setScreen}
                  setActiveNight={setActiveNight}
                  votes={appState.votes.length}
                  flowCount={flow.length}
                />
              )}
              {screen === "lineup" && (
                <LineupScreen
                  activeNight={activeNight}
                  setActiveNight={setActiveNight}
                  appState={appState}
                  setAppState={setAppState}
                />
              )}
              {screen === "flow" && (
                <FlowScreen
                  activeNight={activeNight}
                  setActiveNight={setActiveNight}
                  appState={appState}
                  setAppState={setAppState}
                  setScreen={setScreen}
                />
              )}
            </ScreenFrame>
          </AnimatePresence>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night/88 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-2xl">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-[1.65rem] border border-white/10 bg-white/5 p-1.5">
          <NavButton active={screen === "home"} label="Home" icon={<Users size={17} />} onClick={() => setScreen("home")} />
          <NavButton active={screen === "lineup"} label="Lineup" icon={<Heart size={17} />} onClick={() => setScreen("lineup")} />
          <NavButton active={screen === "flow"} label="flowwwww" icon={<Zap size={17} />} onClick={() => setScreen("flow")} />
        </div>
      </nav>
    </main>
  );
}
