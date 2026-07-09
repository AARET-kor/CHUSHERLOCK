CREATE TABLE `categories` (
	`key` text PRIMARY KEY NOT NULL,
	`label_ko` text NOT NULL,
	`label_en` text NOT NULL,
	`parent_key` text,
	`description_ko` text,
	`description_en` text
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`category_key` text NOT NULL,
	`tier` text NOT NULL,
	`tags` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`exported_at` text,
	FOREIGN KEY (`category_key`) REFERENCES `categories`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entry_relations` (
	`entry_id` text NOT NULL,
	`related_entry_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `related_entry_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entry_sources` (
	`entry_id` text NOT NULL,
	`source_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `source_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`citation` text NOT NULL,
	`url` text,
	`authors` text,
	`year` integer
);
