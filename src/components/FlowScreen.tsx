import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrew } from "@/lib/crew-context";
import { lineup, nightLabels, nights, shortNightLabels } from "@/lib/data";
import {
  attendEndIso,
  attendStartIso,
  formatAttendTime,
  formatSetTime,
  formatTime,
  getHeadliner,
  getSetVotes,
  getTimelineInterstitials,
  getVoters,
  hasAttendTrim,
  resolveFlow,
  stageFor
} from "@/lib/flow";
import type { AppState, FestivalSet, FlowItem, Night } from "@/lib/types";
import type { GapSuggestion } from "@/lib/flow";
import { GridView } from "./GridView";
import { DayTabs, Pill, ScreenTitle, softSpring, spring, tap } from "./ui";

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

  // Conflict summary stats — shown as a chip in the header so the user can
  // see at a glance how many decisions still need crew input. Counts ghosts
  // (auto-picked losers) + open ties across the active scope.
  const conflictStats = useMemo(() => {
    const scopeItems = viewNight === "all" && allNightsItems
      ? allNightsItems.flatMap((n) => n.items)
      : items;
    let openCount = 0;
    let autoPickedCount = 0;
    for (const it of scopeItems) {
      if (it.state === "Open") openCount++;
      else if (it.state === "Auto-picked") autoPickedCount++;
    }
    return { openCount, autoPickedCount };
  }, [items, allNightsItems, viewNight]);

  return (
    <div className="grid gap-4">
      <ScreenTitle eyebrow="Shared schedule" title="the flowwwww" copy="Auto-picked clashes, ghost losers, and a hype mode for revisiting the night." />
      {(conflictStats.openCount > 0 || conflictStats.autoPickedCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
          {conflictStats.openCount > 0 && (
            <span className="rounded-full border border-acid/55 bg-acid/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-acid shadow-glowAcid">
              ⚡ {conflictStats.openCount} open clash{conflictStats.openCount === 1 ? "" : "es"}
            </span>
          )}
          {conflictStats.autoPickedCount > 0 && (
            <span className="rounded-full border border-cyan/45 bg-cyan/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan">
              {conflictStats.autoPickedCount} auto-picked
            </span>
          )}
          <span className="ml-auto text-xs text-white/65">
            Tap any card with a ghost to swap or trim.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DayTabs activeNight={effectiveNight} setActiveNight={(n) => handleViewNightChange(n)} compact />
          <motion.button
            whileTap={tap}
            transition={softSpring}
            className={`rounded-2xl px-4 py-3 font-display text-sm font-bold ${
              viewNight === "all" ? "bg-grape text-white shadow-glowGrape" : "text-white/60 hover:bg-white/8 hover:text-white"
            }`}
            onClick={() => handleViewNightChange(viewNight === "all" ? activeNight : "all")}
          >
            All
          </motion.button>
        </div>
        {/* Mode switch: shared layoutId on the active background means the acid
            pill physically slides between options instead of cross-fading. */}
        <div className="relative rounded-full border border-white/10 bg-white/5 p-1">
          <div className="flex">
            {(["grid", "timeline", "wallpaper"] as FlowMode[]).map((item) => {
              const active = mode === item;
              return (
                <motion.button
                  key={item}
                  whileTap={tap}
                  transition={softSpring}
                  className={`relative rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] ${
                    active ? "text-night" : "text-white/65 hover:text-white"
                  }`}
                  onClick={() => setMode(item)}
                >
                  {active && (
                    <motion.span
                      layoutId="flow-mode-active"
                      className="absolute inset-0 rounded-full bg-acid shadow-glowAcid"
                      transition={spring}
                    />
                  )}
                  <span className="relative">{item === "wallpaper" ? "📸" : item}</span>
                </motion.button>
              );
            })}
          </div>
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

  // Re-sort by *effective* start time so a trimmed-late set lands where the
  // crew actually shows up — not at the artist's official start. This makes
  // the timeline a real snapshot of the night, not just a list of picks.
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          Date.parse(attendStartIso(a.set, appState.attendOverrides)) -
          Date.parse(attendStartIso(b.set, appState.attendOverrides))
      ),
    [items, appState.attendOverrides]
  );

  return (
    <div className="relative grid gap-4 pl-6">
      <div className="absolute bottom-6 left-2 top-6 w-px bg-gradient-to-b from-pink via-cyan to-acid" />
      {sortedItems.map((item) => {
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
                  <p className="text-xs uppercase tracking-[0.24em] text-white/55">
                    {formatAttendTime(item.set, appState.attendOverrides)} · {stage.name}
                    {hasAttendTrim(item.set, appState.attendOverrides) && (
                      <span className="ml-1 normal-case tracking-normal text-cyan" title="Partial attendance">✂ trimmed</span>
                    )}
                  </p>
                  <h3 className="mt-1 font-display text-3xl font-black tracking-tight">{item.set.artist_name}</h3>
                </div>
                <div className="flex -space-x-1.5">
                  {voters.map((member) => (
                    <span key={member.id} className="grid size-9 place-items-center rounded-full border-2 bg-night text-base" style={{ borderColor: member.color }}>
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
        <p className="truncate text-xs font-bold text-white/85">
          {suggestion.set.artist_name}
          <span className="ml-1.5 font-normal text-white/55">
            {formatSetTime(suggestion.set)} · <span style={{ color: stage?.color }}>{stage?.short}</span>
          </span>
        </p>
        <p className="truncate text-[0.7rem] italic text-white/55">{suggestion.reason}</p>
      </div>
      {onHeart && (
        <motion.button
          whileTap={tap}
          whileHover={{ y: -1 }}
          transition={softSpring}
          className="shrink-0 rounded-lg border border-pink/40 bg-pink/15 px-3 py-1.5 text-xs font-bold text-pink hover:bg-pink/25"
          onClick={() => onHeart(suggestion.set.id)}
        >
          ♡ heart
        </motion.button>
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
            <div className="flex -space-x-1.5">
              {voters.map((member) => (
                <span key={member.id} className="grid size-12 place-items-center rounded-full border-2 bg-night text-2xl" style={{ borderColor: member.color }}>
                  {member.emoji}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <motion.button whileTap={tap} whileHover={{ y: -1 }} transition={softSpring} className="rounded-2xl border border-white/15 bg-white/8 px-5 py-3 font-bold text-white/75" onClick={() => move(-1)}>
                back
              </motion.button>
              <motion.button whileTap={tap} whileHover={{ y: -2 }} transition={softSpring} className="rounded-2xl bg-pink px-5 py-3 font-black text-night shadow-glowPink" onClick={() => move(1)}>
                tap ahead
              </motion.button>
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

  // Per-export preset state. These are local to the wallpaper view (NOT the
  // global theme) so a user can try a few looks without committing the whole
  // app to the change. Defaults: "violet" gradient + iPhone 17 Pro aspect.
  const [palette, setPalette] = useState<PaletteId>("violet");
  const [dimension, setDimension] = useState<DimensionId>("iphone17pro");
  const dim = DIMENSION_PRESETS[dimension];
  const pal = PALETTE_PRESETS[palette];

  // Sort + bracket by *attended* times so the wallpaper shows the actual day.
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          Date.parse(attendStartIso(a.set, appState.attendOverrides)) -
          Date.parse(attendStartIso(b.set, appState.attendOverrides))
      ),
    [items, appState.attendOverrides]
  );

  const firstTime = sortedItems.length > 0 ? formatTime(attendStartIso(sortedItems[0].set, appState.attendOverrides)) : "";
  const lastTime = sortedItems.length > 0 ? formatTime(attendEndIso(sortedItems[sortedItems.length - 1].set, appState.attendOverrides)) : "";

  // Adaptive density: row size + font scale shrink as the set count grows so
  // the entire schedule always fits the chosen container without overflow.
  // Square (1:1) gets aggressive scaling because vertical space is scarcest;
  // tall aspects (iPhone, 9:16) can stay roomy until 20+ items.
  const density = computeWallpaperDensity(sortedItems.length, dimension);

  return (
    <div className="grid gap-3">
      <WallpaperToolbar
        palette={palette}
        setPalette={setPalette}
        dimension={dimension}
        setDimension={setDimension}
      />
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/65">
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-bold uppercase tracking-[0.18em]">
          {dim.label} · {dim.nativeRes}
        </span>
        <span className="opacity-80">Long-press to save · set as wallpaper</span>
      </div>
      <section
        // Aspect + safe-area padding both come from the chosen dimension preset
        // (see DIMENSION_PRESETS). For iPhone 17 Pro we leave room for the
        // Dynamic Island and home indicator. For 9:16 and 1:1 we use lighter
        // padding because those targets aren't iOS-locked.
        className={`mx-auto w-full overflow-hidden border border-white/15 shadow-glowPink ${dim.containerMaxW} ${dim.borderRadius}`}
        style={{
          background: pal.background,
          aspectRatio: dim.aspectRatio,
        }}
      >
        <div className={`flex h-full flex-col ${dim.padding}`}>
        {/* Header — just the night title. */}
        <div className="mb-2 text-center">
          <h2
            className="font-display font-black tracking-[-0.06em] text-white"
            style={{ fontSize: density.titleRem }}
          >
            {nightLabels[night]}
          </h2>
        </div>

        {/* Set list — single-line rows, artist name dominant. Stripped to:
              [start time]  ARTIST NAME (HUGE)  · stage (subtle short code)
            Voters + comment indicators + dual-time ranges are intentionally
            omitted from the export — the goal is a glanceable wallpaper, not
            a data dashboard. The full info lives in the in-app timeline.

            justify-start (not center) so vertical aspects like 9:16 don't
            leave huge dead space above/below — the schedule reads top-down. */}
        <div
          className="flex flex-1 flex-col justify-start"
          style={{ gap: density.gapRem }}
        >
          {sortedItems.map((item) => {
            const stage = stageFor(item.set, lineup.stages);
            const isHeadliner = item.set.id === headlinerId;
            // Show start time only — saves a wrap line on tight aspects.
            const startLabel = formatTime(attendStartIso(item.set, appState.attendOverrides));
            return (
              <div
                key={item.set.id}
                className="flex items-start gap-2 overflow-hidden rounded-lg"
                style={{
                  paddingLeft: "0.6rem",
                  paddingRight: "0.6rem",
                  paddingTop: density.rowPadRem,
                  paddingBottom: density.rowPadRem,
                  borderLeft: `3px solid ${stage.color}`,
                  background: isHeadliner ? `${pal.eyebrow}28` : "rgba(255,255,255,0.04)",
                  boxShadow: isHeadliner ? `inset 0 0 0 1px ${pal.eyebrow}80` : undefined,
                }}
              >
                {/* Time prefix — small, neutral weight, fixed width so artist
                    names align across rows. Top-aligned so it sits with the
                    first line when the artist name wraps to two. */}
                <span
                  className="shrink-0 pt-[0.1em] font-display font-bold tabular-nums leading-none"
                  style={{
                    color: pal.accent,
                    fontSize: density.timeRem,
                    width: density.timeColRem,
                  }}
                >
                  {startLabel.replace(/\s?(AM|PM)$/, "")}
                </span>

                {/* Artist name — the star of the row. Allowed to wrap to TWO
                    lines so long names ("The Chainsmokers", "Porter Robinson
                    (DJ Set)", "Charlotte de Witte") read in full instead of
                    being chopped at 12 chars. Density tiers shrink the font
                    aggressively rather than truncating. */}
                <span
                  className="min-w-0 flex-1 break-words font-display font-black leading-[1.05] tracking-tight"
                  style={{
                    color: isHeadliner ? pal.eyebrow : "#ffffff",
                    fontSize: density.artistRem,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {isHeadliner ? "👑 " : ""}{item.set.artist_name}
                </span>

                {/* Stage — short code (e.g. "KIN"). Top-aligned to ride with
                    the artist name's first line. */}
                {density.showStage && (
                  <span
                    className="shrink-0 pt-[0.25em] font-bold uppercase leading-none tracking-[0.15em] opacity-80"
                    style={{
                      color: stage.color,
                      fontSize: density.stageRem,
                    }}
                  >
                    {stage.short}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </section>
    </div>
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
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-pink/85">flowwwww</p>
        <h2 className="font-display text-3xl font-black tracking-[-0.06em] text-white">
          All Nights
        </h2>
        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-white/55">EDC LV 2026</p>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-3 gap-3">
        {allNightsItems.map(({ night, items: nightItems, headlinerId: nightHeadliner }) => (
          <div key={night} className="flex flex-col">
            <p className="mb-2 text-center font-display text-sm font-black tracking-tight text-cyan">
              {shortNightLabels[night]}
              <span className="ml-1 text-[0.65rem] font-bold text-white/55">
                ({nightItems.length})
              </span>
            </p>
            <div className="flex flex-1 flex-col gap-1">
              {[...nightItems]
                .sort(
                  (a, b) =>
                    Date.parse(attendStartIso(a.set, appState.attendOverrides)) -
                    Date.parse(attendStartIso(b.set, appState.attendOverrides))
                )
                .map((item) => {
                const stage = stageFor(item.set, lineup.stages);
                const voters = getVoters(item.set.id, appState.votes, crew);
                const isHeadliner = item.set.id === nightHeadliner;
                return (
                  <div
                    key={item.set.id}
                    className={`rounded-lg px-2 py-1.5 ${
                      isHeadliner ? "bg-pink/18 ring-1 ring-pink/50" : "bg-white/[0.05]"
                    }`}
                    style={{ borderLeft: `2px solid ${stage.color}88` }}
                  >
                    <p className={`truncate text-[0.72rem] font-bold leading-tight ${isHeadliner ? "text-pink" : "text-white"}`}>
                      {isHeadliner ? "👑 " : ""}{item.set.artist_name}
                    </p>
                    <p className="text-[0.6rem] font-bold leading-tight text-cyan/85">
                      {formatAttendTime(item.set, appState.attendOverrides)}
                    </p>
                    <div className="flex gap-0.5">
                      {voters.map((member) => (
                        <span key={member.id} className="text-[0.65rem]">{member.emoji}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {nightItems.length === 0 && (
                <p className="rounded-lg bg-white/[0.04] px-2 py-4 text-center text-[0.7rem] text-white/45">
                  No sets
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 text-center">
        <div className="flex justify-center gap-1">
          {crew.map((member) => (
            <span key={member.id} className="text-xl">{member.emoji}</span>
          ))}
        </div>
        <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.3em] text-white/55">screenshot this · set as wallpaper</p>
      </div>
    </section>
  );
}

function SadOwl({ night, setScreen }: { night: Night; setScreen: (screen: Screen) => void }) {
  return (
    <section className="grid min-h-[28rem] place-items-center rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center">
      <div>
        <div className="kick-pulse mx-auto grid size-28 place-items-center rounded-[2rem] border border-pink/30 bg-pink/10 text-6xl shadow-glowPink">🦉</div>
        <h2 className="mt-6 font-display text-4xl font-black tracking-[-0.06em]">No vibes detected yet.</h2>
        <p className="mx-auto mt-2 max-w-md text-white/70">Friday, Saturday, Sunday — the owl needs hearts before it can draw a route.</p>
        <motion.button
          whileTap={tap}
          whileHover={{ y: -2 }}
          transition={spring}
          className="mt-6 rounded-2xl bg-pink px-6 py-4 font-display text-xl font-black text-night shadow-glowPink"
          onClick={() => setScreen("lineup")}
        >
          Explore {nightLabels[night]}&apos;s Lineup
        </motion.button>
      </div>
    </section>
  );
}

// ---------- Wallpaper export presets -----------------------------------

/**
 * Palette presets for the wallpaper export.
 *
 * Each preset has:
 *   - background: full CSS background string (gradients welcome)
 *   - eyebrow:    accent color used for the "flowwwww" header + headliner row
 *   - accent:     secondary accent used for time labels + summary stat
 *
 * Kept local to FlowScreen because these are a wallpaper-export concern,
 * NOT a global theme shift (the global theme system in src/lib/theme.tsx
 * handles the in-app chrome separately).
 */
type PaletteId = "violet" | "sunset" | "ocean" | "monochrome" | "acid";
const PALETTE_PRESETS: Record<
  PaletteId,
  { label: string; background: string; eyebrow: string; accent: string; previewSwatch: string }
> = {
  violet: {
    label: "Violet rave",
    background: "linear-gradient(170deg, #0A0420 0%, #1A0638 48%, #0D0225 100%)",
    eyebrow: "#FF3DCB",
    accent: "#00FFDC",
    previewSwatch: "linear-gradient(135deg, #1A0638, #0A0420)",
  },
  sunset: {
    label: "Sunset desert",
    background: "linear-gradient(170deg, #2B0A2E 0%, #C2185B 38%, #FF7A3D 78%, #FFE600 100%)",
    eyebrow: "#FFE600",
    accent: "#FFFFFF",
    previewSwatch: "linear-gradient(135deg, #C2185B, #FF7A3D)",
  },
  ocean: {
    label: "Ocean drift",
    background: "linear-gradient(170deg, #021F3F 0%, #044C8A 45%, #00BFA6 100%)",
    eyebrow: "#00FFDC",
    accent: "#B8E0FF",
    previewSwatch: "linear-gradient(135deg, #044C8A, #00BFA6)",
  },
  monochrome: {
    label: "Monochrome",
    background: "linear-gradient(170deg, #0A0A0A 0%, #1F1F1F 100%)",
    eyebrow: "#FFFFFF",
    accent: "#A8A8A8",
    previewSwatch: "linear-gradient(135deg, #0A0A0A, #2A2A2A)",
  },
  acid: {
    label: "Acid glow",
    background: "linear-gradient(170deg, #04111B 0%, #08362F 45%, #0A4A2A 100%)",
    eyebrow: "#C9FF4D",
    accent: "#00FFDC",
    previewSwatch: "linear-gradient(135deg, #08362F, #C9FF4D)",
  },
};

/**
 * Dimension presets. Each one:
 *   - aspectRatio:    CSS aspect-ratio (string)
 *   - nativeRes:      what the export renders to at full size
 *   - containerMaxW:  Tailwind class to size the on-screen preview
 *   - borderRadius:   matches device or square corner
 *   - padding:        per-target safe-area padding
 */
type DimensionId = "iphone17pro" | "vertical9x16" | "square";
const DIMENSION_PRESETS: Record<
  DimensionId,
  { label: string; nativeRes: string; aspectRatio: string; containerMaxW: string; borderRadius: string; padding: string }
> = {
  iphone17pro: {
    label: "iPhone 17 Pro",
    nativeRes: "1206 × 2622",
    aspectRatio: "1206 / 2622",
    containerMaxW: "max-w-xs",
    borderRadius: "rounded-[2.4rem]",
    // 13% top for Dynamic Island clock area, 4% bottom for home indicator.
    padding: "px-5 pb-[4%] pt-[13%]",
  },
  vertical9x16: {
    label: "9 : 16 vertical",
    nativeRes: "1080 × 1920",
    aspectRatio: "9 / 16",
    containerMaxW: "max-w-xs",
    borderRadius: "rounded-2xl",
    // No iOS safe-area concern — moderate even padding all around.
    padding: "p-5",
  },
  square: {
    label: "1 : 1 square",
    nativeRes: "1080 × 1080",
    aspectRatio: "1 / 1",
    containerMaxW: "max-w-md",
    borderRadius: "rounded-2xl",
    padding: "p-5",
  },
};

/**
 * Toolbar above the wallpaper preview. Two pill rows: palette swatches
 * (color picker scoped to wallpaper only — does not affect app chrome) and
 * dimension presets. Both use the same shared-layoutId selection animation
 * grammar as the rest of the app's toggles for consistency.
 */
function WallpaperToolbar({
  palette,
  setPalette,
  dimension,
  setDimension,
}: {
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
  dimension: DimensionId;
  setDimension: (id: DimensionId) => void;
}) {
  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      {/* Palette row */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/60">
          Palette
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(PALETTE_PRESETS) as PaletteId[]).map((id) => {
            const p = PALETTE_PRESETS[id];
            const active = palette === id;
            return (
              <button
                key={id}
                onClick={() => setPalette(id)}
                title={p.label}
                aria-label={p.label}
                aria-pressed={active}
                className={`relative grid size-8 shrink-0 place-items-center rounded-full transition ${
                  active ? "ring-2 ring-white shadow-glowPink" : "ring-1 ring-white/15 hover:ring-white/40"
                }`}
                style={{ background: p.previewSwatch }}
              >
                {/* Two-tone dot inside each swatch shows the accent colors */}
                <span className="grid size-3 place-items-center rounded-full" style={{ background: p.eyebrow }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimension row */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/60">
          Size
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(DIMENSION_PRESETS) as DimensionId[]).map((id) => {
            const d = DIMENSION_PRESETS[id];
            const active = dimension === id;
            return (
              <button
                key={id}
                onClick={() => setDimension(id)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.15em] transition ${
                  active
                    ? "bg-cyan text-night shadow-glowCyan"
                    : "border border-white/15 bg-white/5 text-white/70 hover:border-white/35"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Compute adaptive font sizes / spacing for the wallpaper set list so that
 * any number of hearted sets fits the chosen container without overflow.
 *
 * Why dynamic and not fixed: a 10-item Friday looks great with roomy rows,
 * but a 25-item Saturday in the 1:1 square preset would visually overflow
 * with the same row metrics. We pick a "tier" based on item count + the
 * vertical real estate available in the chosen dimension, and return all
 * the per-row size knobs as one bundle the WallpaperView spreads inline.
 *
 * Tiers err on "still legible at the chosen export resolution." Anything
 * tighter than tier "tight" hides the per-row stage label.
 */
function computeWallpaperDensity(
  itemCount: number,
  dimension: DimensionId
): {
  titleRem: string;
  rowPadRem: string;
  gapRem: string;
  timeColRem: string;
  timeRem: string;
  artistRem: string;
  stageRem: string;
  stageMaxWRem: string;
  showStage: boolean;
} {
  // Vertical density factor. Square has the least height-per-item, so its
  // tier-up thresholds kick in earliest. 9:16 sits between iPhone and square.
  // Updated multipliers reflect the new single-line row design — square gets
  // dramatically more capacity now (no more 2-line wrapping per row).
  const verticalBudget =
    dimension === "iphone17pro" ? 1.0
    : dimension === "vertical9x16" ? 0.78
    : 0.42; // square — much less height per item

  const effective = itemCount / verticalBudget;

  // Tiers tuned for SINGLE-LINE rows. Artist name dominates at every tier;
  // only the lowest tier ("micro") drops the stage label. Generous because
  // single-line rows pack ~2x denser than the previous 2-line layout.
  let tier: "hero" | "comfy" | "tight" | "packed" | "micro";
  if (effective <= 8) tier = "hero";
  else if (effective <= 14) tier = "comfy";
  else if (effective <= 22) tier = "tight";
  else if (effective <= 32) tier = "packed";
  else tier = "micro";

  switch (tier) {
    case "hero":
      // Generous mode for short flows. Artist name reads like a poster headline.
      return {
        titleRem: "1.875rem",
        rowPadRem: "0.55rem",
        gapRem: "0.45rem",
        timeColRem: "2.6rem",
        timeRem: "0.7rem",
        artistRem: "1.25rem",
        stageRem: "0.65rem",
        stageMaxWRem: "6rem",
        showStage: true,
      };
    case "comfy":
      return {
        titleRem: "1.625rem",
        rowPadRem: "0.4rem",
        gapRem: "0.32rem",
        timeColRem: "2.5rem",
        timeRem: "0.65rem",
        artistRem: "1.05rem",
        stageRem: "0.6rem",
        stageMaxWRem: "5.5rem",
        showStage: true,
      };
    case "tight":
      return {
        titleRem: "1.5rem",
        rowPadRem: "0.3rem",
        gapRem: "0.22rem",
        timeColRem: "2.4rem",
        timeRem: "0.6rem",
        artistRem: "0.92rem",
        stageRem: "0.55rem",
        stageMaxWRem: "5rem",
        showStage: true,
      };
    case "packed":
      return {
        titleRem: "1.375rem",
        rowPadRem: "0.22rem",
        gapRem: "0.16rem",
        timeColRem: "2.3rem",
        timeRem: "0.55rem",
        artistRem: "0.82rem",
        stageRem: "0.5rem",
        stageMaxWRem: "4.5rem",
        showStage: true,
      };
    case "micro":
      // Worst-case 35+ items. Drops stage label entirely. Artist name still
      // gets the lion's share of the row.
      return {
        titleRem: "1.25rem",
        rowPadRem: "0.16rem",
        gapRem: "0.1rem",
        timeColRem: "2.1rem",
        timeRem: "0.5rem",
        artistRem: "0.7rem",
        stageRem: "0.45rem",
        stageMaxWRem: "0",
        showStage: false,
      };
  }
}
