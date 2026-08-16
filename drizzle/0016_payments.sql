-- Платежи за сессии через провайдеров (тестовый контур: ЮKassa и CloudPayments
-- параллельно — по итогам теста остаётся один). Сумма в рублях по грейду.
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`slot_id` integer NOT NULL,
	`account_id` integer,
	`amount` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`test_mode` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_slot_idx` ON `payments` (`slot_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_id_unique` ON `payments` (`provider`, `provider_payment_id`) WHERE `provider_payment_id` IS NOT NULL;
