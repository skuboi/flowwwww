import lineupJson from "../../data/lineup.json";
import type { AppState, CrewMember, Lineup, Night } from "./types";

export const lineup = lineupJson as Lineup;

// Demo crew used when Supabase is not configured
export const demoCrew: CrewMember[] = [
  { id: "koto", name: "Koto", emoji: "👽", color: "#FF3DCB" },
  { id: "alex", name: "Alex", emoji: "🍄", color: "#00FFDC" },
  { id: "mika", name: "Mika", emoji: "🪩", color: "#B94FFF" }
];

export const nightLabels: Record<Night, string> = {
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday"
};

export const shortNightLabels: Record<Night, string> = {
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun"
};

export const nights: Night[] = ["friday", "saturday", "sunday"];

export const initialState: AppState = {
  activeUserId: "",
  votes: [],
  comments: [],
  overrides: [],
  attendOverrides: []
};

// Full demo state for offline/no-Supabase mode
export const demoState: AppState = {
  activeUserId: "koto",
  votes: [
    { user_id: "koto", set_id: "fri_odd_mob", created_at: "2026-04-25T18:02:00Z" },
    { user_id: "alex", set_id: "fri_odd_mob", created_at: "2026-04-25T18:03:00Z" },
    { user_id: "mika", set_id: "fri_dimension", created_at: "2026-04-25T18:04:00Z" },
    { user_id: "koto", set_id: "fri_cloonee", created_at: "2026-04-25T18:09:00Z" },
    { user_id: "alex", set_id: "fri_rezz", created_at: "2026-04-25T18:10:00Z" },
    { user_id: "mika", set_id: "fri_kaskade", created_at: "2026-04-25T18:11:00Z" },
    { user_id: "koto", set_id: "fri_nora", created_at: "2026-04-25T18:20:00Z" },
    { user_id: "alex", set_id: "sat_chris_lake", created_at: "2026-04-25T19:00:00Z" },
    { user_id: "koto", set_id: "sat_chris_lake", created_at: "2026-04-25T19:02:00Z" },
    { user_id: "mika", set_id: "sat_griz", created_at: "2026-04-25T19:05:00Z" },
    { user_id: "koto", set_id: "sat_fred", created_at: "2026-04-25T19:10:00Z" },
    { user_id: "alex", set_id: "sat_fred", created_at: "2026-04-25T19:12:00Z" },
    { user_id: "mika", set_id: "sat_fred", created_at: "2026-04-25T19:14:00Z" },
    { user_id: "alex", set_id: "sat_illenium", created_at: "2026-04-25T19:16:00Z" },
    { user_id: "mika", set_id: "sat_charlotte", created_at: "2026-04-25T19:18:00Z" },
    { user_id: "koto", set_id: "sat_dom_dolla", created_at: "2026-04-25T19:20:00Z" },
    { user_id: "alex", set_id: "sat_dom_dolla", created_at: "2026-04-25T19:21:00Z" },
    { user_id: "koto", set_id: "sat_above_beyond", created_at: "2026-04-25T19:25:00Z" },
    { user_id: "mika", set_id: "sat_above_beyond", created_at: "2026-04-25T19:26:00Z" },
    { user_id: "koto", set_id: "sun_sara_landry", created_at: "2026-04-25T20:01:00Z" },
    { user_id: "mika", set_id: "sun_subtronics", created_at: "2026-04-25T20:02:00Z" },
    { user_id: "alex", set_id: "sun_john_summit", created_at: "2026-04-25T20:07:00Z" },
    { user_id: "koto", set_id: "sun_john_summit", created_at: "2026-04-25T20:08:00Z" },
    { user_id: "mika", set_id: "sun_alison", created_at: "2026-04-25T20:09:00Z" },
    { user_id: "alex", set_id: "sun_boris", created_at: "2026-04-25T20:10:00Z" },
    { user_id: "koto", set_id: "sun_tiesto", created_at: "2026-04-25T20:14:00Z" },
    { user_id: "alex", set_id: "sun_tiesto", created_at: "2026-04-25T20:15:00Z" },
    { user_id: "koto", set_id: "fri_fisher", created_at: "2026-04-25T21:30:00Z" },
    { user_id: "alex", set_id: "fri_fisher", created_at: "2026-04-25T21:31:00Z" },
    { user_id: "mika", set_id: "fri_deadmau5", created_at: "2026-04-25T21:33:00Z" },
    { user_id: "koto", set_id: "sat_skrillex", created_at: "2026-04-25T21:35:00Z" },
    { user_id: "alex", set_id: "sat_skrillex", created_at: "2026-04-25T21:36:00Z" },
    { user_id: "mika", set_id: "sat_skrillex", created_at: "2026-04-25T21:37:00Z" },
    { user_id: "alex", set_id: "sat_eric_prydz", created_at: "2026-04-25T21:39:00Z" },
    { user_id: "koto", set_id: "sat_disclosure", created_at: "2026-04-25T21:41:00Z" },
    { user_id: "mika", set_id: "sat_disclosure", created_at: "2026-04-25T21:42:00Z" },
    { user_id: "mika", set_id: "sun_excision", created_at: "2026-04-25T21:44:00Z" },
    { user_id: "koto", set_id: "sun_odesza", created_at: "2026-04-25T21:46:00Z" },
    { user_id: "alex", set_id: "sun_odesza", created_at: "2026-04-25T21:47:00Z" },
    { user_id: "alex", set_id: "sun_porter_robinson", created_at: "2026-04-25T21:49:00Z" },
    { user_id: "mika", set_id: "sun_seven_lions", created_at: "2026-04-25T21:51:00Z" }
  ],
  comments: [
    {
      id: "c1",
      user_id: "koto",
      set_id: "sat_fred",
      content: "meet by daisy tower before this, no wandering pls",
      created_at: "2026-04-25T21:00:00Z"
    },
    {
      id: "c2",
      user_id: "alex",
      set_id: "fri_odd_mob",
      content: "this preview sold me instantly",
      created_at: "2026-04-25T21:05:00Z"
    },
    {
      id: "c3",
      user_id: "mika",
      set_id: "sun_tiesto",
      content: "sunrise mainstage cheese is mandatory",
      created_at: "2026-04-25T21:10:00Z"
    }
  ],
  overrides: [],
  attendOverrides: []
};
