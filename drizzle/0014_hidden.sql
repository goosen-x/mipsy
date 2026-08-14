-- Скрытие из админки. Скрытый психолог пропадает с витрины и из автоподбора
-- (текущие брони не трогаются). Скрытый аккаунт не может войти: сессия и коды
-- перестают работать, наружу это неотличимо от «код не подошёл».
ALTER TABLE `accounts` ADD COLUMN `hidden` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `psychologists` ADD COLUMN `hidden` integer NOT NULL DEFAULT 0;
