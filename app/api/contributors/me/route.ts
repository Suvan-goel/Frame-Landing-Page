import { loadContributorDashboard } from "@/lib/contributor-access.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const dashboard = await loadContributorDashboard(request);
    if (!dashboard) {
      return Response.json(
        { error: "Sign in with the email used for your active membership." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(dashboard, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    console.error("Contributor dashboard failed", error);
    return Response.json(
      { error: "The contributor hub is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
