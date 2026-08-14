-- ICS-фид «мои встречи mipsy»: психолог подписывается на секретный URL из
-- Google/Яндекс/Apple-календаря, и брони появляются у него сами. Токен — только
-- секрет ссылки, доступа в кабинет не даёт.
ALTER TABLE `psychologists` ADD COLUMN `calendar_token` text;
--> statement-breakpoint
UPDATE `psychologists` SET `calendar_token` = lower(hex(randomblob(16)));
--> statement-breakpoint
CREATE UNIQUE INDEX `psychologists_calendar_token_unique` ON `psychologists` (`calendar_token`);
