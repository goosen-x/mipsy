CREATE TABLE `client_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`for_whom` text NOT NULL,
	`gender` text,
	`age` integer,
	`therapy_experience` text,
	`main_problem` text,
	`topic_slugs` text,
	`topic_other` text,
	`freq_down` text,
	`freq_sleep` text,
	`freq_self_harm` text,
	`life_impact` text,
	`pref_gender` text,
	`pref_age` text,
	`preferred_time` text,
	`story` text,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`pd_consent` integer DEFAULT false NOT NULL,
	`crisis_flag` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`operator_notes` text
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`client_request_id` integer NOT NULL,
	`psychologist_id` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text,
	FOREIGN KEY (`client_request_id`) REFERENCES `client_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`psychologist_id`) REFERENCES `psychologists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `psychologists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`cabinet_token` text NOT NULL,
	`slug` text,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`education` text,
	`education_docs` text,
	`experience_years` integer,
	`supervision` text,
	`personal_therapy` text,
	`moderation_status` text DEFAULT 'new' NOT NULL,
	`moderation_notes` text,
	`photo_url` text,
	`approach` text,
	`format` text,
	`price` text,
	`about` text,
	`topic_slugs` text,
	`how_sessions` text,
	`faq` text,
	`intro_call_enabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `psychologists_cabinet_token_unique` ON `psychologists` (`cabinet_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `psychologists_slug_unique` ON `psychologists` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`match_id` integer NOT NULL,
	`scheduled_at` text,
	`is_intro_call` integer DEFAULT false NOT NULL,
	`format` text,
	`meeting_link` text,
	`status` text DEFAULT 'planned' NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_slug_unique` ON `topics` (`slug`);