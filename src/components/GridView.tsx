import { useMemo, useState } from "react";
import { useCrew } from "@/lib/crew-context";
import { lineup } from "@/lib/data";
import {
  formatSetTime,
  formatTime,
  getSetVotes,
  getVoters,
  stageFor
} from "@/lib/flow";
import type { AppState, AttendOverride, FestivalSet, FlowItem } from "@/lib/types";
import { Pill } from "./ui";

const PX_PER_MIN = 3;

type GridSet = {
  set: FestivalSet;
  isWinner: boolean;
  flowItem: FlowItem;
  clashGroup: FestivalSet[];
};

export function GridView({
  items,
  appState,
  setAppState,
  headlinerId,
  overrideFlow
}: {
  items: FlowItem[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  headlinerId: string | undefined;
  overrideFlow: (group: FestivalSet[], selectedSetId: string) => void;
}) {
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const allSets: GridSet[] = useMemo(() => {
    const result: GridSet[] = [];
    for (const item of items) {
      const group = [item.set, ...item.clashingSets];
      result.push({ set: item.set, isWinner: true, flowItem: item, clashGroup: group });
      for (const loser of item.loserSets) {
        result.push({ set: loser, isWinner: false, flowItem: item, clashGroup: group });
      }
    }
    return result;
  }, [items]);

  const activeStages = useMemo(() => {
    const stageIds = Array.from(new Set(allSets.map((s) => s.set.stage_id)));
    const stageOrder = Object.keys(lineup.stages);
    return stageIds
      .sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b))
      .map((id) => ({ id, ...lineup.stages[id] }));
  }, [allSets]);

  const { nightStart, nightEnd, totalMinutes } = useMemo(() => {
    if (allSets.length === 0)
      return { nightStart: 0, nightEnd: 0, totalMinutes: 0 };
    const starts = allSets.map((s) => Date.parse(s.set.start_time));
    const ends = allSets.map((s) => Date.parse(s.set.end_time));
    const minMs = Math.min(...starts);
    const maxMs = Math.max(...ends);
    const slot = 30 * 60 * 1000;
    const start30 = Math.floor(minMs / slot) * slot;
    const end30 = Math.ceil(maxMs / slot) * slot;
    return { nightStart: start30, nightEnd: end30, totalMinutes: (end30 - start30) / (60 * 1000) };
  }, [allSets]);

  const totalHeight = totalMinutes * PX_PER_MIN;

  const timeLabels = useMemo(() => {
    const labels: { ms: number; label: string; top: number }[] = [];
    const slot = 30 * 60 * 1000;
    for (let t = nightStart; t < nightEnd; t += slot) {
      labels.push({
        ms: t,
        label: formatTime(new Date(t).toISOString()),
        top: ((t - nightStart) / (60 * 1000)) * PX_PER_MIN
      });
    }
    return labels;
  }, [nightStart, nightEnd]);

  function getOverride(setId: string): AttendOverride | undefined {
    return appState.attendOverrides.find((o) => o.set_id === setId);
  }

  function updateAttend(setId: string, arrive: number, depart: number) {
    setAppState((state) => ({
      ...state,
      attendOverrides: [
        ...state.attendOverrides.filter((o) => o.set_id !== setId),
        ...(arrive === 0 && depart === 0
          ? []
          : [{ set_id: setId, arrive_offset: arrive, depart_offset: depart }])
      ]
    }));
  }

  function handleBlockTap(gridSet: GridSet) {
    // All blocks open the detail panel (winners get attend controls, ghosts get swap button)
    setSelectedSetId(gridSet.set.id === selectedSetId ? null : gridSet.set.id);
  }

  const selectedGridSet = allSets.find((s) => s.set.id === selectedSetId);

  if (allSets.length === 0) return null;

  return (
    <div className="relative">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.65rem] text-white/50">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm bg-cyan/40" /> locked
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm border border-dashed border-acid/50 bg-acid/10" /> ghost · tap to swap
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm ring-1 ring-acid" /> clash
        </span>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-night/60">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `3rem repeat(${activeStages.length}, minmax(5.5rem, 1fr))`,
            minWidth: `${3 + activeStages.length * 5.5}rem`
          }}
        >
          {/* Stage headers */}
          <div className="sticky top-0 z-20 border-b border-white/10 bg-night/95 p-1" />
          {activeStages.map((stage) => (
            <div
              key={stage.id}
              className="sticky top-0 z-20 border-b border-l border-white/10 bg-night/95 px-1 py-2 text-center"
            >
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em]" style={{ color: stage.color }}>
                {stage.short}
              </p>
            </div>
          ))}

          {/* Time labels column */}
          <div className="relative" style={{ height: totalHeight }}>
            {timeLabels.map(({ ms, label, top }) => (
              <div
                key={ms}
                className="absolute right-1 text-[0.55rem] font-bold leading-none text-white/35"
                style={{ top }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Stage columns */}
          {activeStages.map((stage) => {
            const stageSets = allSets.filter((s) => s.set.stage_id === stage.id);
            return (
              <div key={stage.id} className="relative border-l border-white/[0.06]" style={{ height: totalHeight }}>
                {timeLabels.map(({ ms, top }) => (
                  <div key={ms} className="absolute inset-x-0 border-t border-white/[0.04]" style={{ top }} />
                ))}
                {stageSets.map((gridSet) => (
                  <SetBlock
                    key={gridSet.set.id}
                    gridSet={gridSet}
                    nightStart={nightStart}
                    stageColor={stage.color}
                    override={getOverride(gridSet.set.id)}
                    isSelected={gridSet.set.id === selectedSetId}
                    isHeadliner={gridSet.set.id === headlinerId}
                    appState={appState}
                    onTap={() => handleBlockTap(gridSet)}
                    onUpdateAttend={updateAttend}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom sheet detail panel */}
      {selectedGridSet && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-[slideUp_0.2s_ease-out] border-t border-white/15 bg-night/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 backdrop-blur-2xl">
          <SetDetailPanel
            gridSet={selectedGridSet}
            override={getOverride(selectedGridSet.set.id)}
            updateAttend={updateAttend}
            overrideFlow={overrideFlow}
            appState={appState}
            headlinerId={headlinerId}
            onClose={() => setSelectedSetId(null)}
          />
        </div>
      )}
    </div>
  );
}

function SetBlock({
  gridSet,
  nightStart,
  stageColor,
  override,
  isSelected,
  isHeadliner,
  appState,
  onTap,
  onUpdateAttend
}: {
  gridSet: GridSet;
  nightStart: number;
  stageColor: string;
  override: AttendOverride | undefined;
  isSelected: boolean;
  isHeadliner: boolean;
  appState: AppState;
  onTap: () => void;
  onUpdateAttend: (setId: string, arrive: number, depart: number) => void;
}) {
  const crew = useCrew();
  const startMs = Date.parse(gridSet.set.start_time);
  const endMs = Date.parse(gridSet.set.end_time);
  const blockTop = ((startMs - nightStart) / (60 * 1000)) * PX_PER_MIN;
  const height = ((endMs - startMs) / (60 * 1000)) * PX_PER_MIN;
  const arriveOffset = override?.arrive_offset ?? 0;
  const departOffset = override?.depart_offset ?? 0;
  const durationMin = (endMs - startMs) / (60 * 1000);
  const voters = getVoters(gridSet.set.id, appState.votes, crew);
  const isClash = gridSet.flowItem.state === "Open" || gridSet.flowItem.state === "Auto-picked";

  // Snap to 15-minute increments, capped at half the set duration
  const maxOffset = Math.floor(durationMin / 2);
  function snapToGrid(pxDelta: number): number {
    const minDelta = pxDelta / PX_PER_MIN;
    const snapped = Math.round(minDelta / 15) * 15;
    return Math.max(0, Math.min(snapped, maxOffset));
  }

  function handleDragStart(edge: "top" | "bottom", e: React.TouchEvent | React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const startOffset = edge === "top" ? arriveOffset : departOffset;

    function onMove(ev: TouchEvent | MouseEvent) {
      const currentY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      const delta = currentY - startY;
      // Top handle: dragging down = arriving later (positive delta = more offset)
      // Bottom handle: dragging up = leaving earlier (negative delta = more offset)
      const pxDelta = edge === "top" ? delta : -delta;
      const newOffset = snapToGrid(startOffset * PX_PER_MIN + pxDelta);
      if (edge === "top") {
        onUpdateAttend(gridSet.set.id, newOffset, departOffset);
      } else {
        onUpdateAttend(gridSet.set.id, arriveOffset, newOffset);
      }
    }

    function onEnd() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }

  return (
    <div
      className={`absolute left-0.5 right-0.5 overflow-visible rounded-lg text-left ${
        gridSet.isWinner
          ? "border-l-[3px]"
          : "border border-dashed opacity-40"
      } ${isClash && gridSet.isWinner ? "ring-1 ring-acid/70" : ""} ${
        isSelected ? "z-10 ring-2 ring-cyan shadow-glowCyan" : "z-[1]"
      }`}
      style={{
        top: blockTop,
        height: Math.max(height, 20),
        backgroundColor: gridSet.isWinner ? stageColor + "22" : stageColor + "0A",
        borderLeftColor: gridSet.isWinner ? stageColor : undefined,
        borderColor: gridSet.isWinner ? undefined : stageColor + "50"
      }}
    >
      {/* Faded regions for arrive-late / leave-early */}
      {arriveOffset > 0 && (
        <div
          className="absolute inset-x-0 top-0 rounded-t-lg bg-night/60"
          style={{ height: `${(arriveOffset / durationMin) * 100}%` }}
        />
      )}
      {departOffset > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 rounded-b-lg bg-night/60"
          style={{ height: `${(departOffset / durationMin) * 100}%` }}
        />
      )}

      {/* Top drag handle — arrive late */}
      {gridSet.isWinner && (
        <div
          className="absolute inset-x-0 top-0 z-20 flex h-3 cursor-ns-resize items-center justify-center touch-none"
          onMouseDown={(e) => handleDragStart("top", e)}
          onTouchStart={(e) => handleDragStart("top", e)}
        >
          <div className="h-[2px] w-6 rounded-full bg-white/30" />
        </div>
      )}

      {/* Bottom drag handle — leave early */}
      {gridSet.isWinner && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex h-3 cursor-ns-resize items-center justify-center touch-none"
          onMouseDown={(e) => handleDragStart("bottom", e)}
          onTouchStart={(e) => handleDragStart("bottom", e)}
        >
          <div className="h-[2px] w-6 rounded-full bg-white/30" />
        </div>
      )}

      {/* Tappable content */}
      <button className="relative z-[1] flex h-full w-full flex-col justify-between p-1 text-left" onClick={onTap}>
        <div>
          <p className={`truncate font-bold leading-tight ${height > 60 ? "text-[0.7rem]" : "text-[0.6rem]"}`}>
            {isHeadliner && "👑 "}
            {gridSet.set.artist_name}
          </p>
          {height > 45 && (
            <p className="mt-0.5 truncate text-[0.5rem] leading-tight text-white/45">
              {formatSetTime(gridSet.set)}
            </p>
          )}
        </div>
        <div className="flex items-end justify-between">
          {voters.length > 0 && height > 60 && (
            <div className="flex -space-x-0.5">
              {voters.map((m) => (
                <span key={m.id} className="text-[0.55rem]">{m.emoji}</span>
              ))}
            </div>
          )}
          {!gridSet.isWinner && height > 35 && (
            <span className="text-[0.45rem] font-bold uppercase text-acid">swap</span>
          )}
        </div>
      </button>
    </div>
  );
}

function SetDetailPanel({
  gridSet,
  override,
  updateAttend,
  overrideFlow,
  appState,
  headlinerId,
  onClose
}: {
  gridSet: GridSet;
  override: AttendOverride | undefined;
  updateAttend: (setId: string, arrive: number, depart: number) => void;
  overrideFlow: (group: FestivalSet[], selectedSetId: string) => void;
  appState: AppState;
  headlinerId: string | undefined;
  onClose: () => void;
}) {
  const crew = useCrew();
  const stage = stageFor(gridSet.set, lineup.stages);
  const voters = getVoters(gridSet.set.id, appState.votes, crew);
  const arriveOffset = override?.arrive_offset ?? 0;
  const departOffset = override?.depart_offset ?? 0;
  const startMs = Date.parse(gridSet.set.start_time);
  const endMs = Date.parse(gridSet.set.end_time);
  const attendStartIso = new Date(startMs + arriveOffset * 60 * 1000).toISOString();
  const attendEndIso = new Date(endMs - departOffset * 60 * 1000).toISOString();
  const arriveOptions = [0, 15, 30] as const;
  const departOptions = [0, 15, 30] as const;

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-black tracking-tight">
              {gridSet.set.id === headlinerId && "👑 "}
              {gridSet.set.artist_name}
            </h3>
            {!gridSet.isWinner && (
              <span className="shrink-0 rounded-full bg-acid/15 px-2 py-0.5 text-[0.6rem] font-bold text-acid">ghost</span>
            )}
            <div className="flex -space-x-1">
              {voters.map((m) => (
                <span key={m.id} className="text-sm">{m.emoji}</span>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/45">
            {formatSetTime(gridSet.set)} · <span style={{ color: stage.color }}>{stage.name}</span>
            {(arriveOffset > 0 || departOffset > 0) && (
              <span className="text-cyan"> · attending {formatTime(attendStartIso)}–{formatTime(attendEndIso)}</span>
            )}
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white/60">
          Done
        </button>
      </div>

      {/* Swap button for ghost sets */}
      {!gridSet.isWinner && (
        <button
          className="mt-3 w-full rounded-xl border border-acid/40 bg-acid/10 px-4 py-2.5 text-xs font-bold text-acid transition hover:bg-acid/20"
          onClick={() => {
            overrideFlow(gridSet.clashGroup, gridSet.set.id);
            onClose();
          }}
        >
          ⚡ swap in — pick {gridSet.set.artist_name} instead
        </button>
      )}

      {/* Partial attendance controls for winner sets */}
      {gridSet.isWinner && (
        <div className="mt-3 flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-white/40">arrive</span>
            {arriveOptions.map((mins) => (
              <button
                key={mins}
                className={`rounded-lg px-2 py-1 text-[0.65rem] font-bold transition ${
                  arriveOffset === mins
                    ? "bg-cyan text-night"
                    : "bg-white/8 text-white/50"
                }`}
                onClick={() => updateAttend(gridSet.set.id, mins, departOffset)}
              >
                {mins === 0 ? "⏰" : `+${mins}m`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-white/40">leave</span>
            {departOptions.map((mins) => (
              <button
                key={mins}
                className={`rounded-lg px-2 py-1 text-[0.65rem] font-bold transition ${
                  departOffset === mins
                    ? "bg-pink text-night"
                    : "bg-white/8 text-white/50"
                }`}
                onClick={() => updateAttend(gridSet.set.id, arriveOffset, mins)}
              >
                {mins === 0 ? "⏰" : `-${mins}m`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
