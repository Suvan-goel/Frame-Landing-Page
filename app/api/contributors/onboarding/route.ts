import { getAuthenticatedContributor } from "@/lib/contributor-access.server";
import { isLocalContributorPreview } from "@/lib/runtime-env.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

const PRODUCT_AREAS = new Set([
  "comfort",
  "industrial_design",
  "app_experience",
  "development_updates",
  "health_communication",
]);

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export async function POST(request: Request) {
  if (await isLocalContributorPreview(request)) {
    return Response.json({ saved: true, preview: true });
  }
  const contributor = await getAuthenticatedContributor(request);
  if (!contributor) return Response.json({ error: "Not authorized." }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Complete the onboarding form." }, { status: 400 });
  }

  const preferredName = cleanText(payload.preferredName, 60);
  const country = cleanText(payload.country, 80);
  const interestReason = cleanText(payload.interestReason, 750);
  const learningGoal = cleanText(payload.learningGoal, 750);
  const purchaseUnderstanding = cleanText(payload.purchaseUnderstanding, 750);
  const productAreas = Array.isArray(payload.productAreas)
    ? payload.productAreas.filter(
        (value): value is string => typeof value === "string" && PRODUCT_AREAS.has(value),
      )
    : [];

  if (
    !preferredName ||
    !country ||
    interestReason.length < 20 ||
    learningGoal.length < 20 ||
    purchaseUnderstanding.length < 20 ||
    productAreas.length === 0
  ) {
    return Response.json(
      { error: "Complete every required onboarding field without including medical information." },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseAdmin();
  const saved = await supabase.from("contributor_profiles").upsert(
    {
      contributor_id: contributor.row.id,
      preferred_name: preferredName,
      country,
      interest_reason: interestReason,
      learning_goal: learningGoal,
      uses_health_wearable:
        typeof payload.usesHealthWearable === "boolean" ? payload.usesHealthWearable : null,
      product_areas: productAreas,
      purchase_understanding: purchaseUnderstanding,
      founders_wall_opt_in: payload.foundersWallOptIn === true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "contributor_id" },
  );
  if (saved.error) {
    console.error("Contributor onboarding failed", saved.error);
    return Response.json({ error: "Could not save onboarding yet." }, { status: 503 });
  }

  const completedAt = new Date().toISOString();
  const contributorUpdate = await supabase
    .from("contributors")
    .update({
      preferred_name: preferredName,
      country,
      onboarding_completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", contributor.row.id);
  if (contributorUpdate.error) {
    return Response.json({ error: "Could not complete onboarding yet." }, { status: 503 });
  }

  return Response.json({ saved: true });
}
