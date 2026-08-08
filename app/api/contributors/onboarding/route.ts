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
  const isPreview = await isLocalContributorPreview(request);
  const contributor = isPreview ? null : await getAuthenticatedContributor(request);
  if (!isPreview && !contributor) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Complete the profile form." }, { status: 400 });
  }

  const preferredName = cleanText(payload.preferredName, 60);
  const country = cleanText(payload.country, 80);
  const learningGoal = cleanText(payload.learningGoal, 750);
  const productAreas = Array.isArray(payload.productAreas)
    ? payload.productAreas.filter(
        (value): value is string => typeof value === "string" && PRODUCT_AREAS.has(value),
      )
    : [];

  if (
    !preferredName ||
    !country ||
    productAreas.length === 0
  ) {
    return Response.json(
      { error: "Add your preferred name, country, and at least one contribution area." },
      { status: 400 },
    );
  }

  const profile = {
    preferredName,
    country,
    learningGoal,
    productAreas,
    foundersWallOptIn: payload.foundersWallOptIn === true,
  };
  const completedAt = new Date().toISOString();

  if (isPreview) {
    return Response.json({
      saved: true,
      preview: true,
      profile,
      onboardingCompletedAt: completedAt,
    });
  }

  const supabase = await getSupabaseAdmin();
  const saved = await supabase.from("contributor_profiles").upsert(
    {
      contributor_id: contributor!.row.id,
      preferred_name: preferredName,
      country,
      learning_goal: learningGoal || null,
      product_areas: productAreas,
      founders_wall_opt_in: profile.foundersWallOptIn,
      updated_at: completedAt,
    },
    { onConflict: "contributor_id" },
  );
  if (saved.error) {
    console.error("Contributor profile save failed", saved.error);
    return Response.json({ error: "Could not save your profile yet." }, { status: 503 });
  }

  const contributorUpdate = await supabase
    .from("contributors")
    .update({
      preferred_name: preferredName,
      country,
      onboarding_completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", contributor!.row.id);
  if (contributorUpdate.error) {
    return Response.json({ error: "Could not complete your profile yet." }, { status: 503 });
  }

  return Response.json({ saved: true, profile, onboardingCompletedAt: completedAt });
}
