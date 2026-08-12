ALTER TABLE `psychologists` ADD `needs_review` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`kind` text NOT NULL,
	`recipient_role` text NOT NULL,
	`recipient_name` text NOT NULL,
	`recipient_phone` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` text,
	`error` text,
	`client_request_id` integer,
	`psychologist_id` integer,
	`slot_id` integer,
	FOREIGN KEY (`client_request_id`) REFERENCES `client_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`psychologist_id`) REFERENCES `psychologists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action
);
