-- Аудит 15.08.2026: инварианты переезжают из проверок приложения в схему,
-- частые запросы получают индексы. Сначала вычищаются возможные дубли,
-- потом создаются уникальные индексы — иначе миграция упала бы на боевых данных.

-- Дубли свободных окон на одно и то же время (гонка openSlots): оставляем
-- занятые, из свободных — самое раннее.
DELETE FROM `slots` WHERE `status` = 'free' AND `id` NOT IN (
  SELECT MIN(`id`) FROM `slots` s2
  WHERE s2.`psychologist_id` = `slots`.`psychologist_id` AND s2.`starts_at` = `slots`.`starts_at`
) AND EXISTS (
  SELECT 1 FROM `slots` s3
  WHERE s3.`psychologist_id` = `slots`.`psychologist_id` AND s3.`starts_at` = `slots`.`starts_at`
    AND s3.`id` <> `slots`.`id`
);
--> statement-breakpoint
-- Дубли активных предложений одной пары «заявка-психолог»: старшие деактивируем.
UPDATE `matches` SET `active` = 0 WHERE `active` = 1 AND `id` NOT IN (
  SELECT MIN(`id`) FROM `matches` m2
  WHERE m2.`client_request_id` = `matches`.`client_request_id`
    AND m2.`psychologist_id` = `matches`.`psychologist_id` AND m2.`active` = 1
);
--> statement-breakpoint
-- Дубли отзывов на одну встречу: остаётся первый.
DELETE FROM `reviews` WHERE `slot_id` IS NOT NULL AND `id` NOT IN (
  SELECT MIN(`id`) FROM `reviews` r2 WHERE r2.`slot_id` = `reviews`.`slot_id`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_psy_time_unique` ON `slots` (`psychologist_id`, `starts_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_active_pair_unique` ON `matches` (`client_request_id`, `psychologist_id`) WHERE `active` = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_slot_unique` ON `reviews` (`slot_id`) WHERE `slot_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `slots_client_request_idx` ON `slots` (`client_request_id`);
--> statement-breakpoint
CREATE INDEX `matches_request_active_idx` ON `matches` (`client_request_id`, `active`);
--> statement-breakpoint
CREATE INDEX `client_requests_account_idx` ON `client_requests` (`account_id`);
--> statement-breakpoint
CREATE INDEX `psychologists_account_idx` ON `psychologists` (`account_id`);
--> statement-breakpoint
CREATE INDEX `reviews_psy_status_idx` ON `reviews` (`psychologist_id`, `status`);
--> statement-breakpoint
CREATE INDEX `notifications_status_idx` ON `notifications` (`status`);
--> statement-breakpoint
CREATE INDEX `error_log_seen_idx` ON `error_log` (`seen`);
