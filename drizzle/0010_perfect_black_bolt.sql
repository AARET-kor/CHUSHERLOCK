CREATE TABLE `bbip_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`chips` text NOT NULL,
	`flags` text NOT NULL,
	`source_note_ids` text NOT NULL,
	`prompt_version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bbip_sessions_created_idx` ON `bbip_sessions` (`created_at`);--> statement-breakpoint
CREATE TABLE `bbip_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`section_key` text,
	`question` text,
	`output` text DEFAULT '' NOT NULL,
	`followups` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'streaming' NOT NULL,
	`error` text,
	`promoted_entry_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `bbip_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bbip_turns_session_idx` ON `bbip_turns` (`session_id`,`created_at`);