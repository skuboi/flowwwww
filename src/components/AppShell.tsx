"use client";

import { AnimatePresence } from "framer-motion";
import { Heart, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrewContext } from "@/lib/crew-context";
import { demoCrew, demoState, initialState, lineup } from "@/lib/data";
import { resolveFlow } from "@/lib/flow";
import { loadCrewSession, loadState, saveCrewSession, saveState } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  addComment as syncAddComment,
  addVote as syncAddVote,
  initSession,
  loadCrewState,
  removeVote as syncRemoveVote,
  setFlowOverride as syncSetFlowOverride,
  subscribeToChanges,
} from "@/lib/supabase-sync";
import type { AppState, CrewMember, Night } from "@/lib/types";
import { FlowScreen } from "./FlowScreen";
import { HomeScreen } from "./HomeScreen";
import { LineupScreen } from "./LineupScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { NavButton, ScreenFrame } from "./ui";

type Screen = "home" | "lineup" | "flow";

const isSupabaseConfigured = () => createSupabaseBrowserClient() !== null;

export function AppShell() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeNight, setActiveNight] = useState<Night>("saturday");
  const [appState, setAppState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  // Crew session (null = not onboarded yet, or demo mode)
  const [crewSession, setCrewSession] = useState<{ crewId: string; memberId: string } | null>(null);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const unsubRef = useRef<(() => void) | null>(null);

  // Load saved session on mount
  useEffect(() => {
    const sb = isSupabaseConfigured();
    if (!sb) {
      // No Supabase — demo mode
      setIsDemo(true);
      setCrew(demoCrew);
      const saved = loadState();
      setAppState(saved.votes.length > 0 ? saved : demoState);
      setHydrated(true);
      return;
    }

    const saved = loadCrewSession();
    if (saved) {
      setCrewSession(saved);
      // Will trigger data load below
    } else {
      setShowOnboarding(true);
    }
    setHydrated(true);
  }, []);

  // When crew session is set, load data + subscribe
  const reloadCrewData = useCallback(async (crewId: string, memberId: string) => {
    await initSession();
    const result = await loadCrewState(crewId);
    if (result) {
      setCrew(result.members);
      const savedLocal = loadState();
      setAppState({
        activeUserId: memberId,
        votes: result.state.votes,
        comments: result.state.comments,
        overrides: result.state.overrides,
        attendOverrides: savedLocal.attendOverrides, // keep local
      });
    }
  }, []);

  useEffect(() => {
    if (!crewSession || isDemo) return;
    const { crewId, memberId } = crewSession;

    reloadCrewData(crewId, memberId);

    // Subscribe to realtime
    unsubRef.current = subscribeToChanges(crewId, () => {
      reloadCrewData(crewId, memberId);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [crewSession, isDemo, reloadCrewData]);

  // Save state locally (cache + attendOverrides)
  useEffect(() => {
    if (hydrated) saveState(appState);
  }, [appState, hydrated]);

  const handleOnboardComplete = useCallback(
    (crewId: string, memberId: string, members: CrewMember[]) => {
      const session = { crewId, memberId };
      saveCrewSession(session);
      setCrewSession(session);
      setCrew(members);
      setAppState((s) => ({ ...s, activeUserId: memberId }));
      setShowOnboarding(false);
    },
    []
  );

  // Wrap setAppState to sync to Supabase
  const setAppStateWithSync: React.Dispatch<React.SetStateAction<AppState>> = useCallback(
    (action) => {
      setAppState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;

        if (!isDemo && crewSession) {
          const { crewId, memberId } = crewSession;

          // Detect vote changes
          const addedVotes = next.votes.filter(
            (v) => v.user_id === memberId && !prev.votes.some((pv) => pv.user_id === v.user_id && pv.set_id === v.set_id)
          );
          const removedVotes = prev.votes.filter(
            (v) => v.user_id === memberId && !next.votes.some((nv) => nv.user_id === v.user_id && nv.set_id === v.set_id)
          );
          for (const v of addedVotes) syncAddVote(crewId, memberId, v.set_id);
          for (const v of removedVotes) syncRemoveVote(memberId, v.set_id);

          // Detect comment additions
          const addedComments = next.comments.filter(
            (c) => c.user_id === memberId && !prev.comments.some((pc) => pc.id === c.id)
          );
          for (const c of addedComments) syncAddComment(crewId, memberId, c.set_id, c.content);

          // Detect override changes
          const addedOverrides = next.overrides.filter(
            (o) => !prev.overrides.some(
              (po) => po.selected_set_id === o.selected_set_id &&
                JSON.stringify(po.clashing_set_ids.sort()) === JSON.stringify(o.clashing_set_ids.sort())
            )
          );
          for (const o of addedOverrides) syncSetFlowOverride(crewId, o.clashing_set_ids, o.selected_set_id);
        }

        return next;
      });
    },
    [isDemo, crewSession]
  );

  const activeUser = crew.find((member) => member.id === appState.activeUserId) ?? crew[0];
  const flow = useMemo(
    () => resolveFlow(lineup.sets, appState.votes, appState.overrides, activeNight, appState.attendOverrides),
    [activeNight, appState.overrides, appState.votes, appState.attendOverrides]
  );

  // Show onboarding if needed
  if (!hydrated) return null;
  if (showOnboarding && !isDemo) {
    return <OnboardingScreen onComplete={handleOnboardComplete} />;
  }

  return (
    <CrewContext.Provider value={crew}>
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
                    title={member.name}
                    onClick={() => {
                      if (isDemo) setAppState((state) => ({ ...state, activeUserId: member.id }));
                    }}
                  >
                    {member.emoji}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="flex-1 py-6">
            <AnimatePresence mode="wait">
              {screen === "home" && (
                <ScreenFrame key="home">
                  <HomeScreen
                    activeUserName={activeUser?.name ?? "you"}
                    setScreen={setScreen}
                    setActiveNight={setActiveNight}
                    votes={appState.votes.length}
                    flowCount={flow.length}
                  />
                </ScreenFrame>
              )}
              {screen === "lineup" && (
                <ScreenFrame key="lineup">
                  <LineupScreen
                    activeNight={activeNight}
                    setActiveNight={setActiveNight}
                    appState={appState}
                    setAppState={setAppStateWithSync}
                  />
                </ScreenFrame>
              )}
              {screen === "flow" && (
                <ScreenFrame key="flow">
                  <FlowScreen
                    activeNight={activeNight}
                    setActiveNight={setActiveNight}
                    appState={appState}
                    setAppState={setAppStateWithSync}
                    setScreen={setScreen}
                  />
                </ScreenFrame>
              )}
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
    </CrewContext.Provider>
  );
}
