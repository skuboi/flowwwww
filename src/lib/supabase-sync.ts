import { createSupabaseBrowserClient } from "./supabase";
import type { AppState, Comment, CrewMember, FlowOverride, Vote } from "./types";

const CREW_COLORS = [
  "#FF3DCB", "#00FFDC", "#B94FFF", "#CAFF04", "#FF6B35",
  "#00FF88", "#FF44AA", "#44DDFF", "#AA55FF", "#FFCC00",
];

type SupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;
let _client: SupabaseClient | undefined;
function getClient(): SupabaseClient {
  if (!_client) _client = createSupabaseBrowserClient();
  return _client;
}

/** Sign in anonymously if not already signed in. Returns auth user or null. */
export async function initSession() {
  const sb = getClient();
  if (!sb) return null;

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) return session.user;

  // NOTE: anonymous auth must be enabled in the Supabase dashboard
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) { console.error("anon sign-in failed:", error.message); return null; }
  return data.user;
}

/** Create a new crew. Returns the crew UUID (first 6 chars = join code). */
export async function createCrew(): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;

  const { data, error } = await sb.from("crews").insert({}).select("id").single();
  if (error) { console.error("create crew:", error.message); return null; }
  return data.id as string;
}

/** Look up a crew by the 6-char prefix of its UUID. */
export async function joinCrew(code: string): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;

  const prefix = code.toLowerCase().trim();
  if (prefix.length < 6) return null;

  const { data, error } = await sb
    .from("crews")
    .select("id")
    .ilike("id", `${prefix}%`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.id as string;
}

/** Register the current user as a crew member. Returns the member row. */
export async function registerMember(
  crewId: string,
  name: string,
  emoji: string,
  color: string
): Promise<CrewMember | null> {
  const sb = getClient();
  if (!sb) return null;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from("crew_members")
    .insert({ auth_id: user.id, crew_id: crewId, name, emoji, color })
    .select("id, name, emoji, color")
    .single();

  if (error) { console.error("register member:", error.message); return null; }
  return data as CrewMember;
}

/** Pick a color for a new member based on how many already exist. */
export function pickCrewColor(existingCount: number): string {
  return CREW_COLORS[existingCount % CREW_COLORS.length];
}

/** Load full crew state (members, votes, comments, overrides). */
export async function loadCrewState(crewId: string): Promise<{
  members: CrewMember[];
  state: Omit<AppState, "activeUserId" | "attendOverrides">;
} | null> {
  const sb = getClient();
  if (!sb) return null;

  const [membersRes, votesRes, commentsRes, overridesRes] = await Promise.all([
    sb.from("crew_members").select("id, name, emoji, color").eq("crew_id", crewId),
    sb.from("votes").select("member_id, set_id, created_at").eq("crew_id", crewId),
    sb.from("comments").select("id, member_id, set_id, content, created_at").eq("crew_id", crewId),
    sb.from("flow_overrides").select("selected_set_id, clashing_set_ids").eq("crew_id", crewId),
  ]);

  if (membersRes.error || votesRes.error || commentsRes.error || overridesRes.error) {
    console.error("loadCrewState errors:", membersRes.error, votesRes.error, commentsRes.error, overridesRes.error);
    return null;
  }

  const members: CrewMember[] = (membersRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    emoji: m.emoji,
    color: m.color,
  }));

  const votes: Vote[] = (votesRes.data ?? []).map((v) => ({
    user_id: v.member_id,
    set_id: v.set_id,
    created_at: v.created_at,
  }));

  const comments: Comment[] = (commentsRes.data ?? []).map((c) => ({
    id: c.id,
    user_id: c.member_id,
    set_id: c.set_id,
    content: c.content,
    created_at: c.created_at,
  }));

  const overrides: FlowOverride[] = (overridesRes.data ?? []).map((o) => ({
    selected_set_id: o.selected_set_id,
    clashing_set_ids: o.clashing_set_ids,
  }));

  return { members, state: { votes, comments, overrides } };
}

/** Subscribe to realtime changes for a crew. Returns an unsubscribe function. */
export function subscribeToChanges(
  crewId: string,
  onUpdate: () => void
): () => void {
  const sb = getClient();
  if (!sb) return () => {};

  const channel = sb
    .channel(`crew-${crewId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes", filter: `crew_id=eq.${crewId}` },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "comments", filter: `crew_id=eq.${crewId}` },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "flow_overrides", filter: `crew_id=eq.${crewId}` },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "crew_members", filter: `crew_id=eq.${crewId}` },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

/** Add a vote. */
export async function addVote(crewId: string, memberId: string, setId: string) {
  const sb = getClient();
  if (!sb) return;
  const { error } = await sb.from("votes").insert({ crew_id: crewId, member_id: memberId, set_id: setId });
  if (error) console.error("addVote:", error.message);
}

/** Remove a vote. */
export async function removeVote(memberId: string, setId: string) {
  const sb = getClient();
  if (!sb) return;
  const { error } = await sb.from("votes").delete().eq("member_id", memberId).eq("set_id", setId);
  if (error) console.error("removeVote:", error.message);
}

/** Add a comment. */
export async function addComment(crewId: string, memberId: string, setId: string, content: string) {
  const sb = getClient();
  if (!sb) return;
  const { error } = await sb
    .from("comments")
    .insert({ crew_id: crewId, member_id: memberId, set_id: setId, content });
  if (error) console.error("addComment:", error.message);
}

/** Set (upsert) a flow override for a clash group. */
export async function setFlowOverride(
  crewId: string,
  clashingSetIds: string[],
  selectedSetId: string
) {
  const sb = getClient();
  if (!sb) return;

  // Delete existing override for this clash group, then insert fresh
  const sorted = [...clashingSetIds].sort();
  await sb
    .from("flow_overrides")
    .delete()
    .eq("crew_id", crewId)
    .contains("clashing_set_ids", sorted);

  const { error } = await sb.from("flow_overrides").insert({
    crew_id: crewId,
    selected_set_id: selectedSetId,
    clashing_set_ids: sorted,
  });
  if (error) console.error("setFlowOverride:", error.message);
}
