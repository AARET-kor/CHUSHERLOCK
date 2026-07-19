CREATE TABLE `flashcards` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`status` text DEFAULT 'learning' NOT NULL,
	`learning_step` integer DEFAULT 0 NOT NULL,
	`ease_milli` integer DEFAULT 2500 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_reviewed_at` text,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `clusters` ADD `origin` text DEFAULT 'ai' NOT NULL;