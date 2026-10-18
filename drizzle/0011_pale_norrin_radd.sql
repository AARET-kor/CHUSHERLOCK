PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bbip_turns` (
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
	FOREIGN KEY (`session_id`) REFERENCES `bbip_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`promoted_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_bbip_turns`("id", "session_id", "kind", "section_key", "question", "output", "followups", "model", "status", "error", "promoted_entry_id", "created_at") SELECT "id", "session_id", "kind", "section_key", "question", "output", "followups", "model", "status", "error", "promoted_entry_id", "created_at" FROM `bbip_turns`;--> statement-breakpoint
DROP TABLE `bbip_turns`;--> statement-breakpoint
ALTER TABLE `__new_bbip_turns` RENAME TO `bbip_turns`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bbip_turns_session_idx` ON `bbip_turns` (`session_id`,`created_at`);