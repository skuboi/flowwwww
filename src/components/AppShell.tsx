"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrewContext } from "@/lib/crew-context";
import { demoCrew, demoState, initialState, lineup } from "@/lib/data";
import { resolveFlow } from "@/lib/flow";
import { loadCrewSession, loadState, saveCrewSession, saveState } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
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
import { LineupTab } from "./LineupTab";
import { OnboardingScreen } from "./OnboardingScreen";
import { NavButton, ScreenFrame } from "./ui";

type Screen = "home" | "lineup" | "flow";

const isSupabaseConfigured = () => createSupabaseBrowserClient() !== null;

export function AppShell() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeNight, setActiveNight] = useState<Night>("friday");
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
    if (!result) return;
    setCrew(result.members);
    const savedLocal = loadState();
    setAppState((prev) => {
      // Merge fix: Supabase realtime can fire before our own INSERT is visible
      // on a follow-up SELECT, which would otherwise wipe out optimistic local
      // updates from the active user. Keep any of OUR member's local votes /
      // comments that aren't yet reflected in the server response. Other
      // members' state always tracks the server (source of truth).
      const serverVoteKeys = new Set(
        result.state.votes.map((v) => `${v.user_id}::${v.set_id}`)
      );
      const localOptimisticVotes = prev.votes.filter(
        (v) => v.user_id === memberId && !serverVoteKeys.has(`${v.user_id}::${v.set_id}`)
      );

      const serverCommentIds = new Set(result.state.comments.map((c) => c.id));
      const localOptimisticComments = prev.comments.filter(
        (c) => c.user_id === memberId && !serverCommentIds.has(c.id)
      );

      return {
        activeUserId: memberId,
        votes: [...result.state.votes, ...localOptimisticVotes],
        comments: [...result.state.comments, ...localOptimisticComments],
        overrides: result.state.overrides,
        attendOverrides: savedLocal.attendOverrides, // keep local
      };
    });
  }, []);

  useEffect(() => {
    if (!crewSession || isDemo) return;
    const { crewId, memberId } = crewSession;

    reloadCrewData(crewId, memberId);

    // Debounce realtime reloads so a burst of writes (multiple hearts in
    // rapid succession) coalesces into a single reload. Combined with the
    // optimistic-merge in reloadCrewData, this prevents the user's own
    // optimistic UI updates from flickering while Supabase catches up.
    let pending: ReturnType<typeof setTimeout> | null = null;
    unsubRef.current = subscribeToChanges(crewId, () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        reloadCrewData(crewId, memberId);
      }, 350);
    });

    return () => {
      if (pending) clearTimeout(pending);
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

  // Toast / undo for last vote action. Festival-finger UX — a single mistap
  // shouldn't permanently lose a vote.
  const [toast, setToast] = useState<{ kind: "added" | "removed"; setName: string; undo: () => void } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((kind: "added" | "removed", setName: string, undo: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ kind, setName, undo });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Wrap setAppState to sync to Supabase
  const setAppStateWithSync: React.Dispatch<React.SetStateAction<AppState>> = useCallback(
    (action) => {
      setAppState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;

        // Detect single-vote toggles for the active user → surface an undo toast.
        // Works in both demo and real modes; uses prev.activeUserId as the source of truth.
        const me = prev.activeUserId;
        const addedForMe = next.votes.filter(
          (v) => v.user_id === me && !prev.votes.some((pv) => pv.user_id === me && pv.set_id === v.set_id)
        );
        const removedForMe = prev.votes.filter(
          (v) => v.user_id === me && !next.votes.some((nv) => nv.user_id === me && nv.set_id === v.set_id)
        );
        if (addedForMe.length === 1 && removedForMe.length === 0) {
          const v = addedForMe[0];
          const found = lineup.sets.find((s) => s.id === v.set_id);
          if (found) {
            showToast("added", found.artist_name, () => {
              setAppState((s) => ({
                ...s,
                votes: s.votes.filter((x) => !(x.user_id === me && x.set_id === v.set_id)),
              }));
            });
          }
        } else if (removedForMe.length === 1 && addedForMe.length === 0) {
          const v = removedForMe[0];
          const found = lineup.sets.find((s) => s.id === v.set_id);
          if (found) {
            showToast("removed", found.artist_name, () => {
              setAppState((s) => ({ ...s, votes: [...s.votes, v] }));
            });
          }
        }

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
                <span className="kick-pulse grid size-10 place-items-center rounded-2xl bg-pink/20 text-xl shadow-glowPink transition group-hover:scale-105">
                  🦉
                </span>
                <span>
                  <span className="block font-display text-2xl font-bold tracking-tight text-white">flowwwww</span>
                  <span className="block text-[0.65rem] font-bold uppercase tracking-[0.28em] text-cyan/85">EDC LV 2026</span>
                </span>
              </button>

              <div className="flex items-center gap-2">
                <ThemeToggle />

                {/* Crew selector — active member gets a stronger ring + glow + scale
                    so identity is unambiguous at a glance, not just "opacity 0.7 vs 1". */}
                <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 p-1">
                {crew.map((member) => {
                  const active = appState.activeUserId === member.id;
                  return (
                    <button
                      key={member.id}
                      className={`grid size-9 place-items-center rounded-full border-2 text-base transition ${
                        active
                          ? "scale-110 bg-white/15"
                          : "bg-night/60 opacity-65 hover:opacity-90"
                      }`}
                      style={{
                        borderColor: member.color,
                        boxShadow: active ? `0 0 12px ${member.color}99` : undefined
                      }}
                      title={member.name}
                      onClick={() => {
                        if (isDemo) setAppState((state) => ({ ...state, activeUserId: member.id }));
                      }}
                    >
                    {member.emoji}
                  </button>
                  );
                })}
                </div>
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
                    appState={appState}
                    flowCount={flow.length}
                  />
                </ScreenFrame>
              )}
              {screen === "lineup" && (
                <ScreenFrame key="lineup">
                  <LineupTab
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

        {/* Undo toast — sits above the bottom nav so it doesn't fight tap targets.
            Auto-dismisses after 4s, or instantly when the user taps Undo. */}
        <AnimatePresence>
          {toast && (
            <UndoToast
              key={`${toast.kind}-${toast.setName}`}
              toast={toast}
              onDismiss={() => setToast(null)}
            />
          )}
        </AnimatePresence>

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

/**
 * Theme shuffler — three-segment selector showing all available themes side
 * by side. Each segment uses a swatch coloured to *preview* its theme:
 *   PLUR — pink-violet rave (deep, saturated, glowing)
 *   HOLO — pearlescent foil swatch (rainbow conic gradient)
 *   MONO — paper-white with ink dot (clean and quiet)
 *
 * Replaces the previous single-glyph cycler. The visible 3-up layout makes
 * the multi-theme nature obvious and lets users jump directly to any theme
 * instead of cycling through to find the one they want. Active segment uses
 * a shared-layoutId background animation so the selection slides physically
 * between options — same pattern as the Lineup view-mode toggle.
 *
 * Choice persists via the ThemeProvider in src/lib/theme.tsx.
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const segments: { key: import("@/lib/theme").ThemeName; label: string; swatch: string; activeText: string }[] = [
    {
      key: "plur",
      label: "Rave",
      // Saturated pink→violet→cyan rave gradient.
      swatch: "linear-gradient(135deg, #FF3DCB 0%, #B94FFF 50%, #00FFDC 100%)",
      activeText: "text-white",
    },
    {
      key: "holo",
      // Rainbow conic foil — the very thing the holo theme is named after.
      label: "Foil",
      swatch: "conic-gradient(from 0deg, #ff8ad4, #c873ff, #7ed8ff, #b8ffd1, #fff39c, #ff8ad4)",
      activeText: "text-[#2a1042]",
    },
    {
      key: "mono",
      // Paper white with a subtle ink dot — quiet and clean.
      label: "Mono",
      swatch: "radial-gradient(circle at 50% 50%, #0e0e10 0 22%, #fafaf8 24%)",
      activeText: "text-[#0e0e10]",
    },
  ];

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 p-0.5"
      role="radiogroup"
      aria-label="Visual theme"
    >
      {segments.map((seg) => {
        const active = theme === seg.key;
        return (
          <motion.button
            key={seg.key}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            role="radio"
            aria-checked={active}
            aria-label={`${seg.label} theme`}
            title={`${seg.label} theme`}
            className="relative grid size-7 place-items-center rounded-full"
            onClick={() => setTheme(seg.key)}
          >
            {active && (
              <motion.span
                layoutId="theme-shuffler-active"
                className="absolute inset-0 rounded-full"
                style={{ background: seg.swatch }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              />
            )}
            {/* Inactive: small swatch glyph so users can preview each theme.
                Active: the swatch fills the background via layoutId, and the
                glyph here just provides a tiny readable "•" mark. */}
            {active ? (
              <span className={`relative text-[0.7rem] font-black ${seg.activeText}`}>•</span>
            ) : (
              <span
                aria-hidden
                className="block size-4 rounded-full opacity-90"
                style={{ background: seg.swatch }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * Bottom toast with an Undo button. Slides up above the bottom nav.
 * Auto-dismisses after 4s; tapping Undo reverses the action immediately.
 *
 * Lives outside <main> so it can use a fixed-position overlay without
 * inheriting the page padding. Z-index 50 (above nav z-40, below modals).
 */
function UndoToast({
  toast,
  onDismiss,
}: {
  toast: { kind: "added" | "removed"; setName: string; undo: () => void };
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      // Hovers above the bottom nav (5.5rem clearance for nav height + breathing room).
      style={{ bottom: `calc(env(safe-area-inset-bottom, 0.75rem) + 5.5rem)` }}
    >
      <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-full border border-white/15 bg-night/95 px-4 py-2 shadow-glowPink backdrop-blur-2xl">
        <span className={`text-xs font-bold uppercase tracking-[0.18em] ${toast.kind === "added" ? "text-cyan" : "text-pink"}`}>
          {toast.kind === "added" ? "♥ Added" : "✕ Removed"}
        </span>
        <span className="truncate text-sm font-bold text-white">{toast.setName}</span>
        <button
          onClick={() => {
            toast.undo();
            onDismiss();
          }}
          className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-night transition hover:bg-white/85"
        >
          Undo
        </button>
      </div>
    </motion.div>
  );
}
