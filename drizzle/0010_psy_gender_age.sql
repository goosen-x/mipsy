-- Автоподбор по анкете: клиент выбирает пол и возраст специалиста,
-- значит психолог должен их сообщить. У прежних заявок полей нет —
-- матчинг тогда опирается только на темы.
ALTER TABLE `psychologists` ADD COLUMN `gender` text;
--> statement-breakpoint
ALTER TABLE `psychologists` ADD COLUMN `birth_year` integer;
