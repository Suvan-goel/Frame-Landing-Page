import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const waitlistSignups = sqliteTable("waitlist_signups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull().unique(),
  placement: text("placement").notNull().default("landing_page"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
