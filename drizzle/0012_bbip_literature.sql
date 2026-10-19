CREATE TABLE `literature_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`results` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `bbip_sessions` ADD `literature` text;