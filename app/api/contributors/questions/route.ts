import { getAuthenticatedContributor } from "@/lib/contributor-access.server";
import { isLocalContributorPreview } from "@/lib/runtime-env.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (await isLocalContributorPreview(request)) {
    return Response.json({ submitted: true, preview: true });
  }
  const contributor = await getAuthenticatedContributor(request);
  if (!contributor) return Response.json({ error: "Not authorized." }, { status: 401 });

  let payload: { question?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Write a question before submitting." }, { status: 400 });
  }
  const question =
    typeof payload.question === "string"
      ? payload.question.trim().replace(/\s+/g, " ")
      : "";
  if (question.length < 20 || question.length > 1500) {
    return Response.json(
      { error: "Write a question between 20 and 1,500 characters." },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseAdmin();
  const result = await supabase.from("contributor_questions").insert({
    contributor_id: contributor.row.id,
    question,
    is_published: false,
  });
  if (result.error) {
    console.error("Contributor question failed", result.error);
    return Response.json({ error: "Could not submit your question yet." }, { status: 503 });
  }
  return Response.json({ submitted: true }, { status: 201 });
}
