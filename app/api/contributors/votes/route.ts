import { getAuthenticatedContributor } from "@/lib/contributor-access.server";
import { isLocalContributorPreview } from "@/lib/runtime-env.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (await isLocalContributorPreview(request)) {
    return Response.json({ saved: true, preview: true });
  }
  const contributor = await getAuthenticatedContributor(request);
  if (!contributor) return Response.json({ error: "Not authorized." }, { status: 401 });

  let payload: { voteId?: unknown; optionId?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Choose a response." }, { status: 400 });
  }
  const voteId = typeof payload.voteId === "string" ? payload.voteId : "";
  const optionId = typeof payload.optionId === "string" ? payload.optionId : "";
  if (!/^[0-9a-f-]{36}$/i.test(voteId) || !optionId || optionId.length > 100) {
    return Response.json({ error: "Choose a valid response." }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();
  const vote = await supabase
    .from("contributor_votes")
    .select("options,closes_at,is_published")
    .eq("id", voteId)
    .maybeSingle();
  if (
    vote.error ||
    !vote.data?.is_published ||
    new Date(vote.data.closes_at).getTime() <= Date.now() ||
    !Array.isArray(vote.data.options) ||
    !vote.data.options.some(
      (option: { id?: unknown }) => option && option.id === optionId,
    )
  ) {
    return Response.json({ error: "This advisory vote is not available." }, { status: 400 });
  }

  const result = await supabase.from("contributor_vote_responses").upsert(
    {
      vote_id: voteId,
      contributor_id: contributor.row.id,
      option_id: optionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vote_id,contributor_id" },
  );
  if (result.error) {
    return Response.json({ error: "Could not save your response yet." }, { status: 503 });
  }
  return Response.json({ saved: true });
}
