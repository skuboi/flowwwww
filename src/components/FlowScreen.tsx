import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrew } from "@/lib/crew-context";
import { lineup, nightLabels, nights, shortNightLabels } from "@/lib/data";
import {
  formatSetTime,
  formatTime,
  getHeadliner,
  getSetVotes,
  getTimelineInterstitials,
  getVoters,
  resolveFlow,
  stageFor
} from "@/lib/flow";
import type { AppState, FestivalSet, FlowItem, Night } from "@/lib/types";
import type { GapSuggestion } from "@/lib/flow";
import { GridView } from "./GridView";
import { DayTabs, Pill, ScreenTitle, spring } from "./ui";

export type Screen = "home" | "lineup" | "flow";
type FlowMode = "grid" | "timeline" | "swipe" | "wallpaper";
type ViewNight = Night | "all";

export function FlowScreen({
  activeNight,
  setActiveNight,
  appState,
  setAppState,
  setScreen
}: {
  activeNight: Night;
  setActiveNight: (night: Night) => void;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  setScreen: (screen: Screen) => void;
}) {
  const [mode, setMode] = useState<FlowMode>("grid");
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [viewNight, setViewNight] = useState<ViewNight>(activeNight);

  // Keep viewNight in sync when activeNight changes (unless "all" is selected)
  useEffect(() => {
    setViewNight((prev) => (prev === "all" ? prev : activeNight));
  }, [activeNight]);

  const effectiveNight: Night = viewNight === "all" ? activeNight : viewNight;

  const items = useMemo(
    () => resolveFlow(lineup.sets, appState.votes, appState.overrides, effectiveNight, appState.attendOverrides),
    [effectiveNight, appState.overrides, appState.votes, appState.attendOverrides]
  );

  const allNightsItems = useMemo(() => {
    if (viewNight !== "all") return null;
    return nights.map((night) => ({
      night,
      items: resolveFlow(lineup.sets, appState.votes, appState.overrides, night, appState.attendOverrides),
      headlinerId: getHeadliner(
        resolveFlow(lineup.sets, appState.votes, appState.overrides, night, appState.attendOverrides),
        appState.votes
      )
    }));
  }, [viewNight, appState.overrides, appState.votes, appState.attendOverrides]);

  const headlinerId = getHeadliner(items, appState.votes);

  useEffect(() => {
    setSwipeIndex(0);
  }, [activeNight]);

  useEffect(() => {
    setSwipeIndex((index) => Math.min(index, Math.max(items.length - 1, 0)));
  }, [items.length]);

  function overrideFlow(group: FestivalSet[], selectedSetId: string) {
    const ids = group.map((set) => set.id).sort();
    setAppState((state) => ({
      ...state,
      overrides: [
        // Remove any overrides that selected a set in this clash group
        ...state.overrides.filter((o) => !ids.includes(o.selected_set_id)),
        { clashing_set_ids: ids, selected_set_id: selectedSetId }
      ]
    }));
  }

  function handleViewNightChange(vn: ViewNight) {
    setViewNight(vn);
    if (vn !== "all") setActiveNight(vn);
  }

  function handleHeartSuggestion(setId: string) {
    if (!appState.activeUserId) return;
    setAppState((state) => ({
      ...state,
      votes: [
        ...state.votes,
        { user_id: state.activeUserId, set_id: setId, created_at: new Date().toISOString() }
      ]
    }));
  }

  return (
    <div className="grid gap-4">
      <ScreenTitle eyebrow="Shared schedule" title="the flowwwww" copy="Auto-picked clashes, ghost losers, and a hype mode for revisiting the night." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DayTabs activeNight={effectiveNight} setActiveNight={(n) => handleViewNightChange(n)} compact />
          <button
            className={`rounded-2xl px-4 py-3 font-display text-sm font-bold transition ${
              viewNight === "all" ? "bg-cyan text-night shadow-glowCyan" : "text-white/55 hover:bg-white/8 hover:text-white"
            }`}
            onClick={() => handleViewNightChange(viewNight === "all" ? activeNight : "all")}
          >
            All
          </button>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 p-1">
          {(["grid", "timeline", "wallpaper"] as FlowMode[]).map((item) => (
            <button
              key={item}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition ${
                mode === item ? "bg-acid text-night shadow-glowAcid" : "text-white/58"
              }`}
              onClick={() => setMode(item)}
            >
              {item === "wallpaper" ? "📸" : item}
            </button>
          ))}
        </div>
      </div>

      {viewNight === "all" && (mode === "timeline" || mode === "grid") && allNightsItems ? (
        <AllNightsTimelineView allNightsItems={allNightsItems} appState={appState} onHeart={handleHeartSuggestion} />
      ) : viewNight === "all" && mode === "wallpaper" && allNightsItems ? (
        <AllNightsWallpaperView allNightsItems={allNightsItems} appState={appState} />
      ) : items.length === 0 ? (
        <SadOwl night={effectiveNight} setScreen={setScreen} />
      ) : mode === "grid" ? (
        <GridView items={items} appState={appState} setAppState={setAppState} headlinerId={headlinerId} overrideFlow={overrideFlow} />
      ) : mode === "timeline" ? (
        <TimelineView items={items} appState={appState} headlinerId={headlinerId} night={effectiveNight} onHeart={handleHeartSuggestion} />
      ) : (
        <WallpaperView items={items} appState={appState} headlinerId={headlinerId} night={effectiveNight} />
      )}
    </div>
  );
}

function TimelineView({
  items,
  appState,
  headlinerId,
  night,
  onHeart
}: {
  items: FlowItem[];
  appState: AppState;
  headlinerId?: string;
  night: Night;
  onHeart?: (setId: string) => void;
}) {
  const crew = useCrew();
  const interstitials = useMemo(
    () => getTimelineInterstitials(items, lineup.stages, lineup.sets, appState.votes, night),
    [items, appState.votes, night]
  );
  const interstitialsBySet = useMemo(() => {
    const map = new Map<string, typeof interstitials>();
    for (const item of interstitials) {
      const list = map.get(item.afterSetId) ?? [];
      list.push(item);
      map.set(item.afterSetId, list);
    }
    return map;
  }, [interstitials]);

  return (
    <div className="relative grid gap-4 pl-6">
      <div className="absolute bottom-6 left-2 top-6 w-px bg-gradient-to-b from-pink via-cyan to-acid" />
      {items.map((item) => {
        const stage = stageFor(item.set, lineup.stages);
        const voters = getVoters(item.set.id, appState.votes, crew);
        const comments = appState.comments.filter((comment) => comment.set_id === item.set.id).length;
        const isHeadliner = item.set.id === headlinerId;
        const alerts = interstitialsBySet.get(item.set.id);

        return (
          <div key={item.set.id} className="grid gap-3">
            <motion.article
              layout
              className="relative rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl"
              transition={spring}
            >
              <span className="absolute -left-[1.95rem] top-8 grid size-4 place-items-center rounded-full bg-cyan shadow-glowCyan" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {isHeadliner && <Pill tone="acid">HEADLINER</Pill>}
                    {comments > 0 && <Pill tone="cyan">{comments} comment{comments === 1 ? "" : "s"}</Pill>}
                  </div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">{formatSetTime(item.set)} · {stage.name}</p>
                  <h3 className="mt-1 font-display text-3xl font-black tracking-tight">{item.set.artist_name}</h3>
                </div>
                <div className="flex -space-x-1">
                  {voters.map((member) => (
                    <span key={member.id} className="grid size-9 place-items-center rounded-full border bg-night" style={{ borderColor: member.color }}>
                      {member.emoji}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>

            {alerts && alerts.map((alert, idx) => (
              <div key={`${alert.kind}-${idx}`} className="grid gap-2">
                <div
                  className={`relative ml-2 flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold ${
                    alert.kind === "gap"
                      ? "border-acid/30 bg-acid/8 text-acid"
                      : "border-cyan/30 bg-cyan/8 text-cyan"
                  }`}
                >
                  <span className="absolute -left-[1.95rem] top-1/2 grid size-2.5 -translate-y-1/2 place-items-center rounded-full" style={{ background: alert.kind === "gap" ? "#FFE600" : "#00FFDC" }} />
                  {alert.kind === "gap" ? "🕳️" : "🚶"} {alert.message}
                </div>
                {alert.kind === "gap" && alert.suggestions && alert.suggestions.length > 0 && (
                  <div className="ml-4 grid gap-1.5">
                    {alert.suggestions.map((sug: GapSuggestion) => (
                      <SuggestionCard key={sug.set.id} suggestion={sug} onHeart={onHeart} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onHeart
}: {
  suggestion: GapSuggestion;
  onHeart?: (setId: string) => void;
}) {
  const stage = stageFor(suggestion.set, lineup.stages);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3 py-2">
      <span className="text-sm">✨</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white/80">
          {suggestion.set.artist_name}
          <span className="ml-1.5 font-normal text-white/40">
            {formatSetTime(suggestion.set)} · <span style={{ color: stage?.color }}>{stage?.short}</span>
          </span>
        </p>
        <p className="truncate text-[0.6rem] italic text-white/35">{suggestion.reason}</p>
      </div>
      {onHeart && (
        <button
          className="shrink-0 rounded-lg border border-pink/30 bg-pink/10 px-2.5 py-1 text-[0.6rem] font-bold text-pink transition hover:bg-pink/20"
          onClick={() => onHeart(suggestion.set.id)}
        >
          ♡ heart
        </button>
      )}
    </div>
  );
}

function SwipeView({
  items,
  appState,
  headlinerId,
  swipeIndex,
  setSwipeIndex
}: {
  items: FlowItem[];
  appState: AppState;
  headlinerId?: string;
  swipeIndex: number;
  setSwipeIndex: React.Dispatch<React.SetStateAction<number>>;
}) {
  const crew = useCrew();
  const item = items[swipeIndex] ?? items[0];
  const stage = stageFor(item.set, lineup.stages);
  const voters = getVoters(item.set.id, appState.votes, crew);
  const isHeadliner = item.set.id === headlinerId;

  function move(delta: number) {
    setSwipeIndex((index) => Math.min(Math.max(index + delta, 0), items.length - 1));
  }

  return (
    <section
      className="relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/10 p-4 shadow-glowCyan sm:min-h-[42rem] sm:p-6"
      style={{
        background: `radial-gradient(circle at 50% 18%, ${stage.color}55, transparent 38%), linear-gradient(155deg, #0A0420, #1A0638 72%)`
      }}
    >
      <div className="relative z-10 mb-4 grid grid-cols-[1fr_auto] items-center gap-4">
        <div className="flex gap-1">
          {items.map((progressItem, index) => (
            <button
              key={progressItem.set.id}
              className={`h-1.5 flex-1 rounded-full ${index <= swipeIndex ? "bg-white" : "bg-white/22"}`}
              onClick={() => setSwipeIndex(index)}
            />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/58">
          {swipeIndex + 1} / {items.length}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.set.id}
          initial={{ opacity: 0, x: 80, rotate: 1.2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          exit={{ opacity: 0, x: -80, rotate: -1.2 }}
          transition={spring}
          className="relative z-10 grid min-h-[29rem] content-between rounded-[1.7rem] border border-white/10 bg-night/50 p-6 backdrop-blur-xl sm:min-h-[36rem] sm:p-8"
        >
          <div className="flex items-center justify-between gap-3">
            <Pill tone={item.state === "Open" ? "acid" : "pink"}>{item.state}</Pill>
            {isHeadliner && (
              <span className="flex items-center gap-2 rounded-full bg-acid px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-night shadow-glowAcid">
                <Crown size={15} /> Headliner
              </span>
            )}
          </div>

          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.35em]" style={{ color: stage.color }}>
              {stage.name} · {formatSetTime(item.set)}
            </p>
            <h3 className="font-display text-6xl font-black leading-[0.88] tracking-[-0.08em] sm:text-8xl">{item.set.artist_name}</h3>
            <p className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/8 p-4 text-lg leading-8 text-white/78">
              {item.set.sounds_like}
            </p>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex -space-x-2">
              {voters.map((member) => (
                <span key={member.id} className="grid size-12 place-items-center rounded-full border-2 bg-night text-2xl" style={{ borderColor: member.color }}>
                  {member.emoji}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="rounded-2xl border border-white/15 bg-white/8 px-5 py-3 font-bold text-white/70" onClick={() => move(-1)}>
                back
              </button>
              <button className="rounded-2xl bg-pink px-5 py-3 font-black text-night shadow-glowPink" onClick={() => move(1)}>
                tap ahead
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function WallpaperView({
  items,
  appState,
  headlinerId,
  night
}: {
  items: FlowItem[];
  appState: AppState;
  headlinerId?: string;
  night: Night;
}) {
  const crew = useCrew();
  const heartedCount = items.filter(
    (item) => getSetVotes(item.set.id, appState.votes).length > 0
  ).length;

  const firstTime = items.length > 0 ? formatTime(items[0].set.start_time) : "";
  const lastTime = items.length > 0 ? formatTime(items[items.length - 1].set.end_time) : "";

  return (
    <section
      className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/15 p-5"
      style={{
        background: "linear-gradient(170deg, #0A0420 0%, #1A0638 48%, #0D0225 100%)",
        aspectRatio: "9 / 19.5"
      }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="mb-3 text-center">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.4em] text-pink/80">flowwwww</p>
          <h2 className="font-display text-3xl font-black tracking-[-0.06em] text-white">
            {nightLabels[night]}
          </h2>
          <p className="text-[0.6rem] uppercase tracking-[0.35em] text-white/40">EDC LV 2026</p>
        </div>

        {/* Summary header */}
        <div className="mb-3 flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-cyan">
            {items.length} sets · {heartedCount} hearted
          </p>
          {firstTime && (
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/50">
              {firstTime} → {lastTime}
            </p>
          )}
        </div>

        {/* Set list */}
        <div className="flex flex-1 flex-col justify-center gap-[0.3rem]">
          {items.map((item) => {
            const stage = stageFor(item.set, lineup.stages);
            const voters = getVoters(item.set.id, appState.votes, crew);
            const isHeadliner = item.set.id === headlinerId;
            return (
              <div
                key={item.set.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  isHeadliner ? "bg-pink/15 ring-1 ring-pink/40" : "bg-white/[0.04]"
                }`}
                style={{ borderLeft: `3px solid ${stage.color}66` }}
              >
                <div className="w-[3.6rem] shrink-0">
                  <p className="font-display text-[0.65rem] font-bold leading-tight text-cyan">
                    {formatSetTime(item.set)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-display text-sm font-bold leading-tight tracking-tight ${isHeadliner ? "text-pink" : "text-white"}`}>
                    {isHeadliner ? "👑 " : ""}{item.set.artist_name}
                  </p>
                  <p className="truncate text-[0.55rem] uppercase tracking-[0.15em]" style={{ color: stage.color + "BB" }}>
                    {stage.name}
                    {item.state === "Open" ? " · ⚡ open" : ""}
                  </p>
                  <p className="mt-0.5 truncate text-[0.5rem] italic leading-tight text-white/35">
                    {item.set.sounds_like}
                  </p>
                </div>
                <div className="flex shrink-0 -space-x-1">
                  {voters.map((member) => (
                    <span key={member.id} className="text-[0.6rem]">{member.emoji}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <div className="flex justify-center -space-x-1">
            {crew.map((member) => (
              <span key={member.id} className="text-lg">{member.emoji}</span>
            ))}
          </div>
          <p className="mt-1 text-[0.5rem] uppercase tracking-[0.3em] text-white/30">screenshot this · set as wallpaper</p>
        </div>
      </div>
    </section>
  );
}

function AllNightsTimelineView({
  allNightsItems,
  appState,
  onHeart
}: {
  allNightsItems: { night: Night; items: FlowItem[]; headlinerId?: string }[];
  appState: AppState;
  onHeart?: (setId: string) => void;
}) {
  return (
    <div className="grid gap-6">
      {allNightsItems.map(({ night, items: nightItems, headlinerId: nightHeadliner }) => (
        <div key={night}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-display text-2xl font-black tracking-tight text-white">
              {nightLabels[night]}
            </h3>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              {nightItems.length} set{nightItems.length !== 1 ? "s" : ""}
            </span>
          </div>
          {nightItems.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center text-sm text-white/40">
              No hearted sets yet
            </p>
          ) : (
            <TimelineView items={nightItems} appState={appState} headlinerId={nightHeadliner} night={night} onHeart={onHeart} />
          )}
        </div>
      ))}
    </div>
  );
}

function AllNightsWallpaperView({
  allNightsItems,
  appState
}: {
  allNightsItems: { night: Night; items: FlowItem[]; headlinerId?: string }[];
  appState: AppState;
}) {
  const crew = useCrew();
  return (
    <section
      className="mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/15 p-5"
      style={{
        background: "linear-gradient(170deg, #0A0420 0%, #1A0638 48%, #0D0225 100%)"
      }}
    >
      {/* Header */}
      <div className="mb-4 text-center">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.4em] text-pink/80">flowwwww</p>
        <h2 className="font-display text-3xl font-black tracking-[-0.06em] text-white">
          All Nights
        </h2>
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-white/40">EDC LV 2026</p>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-3 gap-3">
        {allNightsItems.map(({ night, items: nightItems, headlinerId: nightHeadliner }) => (
          <div key={night} className="flex flex-col">
            <p className="mb-2 text-center font-display text-sm font-black tracking-tight text-cyan">
              {shortNightLabels[night]}
              <span className="ml-1 text-[0.55rem] font-bold text-white/40">
                ({nightItems.length})
              </span>
            </p>
            <div className="flex flex-1 flex-col gap-[0.2rem]">
              {nightItems.map((item) => {
                const stage = stageFor(item.set, lineup.stages);
                const voters = getVoters(item.set.id, appState.votes, crew);
                const isHeadliner = item.set.id === nightHeadliner;
                return (
                  <div
                    key={item.set.id}
                    className={`rounded-lg px-2 py-1.5 ${
                      isHeadliner ? "bg-pink/15 ring-1 ring-pink/40" : "bg-white/[0.04]"
                    }`}
                    style={{ borderLeft: `2px solid ${stage.color}66` }}
                  >
                    <p className={`truncate text-[0.65rem] font-bold leading-tight ${isHeadliner ? "text-pink" : "text-white"}`}>
                      {isHeadliner ? "👑 " : ""}{item.set.artist_name}
                    </p>
                    <p className="text-[0.5rem] leading-tight text-cyan/70">
                      {formatSetTime(item.set)}
                    </p>
                    <div className="flex -space-x-0.5">
                      {voters.map((member) => (
                        <span key={member.id} className="text-[0.5rem]">{member.emoji}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {nightItems.length === 0 && (
                <p className="rounded-lg bg-white/[0.04] px-2 py-4 text-center text-[0.55rem] text-white/30">
                  No sets
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 text-center">
        <div className="flex justify-center -space-x-1">
          {crew.map((member) => (
            <span key={member.id} className="text-lg">{member.emoji}</span>
          ))}
        </div>
        <p className="mt-1 text-[0.5rem] uppercase tracking-[0.3em] text-white/30">screenshot this · set as wallpaper</p>
      </div>
    </section>
  );
}

function SadOwl({ night, setScreen }: { night: Night; setScreen: (screen: Screen) => void }) {
  return (
    <section className="grid min-h-[28rem] place-items-center rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center">
      <div>
        <div className="mx-auto grid size-28 place-items-center rounded-[2rem] border border-pink/30 bg-pink/10 text-6xl shadow-glowPink">🦉</div>
        <h2 className="mt-6 font-display text-4xl font-black tracking-[-0.06em]">No vibes detected yet.</h2>
        <p className="mx-auto mt-2 max-w-md text-white/58">Friday, Saturday, Sunday — the owl needs hearts before it can draw a route.</p>
        <button className="mt-6 rounded-2xl bg-pink px-6 py-4 font-display text-xl font-black text-night shadow-glowPink" onClick={() => setScreen("lineup")}>
          Explore {nightLabels[night]}&apos;s Lineup
        </button>
      </div>
    </section>
  );
}
