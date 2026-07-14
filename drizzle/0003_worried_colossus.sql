CREATE TABLE `cluster_entries` (
	`cluster_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`cluster_id`, `entry_id`),
	FOREIGN KEY (`cluster_id`) REFERENCES `clusters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`suggestions` text NOT NULL,
	`created_at` text NOT NULL
);
