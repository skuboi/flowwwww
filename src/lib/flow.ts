import type { AttendOverride, CrewMember, FestivalSet, FlowItem, FlowOverride, FlowState, Night, Stage, Vote } from "./types";

export function formatSetTime(set: Pick<FestivalSet, "start_time" | "end_time">) {
  return `${formatTime(set.start_time)}–${formatTime(set.end_time)}`;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles"
  })
    .format(new Date(value))
    .replace(" AM", "A")
    .replace(" PM", "P");
}

export function getTimeBlock(set: FestivalSet) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Los_Angeles"
    }).format(new Date(set.start_time))
  );

  if (hour >= 19 && hour < 22) return "Early";
  if (hour >= 22 || hour < 1) return "Peak";
  return "After Hours";
}

export function getSetVotes(setId: string, votes: Vote[]) {
  return votes.filter((vote) => vote.set_id === setId);
}

export function getVoters(setId: string, votes: Vote[], crew: CrewMember[]) {
  const voters = new Set(getSetVotes(setId, votes).map((vote) => vote.user_id));
  return crew.filter((member) => voters.has(member.id));
}

export function toggleVote(votes: Vote[], userId: string, setId: string) {
  const hasVote = votes.some((vote) => vote.user_id === userId && vote.set_id === setId);

  if (hasVote) {
    return votes.filter((vote) => !(vote.user_id === userId && vote.set_id === setId));
  }

  return [
    ...votes,
    {
      user_id: userId,
      set_id: setId,
      created_at: new Date().toISOString()
    }
  ];
}

export function resolveFlow(
  sets: FestivalSet[],
  votes: Vote[],
  overrides: FlowOverride[],
  night: Night,
  attendOverrides: AttendOverride[] = []
): FlowItem[] {
  const hearted = sets
    .filter((set) => set.night === night && getSetVotes(set.id, votes).length > 0);

  if (hearted.length === 0) return [];

  // Get the effective attend window for a set (accounting for arrive-late / leave-early)
  function getAttendWindow(set: FestivalSet): { start: number; end: number } {
    const ao = attendOverrides.find((o) => o.set_id === set.id);
    const start = Date.parse(set.start_time) + (ao?.arrive_offset ?? 0) * 60 * 1000;
    const end = Date.parse(set.end_time) - (ao?.depart_offset ?? 0) * 60 * 1000;
    return { start, end };
  }

  // Check if two sets' ATTENDED windows overlap
  function setsOverlap(a: FestivalSet, b: FestivalSet): boolean {
    const aw = getAttendWindow(a);
    const bw = getAttendWindow(b);
    return aw.start < bw.end && bw.start < aw.end;
  }

  // Priority: override-selected sets first, then vote count desc, earliest vote, alpha
  function getPriority(set: FestivalSet): number {
    const isOverridden = overrides.some((o) => o.selected_set_id === set.id);
    const voteCount = getSetVotes(set.id, votes).length;
    return isOverridden ? 10000 + voteCount : voteCount;
  }

  const byPriority = [...hearted].sort((a, b) => {
    const pDiff = getPriority(b) - getPriority(a);
    if (pDiff !== 0) return pDiff;
    const aFirst = Math.min(...getSetVotes(a.id, votes).map((v) => Date.parse(v.created_at)));
    const bFirst = Math.min(...getSetVotes(b.id, votes).map((v) => Date.parse(v.created_at)));
    if (aFirst !== bFirst) return aFirst - bFirst;
    return a.artist_name.localeCompare(b.artist_name);
  });

  // Greedy scheduling: process sets by priority, schedule if no overlap with winners
  const winners: FestivalSet[] = [];
  const loserOf = new Map<string, FestivalSet>(); // loser set id → the winner it lost to

  for (const set of byPriority) {
    const conflicting = winners.find((w) => setsOverlap(w, set));
    if (conflicting) {
      loserOf.set(set.id, conflicting);
    } else {
      winners.push(set);
    }
  }

  // Build FlowItems from winners
  return winners
    .map((winner) => {
      const myLosers = hearted.filter((s) => loserOf.get(s.id) === winner);
      const isOverridden = overrides.some((o) => o.selected_set_id === winner.id);
      const winnerVotes = getSetVotes(winner.id, votes).length;

      let state: FlowState;
      let reason: string;

      if (myLosers.length === 0) {
        state = "Locked";
        reason = "No clash. Glide path is clear.";
      } else if (isOverridden) {
        state = "Locked";
        reason = "Crew override locked this one in.";
      } else {
        const maxLoserVotes = Math.max(...myLosers.map((l) => getSetVotes(l.id, votes).length));
        if (winnerVotes > maxLoserVotes) {
          state = "Auto-picked";
          reason = "Clash alert. Most hearts wins.";
        } else {
          state = "Open";
          reason = "Tie energy. Tap a ghost to pick.";
        }
      }

      return {
        set: winner,
        state,
        clashingSets: myLosers,
        loserSets: myLosers,
        reason
      };
    })
    .sort((a, b) => Date.parse(a.set.start_time) - Date.parse(b.set.start_time));
}

export function getHeadliner(items: FlowItem[], votes: Vote[]) {
  return [...items].sort((a, b) => {
    const voteDiff = getSetVotes(b.set.id, votes).length - getSetVotes(a.set.id, votes).length;
    if (voteDiff !== 0) return voteDiff;
    return Date.parse(b.set.start_time) - Date.parse(a.set.start_time);
  })[0]?.set.id;
}

export function stageFor(set: FestivalSet, stages: Record<string, Stage>) {
  return stages[set.stage_id];
}

/** Returns true if a set's time window overlaps with any other hearted set on the same night */
export function hasClash(set: FestivalSet, allSets: FestivalSet[], votes: Vote[]) {
  const hearted = allSets.filter(
    (s) => s.night === set.night && s.id !== set.id && getSetVotes(s.id, votes).length > 0
  );
  const start = Date.parse(set.start_time);
  const end = Date.parse(set.end_time);
  return hearted.some((s) => {
    const sStart = Date.parse(s.start_time);
    const sEnd = Date.parse(s.end_time);
    return sStart < end && sEnd > start;
  });
}

export type TimelineInterstitial = {
  kind: "gap" | "stage-hop";
  message: string;
  afterSetId: string;
};

const GAP_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes

export function getTimelineInterstitials(
  items: FlowItem[],
  stages: Record<string, Stage>
): TimelineInterstitial[] {
  const result: TimelineInterstitial[] = [];
  for (let i = 0; i < items.length - 1; i++) {
    const current = items[i];
    const next = items[i + 1];
    const currentEnd = Date.parse(current.set.end_time);
    const nextStart = Date.parse(next.set.start_time);
    const gapMs = nextStart - currentEnd;

    if (gapMs >= GAP_THRESHOLD_MS) {
      const gapHours = Math.floor(gapMs / (60 * 60 * 1000));
      const gapMins = Math.round((gapMs % (60 * 60 * 1000)) / (60 * 1000));
      const timeStr = gapHours > 0 ? `${gapHours}h ${gapMins}m` : `${gapMins}m`;
      result.push({
        kind: "gap",
        message: `${timeStr} gap — explore more sets?`,
        afterSetId: current.set.id
      });
    }

    if (current.set.stage_id !== next.set.stage_id) {
      const fromStage = stages[current.set.stage_id];
      const toStage = stages[next.set.stage_id];
      result.push({
        kind: "stage-hop",
        message: `${fromStage?.short ?? "?"} → ${toStage?.short ?? "?"} · plan for a 10-15 min walk`,
        afterSetId: current.set.id
      });
    }
  }
  return result;
}
