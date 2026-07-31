/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import {
  chatGPTSignOutPath,
  requireChatGPTUser,
} from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";
import { BrandWordmark } from "@/app/components/brand-wordmark";

export const dynamic = "force-dynamic";

type WaitlistSignup = {
  id: number;
  email: string;
  placement: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

export default async function WaitlistAdminPage() {
  const user = await requireChatGPTUser("/admin/waitlist");
  if (!(await isWaitlistAdmin(user.email))) {
    notFound();
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("waitlist_signups")
    .select(
      "id,email,placement,utm_source,utm_medium,utm_campaign,created_at",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500)
    .returns<WaitlistSignup[]>();

  if (error) {
    console.error("Waitlist dashboard query failed", error);
    throw new Error("The waitlist is temporarily unavailable.");
  }
  const signups = data ?? [];

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <a className="wordmark" href="/" aria-label="Frame home">
              <BrandWordmark />
            </a>
            <p className="eyebrow">Owner view</p>
            <h1>Waitlist</h1>
            <p>
              {signups.length} most recent{" "}
              {signups.length === 1 ? "signup" : "signups"}
            </p>
          </div>
          <div className="admin-actions">
            <a className="button button--dark" href="/api/admin/waitlist.csv">
              Export CSV
            </a>
            <a className="text-link" href={chatGPTSignOutPath("/")}>
              Sign out
            </a>
          </div>
        </header>

        {signups.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Campaign</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((signup) => (
                  <tr key={signup.id}>
                    <td>{signup.email}</td>
                    <td>{signup.placement.replaceAll("_", " ")}</td>
                    <td>
                      {[signup.utm_source, signup.utm_medium, signup.utm_campaign]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </td>
                    <td>
                      <time dateTime={signup.created_at}>
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        }).format(new Date(signup.created_at))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">
            <h2>No signups yet.</h2>
            <p>Your first waitlist signup will appear here.</p>
          </div>
        )}
      </div>
    </main>
  );
}
