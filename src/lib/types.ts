export type Night = "friday" | "saturday" | "sunday";

export type Stage = {
  name: string;
  short: string;
  color: string;
};

export type FestivalSet = {
  id: string;
  artist_name: string;
  stage_id: string;
  night: Night;
  start_time: string;
  end_time: string;
  genres: string[];
  sounds_like: string;
  preview_kind: "spotify" | "youtube";
  /** Optional Spotify artist ID (22 chars). When present, enables a direct
   *  link to the artist's profile instead of a search-results fallback.
   *  Curated in data/artist-annotations.json. */
  spotify_id?: string;
};

export type Lineup = {
  stages: Record<string, Stage>;
  sets: FestivalSet[];
};

export type CrewMember = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type Vote = {
  user_id: string;
  set_id: string;
  created_at: string;
};

export type Comment = {
  id: string;
  user_id: string;
  set_id: string;
  content: string;
  created_at: string;
};

export type FlowOverride = {
  clashing_set_ids: string[];
  selected_set_id: string;
};

export type FlowState = "Locked" | "Auto-picked" | "Open";

export type FlowItem = {
  set: FestivalSet;
  state: FlowState;
  clashingSets: FestivalSet[];
  loserSets: FestivalSet[];
  reason: string;
};

export type AttendOverride = {
  set_id: string;
  arrive_offset: number;  // minutes late (0 = on time, 15 = arrive 15min late)
  depart_offset: number;  // minutes early (0 = stay full set, 15 = leave 15min early)
};

export type AppState = {
  activeUserId: string;
  votes: Vote[];
  comments: Comment[];
  overrides: FlowOverride[];
  attendOverrides: AttendOverride[];
};
