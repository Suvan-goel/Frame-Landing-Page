type FrameRuntimeEnv = {
  DB?: D1Database;
  WAITLIST_ADMIN_EMAILS?: string;
};

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as FrameRuntimeEnv;
}

export async function getWaitlistDatabase(): Promise<D1Database> {
  const database = (await runtimeEnv()).DB;
  if (!database) {
    throw new Error("Waitlist storage is unavailable.");
  }

  return database;
}

export async function ensureWaitlistStorage() {
  const database = await getWaitlistDatabase();

  await database.batch([
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS waitlist_signups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          normalized_email TEXT NOT NULL UNIQUE,
          placement TEXT NOT NULL DEFAULT 'landing_page',
          utm_source TEXT,
          utm_medium TEXT,
          utm_campaign TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS waitlist_signups_created_at_idx ON waitlist_signups (created_at DESC)",
    ),
  ]);
}

export async function isWaitlistAdmin(email: string) {
  const configuredEmails = (await runtimeEnv()).WAITLIST_ADMIN_EMAILS ?? "";
  const allowedEmails = configuredEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email.trim().toLowerCase());
}
