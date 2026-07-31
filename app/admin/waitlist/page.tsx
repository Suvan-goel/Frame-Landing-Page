/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import {
  chatGPTSignOutPath,
  requireChatGPTUser,
} from "@/app/chatgpt-auth";
import {
  ensureWaitlistStorage,
  getWaitlistDatabase,
  isWaitlistAdmin,
} from "@/db/waitlist";

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

  await ensureWaitlistStorage();
  const database = await getWaitlistDatabase();
  const signups = await database
    .prepare(
      `SELECT
        id,
        email,
        placement,
        utm_source,
        utm_medium,
        utm_campaign,
        created_at
      FROM waitlist_signups
      ORDER BY created_at DESC, id DESC
      LIMIT 500`,
    )
    .all<WaitlistSignup>();

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <a className="wordmark" href="/" aria-label="Frame home">
              Frame<span>.</span>
            </a>
            <p className="eyebrow">Owner view</p>
            <h1>Waitlist</h1>
            <p>
              {signups.results.length} most recent{" "}
              {signups.results.length === 1 ? "signup" : "signups"}
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

        {signups.results.length ? (
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
                {signups.results.map((signup) => (
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
                        }).format(new Date(`${signup.created_at}Z`))}
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
