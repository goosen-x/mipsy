-- Выплата психологу по платежу: отметку ставит оператор в реестре /admin/payments.
ALTER TABLE `payments` ADD `paid_out_at` text;
