CREATE TABLE `waitlist_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`placement` text DEFAULT 'landing_page' NOT NULL,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_signups_normalized_email_unique` ON `waitlist_signups` (`normalized_email`);