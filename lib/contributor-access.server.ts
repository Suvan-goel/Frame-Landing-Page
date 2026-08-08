import { getSupabaseAdmin } from "./supabase-admin.server";
import { contributorPreviewDashboard } from "./contributor-preview";
import type {
  ContributorDashboard,
  ContributorEvent,
  ContributorMembership,
  ContributorQuestion,
  ContributorResearchOpportunity,
  ContributorUpdate,
  ContributorVote,
} from "./contributor-types";
import { isLocalContributorPreview } from "./runtime-env.server";

type ContributorRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  normalized_email: string;
  full_name: string;
  preferred_name: string | null;
  contributor_number: number;
  membership_status: ContributorMembership["membershipStatus"];
  paid_at: string;
  access_starts_at: string;
  access_expires_at: string;
  future_discount_eligible: boolean;
  terms_version: string;
  onboarding_completed_at: string | null;
};

type ContributorPaymentRow = {
  amount_total: number;
  currency: string;
};

export type AuthenticatedContributor = {
  row: ContributorRow;
  accessToken: string;
};

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export async function getAuthenticatedContributor(
  request: Request,
): Promise<AuthenticatedContributor | null> {
  const accessToken = bearerToken(request);
  if (!accessToken) return null;

  const supabase = await getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userData.user;
  if (userError || !user?.email) return null;

  const normalizedEmail = user.email.trim().toLowerCase();
  let { data: contributor, error } = await supabase
    .from("contributors")
    .select(
      "id,auth_user_id,email,normalized_email,full_name,preferred_name,contributor_number,membership_status,paid_at,access_starts_at,access_expires_at,future_discount_eligible,terms_version,onboarding_completed_at",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!contributor && !error) {
    const byEmail = await supabase
      .from("contributors")
      .select(
        "id,auth_user_id,email,normalized_email,full_name,preferred_name,contributor_number,membership_status,paid_at,access_starts_at,access_expires_at,future_discount_eligible,terms_version,onboarding_completed_at",
      )
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();
    contributor = byEmail.data;
    error = byEmail.error;

    if (contributor && !contributor.auth_user_id) {
      const linked = await supabase
        .from("contributors")
        .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
        .eq("id", contributor.id)
        .select(
          "id,auth_user_id,email,normalized_email,full_name,preferred_name,contributor_number,membership_status,paid_at,access_starts_at,access_expires_at,future_discount_eligible,terms_version,onboarding_completed_at",
        )
        .single();
      contributor = linked.data;
      error = linked.error;
    }
  }

  if (error || !contributor) return null;
  if (contributor.membership_status !== "active") return null;
  if (new Date(contributor.access_expires_at).getTime() <= Date.now()) {
    await supabase
      .from("contributors")
      .update({ membership_status: "expired", updated_at: new Date().toISOString() })
      .eq("id", contributor.id);
    return null;
  }

  return { row: contributor as ContributorRow, accessToken };
}

function membershipFromRow(
  row: ContributorRow,
  payment: ContributorPaymentRow,
): ContributorMembership {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    contributorNumber: row.contributor_number,
    membershipStatus: row.membership_status,
    paidAt: row.paid_at,
    accessStartsAt: row.access_starts_at,
    accessExpiresAt: row.access_expires_at,
    amountPaidCents: payment.amount_total,
    currency: payment.currency,
    futureDiscountEligible: row.future_discount_eligible,
    termsVersion: row.terms_version,
    onboardingCompletedAt: row.onboarding_completed_at,
  };
}

export async function loadContributorDashboard(
  request: Request,
): Promise<ContributorDashboard | null> {
  if (await isLocalContributorPreview(request)) {
    return contributorPreviewDashboard;
  }

  const authenticated = await getAuthenticatedContributor(request);
  if (!authenticated) return null;

  const supabase = await getSupabaseAdmin();
  const contributorId = authenticated.row.id;
  const [paymentResult, profileResult, updatesResult, questionsResult, eventsResult, votesResult, responsesResult, researchResult] =
    await Promise.all([
      supabase
        .from("contributor_payments")
        .select("amount_total,currency")
        .eq("contributor_id", contributorId)
        .not("payment_status", "like", "duplicate_%")
        .order("paid_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("contributor_profiles")
        .select("preferred_name,country,learning_goal,product_areas,founders_wall_opt_in")
        .eq("contributor_id", contributorId)
        .maybeSingle(),
      supabase
        .from("contributor_updates")
        .select("id,title,summary,body,category,published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false }),
      supabase
        .from("contributor_questions")
        .select("id,contributor_id,question,answer,submitted_at,answered_at,is_published")
        .or(`is_published.eq.true,contributor_id.eq.${contributorId}`)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("contributor_events")
        .select("id,title,description,starts_at,event_url,recording_url")
        .eq("is_published", true)
        .order("starts_at", { ascending: true }),
      supabase
        .from("contributor_votes")
        .select("id,title,description,options,closes_at")
        .eq("is_published", true)
        .order("closes_at", { ascending: true }),
      supabase
        .from("contributor_vote_responses")
        .select("vote_id,option_id")
        .eq("contributor_id", contributorId),
      supabase
        .from("contributor_research_opportunities")
        .select("id,title,description,eligibility,apply_url")
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
    ]);

  const firstError = [
    paymentResult.error,
    profileResult.error,
    updatesResult.error,
    questionsResult.error,
    eventsResult.error,
    votesResult.error,
    responsesResult.error,
    researchResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;
  if (!paymentResult.data) {
    throw new Error("The contributor payment record was not found.");
  }

  const selectedOptions = new Map(
    (responsesResult.data ?? []).map((response) => [response.vote_id, response.option_id]),
  );
  const updates: ContributorUpdate[] = (updatesResult.data ?? []).map((update) => ({
    id: update.id,
    title: update.title,
    summary: update.summary,
    body: update.body,
    category: update.category,
    publishedAt: update.published_at,
  }));
  const questions: ContributorQuestion[] = (questionsResult.data ?? []).map((question) => ({
    id: question.id,
    question: question.question,
    answer: question.answer,
    submittedAt: question.submitted_at,
    answeredAt: question.answered_at,
    askedBy:
      question.contributor_id === contributorId
        ? "You"
        : "A Founding Contributor",
  }));
  const events: ContributorEvent[] = (eventsResult.data ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    eventUrl: event.event_url,
    recordingUrl: event.recording_url,
  }));
  const votes: ContributorVote[] = (votesResult.data ?? []).map((vote) => ({
    id: vote.id,
    title: vote.title,
    description: vote.description,
    options: Array.isArray(vote.options) ? vote.options : [],
    closesAt: vote.closes_at,
    selectedOptionId: selectedOptions.get(vote.id) ?? null,
  }));
  const research: ContributorResearchOpportunity[] = (researchResult.data ?? []).map(
    (opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      description: opportunity.description,
      eligibility: opportunity.eligibility,
      applyUrl: opportunity.apply_url,
    }),
  );

  return {
    membership: membershipFromRow(
      authenticated.row,
      paymentResult.data as ContributorPaymentRow,
    ),
    profile: {
      preferredName:
        profileResult.data?.preferred_name ?? authenticated.row.preferred_name ?? "",
      country: profileResult.data?.country ?? "",
      learningGoal: profileResult.data?.learning_goal ?? "",
      productAreas: Array.isArray(profileResult.data?.product_areas)
        ? profileResult.data.product_areas
        : [],
      foundersWallOptIn: Boolean(profileResult.data?.founders_wall_opt_in),
    },
    updates,
    questions,
    events,
    votes,
    research,
    roadmap: contributorPreviewDashboard.roadmap,
  };
}
