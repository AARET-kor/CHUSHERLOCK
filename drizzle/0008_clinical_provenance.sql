ALTER TABLE `sources` ADD `version_label` text;
--> statement-breakpoint
ALTER TABLE `sources` ADD `valid_until` text;
--> statement-breakpoint
ALTER TABLE `sources` ADD `evidence_level` text;
--> statement-breakpoint
ALTER TABLE `entries` ADD `content_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `entries` ADD `reviewed_by` text;
--> statement-breakpoint
ALTER TABLE `entries` ADD `reviewed_at` text;
--> statement-breakpoint
ALTER TABLE `entries` ADD `review_due_at` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `ai_model` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `prompt_version` text;
--> statement-breakpoint
CREATE TABLE `entry_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `entry_id` text NOT NULL,
  `source_id` text,
  `claim_text` text NOT NULL,
  `representation` text NOT NULL,
  `original_quote` text,
  `source_location` text NOT NULL,
  `page_start` integer,
  `page_end` integer,
  `section` text,
  `evidence_level` text DEFAULT 'unknown' NOT NULL,
  `conflict_status` text DEFAULT 'none' NOT NULL,
  `conflict_note` text,
  `conflicts_with_claim_id` text,
  `verified_by` text,
  `verified_at` text,
  `generated_by_model` text,
  `prompt_version` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entry_claims_entry_idx` ON `entry_claims` (`entry_id`);
--> statement-breakpoint
CREATE INDEX `entry_claims_source_idx` ON `entry_claims` (`source_id`);
--> statement-breakpoint
CREATE INDEX `entry_claims_conflict_idx` ON `entry_claims` (`conflict_status`);
--> statement-breakpoint
CREATE TABLE `entry_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `entry_id` text NOT NULL,
  `version` integer NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `status` text NOT NULL,
  `changed_by` text,
  `change_note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entry_revisions_entry_version_idx` ON `entry_revisions` (`entry_id`,`version`);
