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

// Full demo state for offline/no-Supabase mode.
// All set_ids reference real EDC LV 2026 sets in data/lineup.json (built by
// scripts/build-lineup-from-csv.js from the official Mainstage CSV).
export const demoState: AppState = {
  activeUserId: "koto",
  votes: [
    // Friday — Kinetic mainstage run + a Charlotte de Witte vs Porter Robinson clash
    { user_id: "koto", set_id: "fri_sofi_tukker", created_at: "2026-04-25T18:02:00Z" },
    { user_id: "alex", set_id: "fri_sofi_tukker", created_at: "2026-04-25T18:03:00Z" },
    { user_id: "mika", set_id: "fri_the_chainsmokers", created_at: "2026-04-25T18:04:00Z" },
    { user_id: "koto", set_id: "fri_fisher", created_at: "2026-04-25T18:09:00Z" },
    { user_id: "alex", set_id: "fri_fisher", created_at: "2026-04-25T18:10:00Z" },
    { user_id: "mika", set_id: "fri_fisher", created_at: "2026-04-25T18:11:00Z" },
    { user_id: "koto", set_id: "fri_porter_robinson_dj_set", created_at: "2026-04-25T18:20:00Z" },
    { user_id: "alex", set_id: "fri_porter_robinson_dj_set", created_at: "2026-04-25T18:21:00Z" },
    { user_id: "mika", set_id: "fri_charlotte_de_witte", created_at: "2026-04-25T18:22:00Z" },

    // Saturday — Kinetic legacy run + an Above & Beyond sunrise lock
    { user_id: "alex", set_id: "sat_kaskade", created_at: "2026-04-25T19:00:00Z" },
    { user_id: "koto", set_id: "sat_kaskade", created_at: "2026-04-25T19:02:00Z" },
    { user_id: "mika", set_id: "sat_sub_focus", created_at: "2026-04-25T19:05:00Z" },
    { user_id: "koto", set_id: "sat_subtronics", created_at: "2026-04-25T19:10:00Z" },
    { user_id: "alex", set_id: "sat_john_summit", created_at: "2026-04-25T19:12:00Z" },
    { user_id: "mika", set_id: "sat_john_summit", created_at: "2026-04-25T19:14:00Z" },
    { user_id: "alex", set_id: "sat_hardwell", created_at: "2026-04-25T19:16:00Z" },
    { user_id: "mika", set_id: "sat_ti_sto", created_at: "2026-04-25T19:18:00Z" },
    { user_id: "koto", set_id: "sat_ti_sto", created_at: "2026-04-25T19:20:00Z" },
    { user_id: "alex", set_id: "sat_ti_sto", created_at: "2026-04-25T19:21:00Z" },
    { user_id: "koto", set_id: "sat_above_and_beyond_sunrise_set", created_at: "2026-04-25T19:25:00Z" },
    { user_id: "mika", set_id: "sat_above_and_beyond_sunrise_set", created_at: "2026-04-25T19:26:00Z" },
    { user_id: "alex", set_id: "sat_above_and_beyond_sunrise_set", created_at: "2026-04-25T19:27:00Z" },

    // Sunday — closing-night spread across stages
    { user_id: "koto", set_id: "sun_cloonee", created_at: "2026-04-25T20:01:00Z" },
    { user_id: "alex", set_id: "sun_cloonee", created_at: "2026-04-25T20:02:00Z" },
    { user_id: "mika", set_id: "sun_zedd", created_at: "2026-04-25T20:07:00Z" },
    { user_id: "koto", set_id: "sun_zedd", created_at: "2026-04-25T20:08:00Z" },
    { user_id: "mika", set_id: "sun_alison_wonderland", created_at: "2026-04-25T20:09:00Z" },
    { user_id: "alex", set_id: "sun_seven_lions", created_at: "2026-04-25T20:10:00Z" },
    { user_id: "mika", set_id: "sun_seven_lions", created_at: "2026-04-25T20:11:00Z" },
    { user_id: "koto", set_id: "sun_martin_garrix", created_at: "2026-04-25T20:14:00Z" },
    { user_id: "alex", set_id: "sun_martin_garrix", created_at: "2026-04-25T20:15:00Z" },
    { user_id: "mika", set_id: "sun_martin_garrix", created_at: "2026-04-25T20:17:00Z" }
  ],
  comments: [
    {
      id: "c1",
      user_id: "koto",
      set_id: "fri_fisher",
      content: "meet by daisy tower before this, no wandering pls",
      created_at: "2026-04-25T21:00:00Z"
    },
    {
      id: "c2",
      user_id: "alex",
      set_id: "fri_porter_robinson_dj_set",
      content: "DJ set?? this preview sold me instantly",
      created_at: "2026-04-25T21:05:00Z"
    },
    {
      id: "c3",
      user_id: "mika",
      set_id: "sat_above_and_beyond_sunrise_set",
      content: "sunrise mainstage cheese is mandatory",
      created_at: "2026-04-25T21:10:00Z"
    }
  ],
  overrides: [],
  attendOverrides: []
};
