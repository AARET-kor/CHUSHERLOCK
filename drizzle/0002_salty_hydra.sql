CREATE TABLE `figures` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`entry_id` text,
	`filename` text NOT NULL,
	`kind` text NOT NULL,
	`caption` text NOT NULL,
	`page` integer,
	`created_at` text NOT NULL
);
