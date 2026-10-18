ALTER TABLE `ingest_jobs` ADD `payload_path` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `payload_kind` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `attempts` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `max_attempts` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `worker_id` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `heartbeat_at` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `lease_until` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `next_run_at` text;
--> statement-breakpoint
ALTER TABLE `ingest_jobs` ADD `cancel_requested_at` text;
--> statement-breakpoint
CREATE INDEX `ingest_jobs_status_next_run_idx` ON `ingest_jobs` (`status`,`next_run_at`);
--> statement-breakpoint
CREATE INDEX `ingest_jobs_lease_idx` ON `ingest_jobs` (`lease_until`);
