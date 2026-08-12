ALTER TABLE `client_requests` ADD `client_token` text;--> statement-breakpoint
ALTER TABLE `client_requests` ADD `rematch_reason` text;--> statement-breakpoint
CREATE UNIQUE INDEX `client_requests_client_token_unique` ON `client_requests` (`client_token`);--> statement-breakpoint
CREATE TABLE `slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`psychologist_id` integer NOT NULL,
	`starts_at` text NOT NULL,
	`duration_min` integer DEFAULT 50 NOT NULL,
	`status` text DEFAULT 'free' NOT NULL,
	`client_request_id` integer,
	`is_intro_call` integer DEFAULT false NOT NULL,
	`meeting_link` text,
	FOREIGN KEY (`psychologist_id`) REFERENCES `psychologists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_request_id`) REFERENCES `client_requests`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
DROP TABLE IF EXISTS `sessions`;
