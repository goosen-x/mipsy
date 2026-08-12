ALTER TABLE `client_requests` ADD `email` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `chosen` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `channel` text DEFAULT 'sms' NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `recipient_email` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `subject` text;--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`psychologist_id` integer NOT NULL,
	`client_request_id` integer NOT NULL,
	`slot_id` integer,
	`rating` integer NOT NULL,
	`body` text,
	`author_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderation_notes` text,
	FOREIGN KEY (`psychologist_id`) REFERENCES `psychologists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_request_id`) REFERENCES `client_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`from_role` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`body` text NOT NULL,
	`client_request_id` integer,
	`psychologist_id` integer,
	`status` text DEFAULT 'new' NOT NULL,
	`operator_notes` text,
	FOREIGN KEY (`client_request_id`) REFERENCES `client_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`psychologist_id`) REFERENCES `psychologists`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
UPDATE `matches` SET `chosen` = 1 WHERE `active` = 1;
