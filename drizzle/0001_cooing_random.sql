CREATE TABLE `ingest_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_label` text NOT NULL,
	`source_citation` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_chunks` integer DEFAULT 0 NOT NULL,
	`processed_chunks` integer DEFAULT 0 NOT NULL,
	`suggestions` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
