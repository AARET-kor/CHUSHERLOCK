CREATE INDEX IF NOT EXISTS `sources_citation_idx` ON `sources` (`citation`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entries_category_idx` ON `entries` (`category_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entries_tier_idx` ON `entries` (`tier`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entries_status_idx` ON `entries` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entries_updated_idx` ON `entries` (`updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_sources_source_idx` ON `entry_sources` (`source_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `figures_entry_idx` ON `figures` (`entry_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `figures_job_idx` ON `figures` (`job_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `flashcards_due_idx` ON `flashcards` (`due_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `flashcards_entry_idx` ON `flashcards` (`entry_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_relations_related_idx` ON `entry_relations` (`related_entry_id`);
