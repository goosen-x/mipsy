CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`login_code` text,
	`login_code_sent_at` text,
	`login_attempts` integer DEFAULT 0 NOT NULL,
	`last_login_at` text
);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
ALTER TABLE `client_requests` ADD `account_id` integer REFERENCES accounts(id);--> statement-breakpoint
ALTER TABLE `psychologists` ADD `account_id` integer REFERENCES accounts(id);--> statement-breakpoint
INSERT INTO `accounts` (`email`, `name`, `phone`)
SELECT lower(trim(`email`)), min(`name`), min(`phone`) FROM `psychologists`
WHERE `email` IS NOT NULL AND trim(`email`) <> ''
GROUP BY lower(trim(`email`))
ON CONFLICT(`email`) DO NOTHING;--> statement-breakpoint
INSERT INTO `accounts` (`email`, `name`, `phone`)
SELECT lower(trim(`email`)), min(`name`), min(`phone`) FROM `client_requests`
WHERE `email` IS NOT NULL AND trim(`email`) <> ''
GROUP BY lower(trim(`email`))
ON CONFLICT(`email`) DO NOTHING;--> statement-breakpoint
UPDATE `psychologists` SET `account_id` = (
	SELECT `a`.`id` FROM `accounts` `a` WHERE `a`.`email` = lower(trim(`psychologists`.`email`))
) WHERE `email` IS NOT NULL AND trim(`email`) <> '';--> statement-breakpoint
UPDATE `client_requests` SET `account_id` = (
	SELECT `a`.`id` FROM `accounts` `a` WHERE `a`.`email` = lower(trim(`client_requests`.`email`))
) WHERE `email` IS NOT NULL AND trim(`email`) <> '';--> statement-breakpoint
ALTER TABLE `client_requests` DROP COLUMN `access_code`;--> statement-breakpoint
ALTER TABLE `psychologists` DROP COLUMN `access_code`;
