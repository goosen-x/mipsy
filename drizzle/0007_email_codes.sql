CREATE TABLE `email_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sent_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
