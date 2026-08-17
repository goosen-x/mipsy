-- Журнал платёжных событий: каждый шаг от создания платежа до отметки на брони.
-- Читается в /admin/payments, чтобы видеть, где застрял платёж, не лазая в базу.
CREATE TABLE `payment_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`payment_id` integer,
	`provider` text,
	`event` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `payment_log_payment_idx` ON `payment_log` (`payment_id`);
