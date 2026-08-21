-- Роль аккаунта: одна почта — один кабинет.
-- До этой миграции профиль специалиста и заявки клиента могли висеть на общем
-- аккаунте: вход всегда уводил в /cab, ссылки на /me из кабинета психолога не
-- было, и клиентский кабинет выглядел пропавшим. Роль делает разделение явным
-- и проверяемым на входе в каждое действие.
-- NULL — роль ещё не выбрана: человек вошёл, но анкету и заявку не заполнял.
ALTER TABLE `accounts` ADD `role` text;
--> statement-breakpoint
-- Заполняем по тому, что уже накоплено.
UPDATE `accounts` SET `role` = 'client'
 WHERE `role` IS NULL
   AND EXISTS (
     SELECT 1 FROM `client_requests` WHERE `client_requests`.`account_id` = `accounts`.`id`
   );
--> statement-breakpoint
-- Психолог перевешивает: профиль специалиста несёт документы, статус модерации
-- и slug — анкетой это не восстановить, а заявку клиента можно завести заново.
-- У аккаунтов, где до сих пор жили обе роли, заявки клиента остаются в базе и
-- видны админу — их разносит человек, а не миграция.
UPDATE `accounts` SET `role` = 'psychologist'
 WHERE EXISTS (
   SELECT 1 FROM `psychologists` WHERE `psychologists`.`account_id` = `accounts`.`id`
 );
