CREATE TABLE `client_requests_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`account_id` integer REFERENCES accounts(id),
	`for_whom` text NOT NULL,
	`gender` text,
	`age` integer,
	`therapy_experience` text,
	`main_problem` text,
	`topic_slugs` text,
	`topic_other` text,
	`freq_down` text,
	`freq_sleep` text,
	`freq_self_harm` text,
	`life_impact` text,
	`pref_gender` text,
	`pref_age` text,
	`preferred_time` text,
	`story` text,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`pd_consent` integer DEFAULT false NOT NULL,
	`crisis_flag` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`operator_notes` text,
	`client_token` text,
	`rematch_reason` text
);--> statement-breakpoint
INSERT INTO `client_requests_new` (
	`id`, `created_at`, `account_id`, `for_whom`, `gender`, `age`, `therapy_experience`,
	`main_problem`, `topic_slugs`, `topic_other`, `freq_down`, `freq_sleep`, `freq_self_harm`,
	`life_impact`, `pref_gender`, `pref_age`, `preferred_time`, `story`, `name`, `phone`, `email`,
	`pd_consent`, `crisis_flag`, `status`, `operator_notes`, `client_token`, `rematch_reason`
)
SELECT
	`id`, `created_at`, `account_id`, `for_whom`, `gender`, `age`, `therapy_experience`,
	`main_problem`, `topic_slugs`, `topic_other`, `freq_down`, `freq_sleep`, `freq_self_harm`,
	`life_impact`, `pref_gender`, `pref_age`, `preferred_time`, `story`, `name`, `phone`, `email`,
	`pd_consent`, `crisis_flag`, `status`, `operator_notes`, `client_token`, `rematch_reason`
FROM `client_requests`;--> statement-breakpoint
DROP TABLE `client_requests`;--> statement-breakpoint
ALTER TABLE `client_requests_new` RENAME TO `client_requests`;--> statement-breakpoint
CREATE UNIQUE INDEX `client_requests_client_token_unique` ON `client_requests` (`client_token`);
