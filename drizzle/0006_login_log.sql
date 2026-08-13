CREATE TABLE `login_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`email` text NOT NULL,
	`outcome` text NOT NULL,
	`detail` text
);--> statement-breakpoint
CREATE INDEX `login_log_created_at` ON `login_log` (`created_at`);
