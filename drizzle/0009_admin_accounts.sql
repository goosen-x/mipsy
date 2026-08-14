-- Личные кабинеты админов: роль на аккаунте вместо общего пароля оператора,
-- журнал действий становится именным.
ALTER TABLE `accounts` ADD COLUMN `is_admin` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `admin_log` ADD COLUMN `actor_account_id` integer REFERENCES `accounts`(`id`);
