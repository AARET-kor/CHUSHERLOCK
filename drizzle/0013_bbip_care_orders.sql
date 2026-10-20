CREATE TABLE `bbip_care_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`items` text NOT NULL,
	`set_keys` text NOT NULL,
	`caution` text DEFAULT '' NOT NULL,
	`notices` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `bbip_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bbip_care_orders_session_id_unique` ON `bbip_care_orders` (`session_id`);--> statement-breakpoint
CREATE TABLE `bbip_care_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`procedure_key` text NOT NULL,
	`label` text NOT NULL,
	`items` text NOT NULL,
	`source_session_id` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bbip_care_sets_procedure_key_unique` ON `bbip_care_sets` (`procedure_key`);