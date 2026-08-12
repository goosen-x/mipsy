ALTER TABLE `psychologists` ADD `meeting_url` text;--> statement-breakpoint
ALTER TABLE `psychologists` ADD `access_code` text;--> statement-breakpoint
ALTER TABLE `client_requests` ADD `access_code` text;--> statement-breakpoint
CREATE TABLE `error_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`detail` text,
	`path` text,
	`seen` integer DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE TABLE `admin_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` integer,
	`detail` text
);
