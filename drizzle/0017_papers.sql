CREATE TABLE `journals` (
	`ta` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`impact_factor` real,
	`if_year` integer,
	`edited` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`added` integer DEFAULT 0 NOT NULL,
	`analyzed` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `papers` (
	`pmid` text PRIMARY KEY NOT NULL,
	`doi` text,
	`pmcid` text,
	`title` text NOT NULL,
	`authors` text NOT NULL,
	`year` integer,
	`journal_ta` text NOT NULL,
	`abstract` text NOT NULL,
	`publication_types` text NOT NULL,
	`level` text NOT NULL,
	`topics` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`analysis` text,
	`analysis_model` text,
	`analysis_started_at` text,
	`analyzed_at` text,
	`review_status` text DEFAULT 'unreviewed' NOT NULL,
	`reviewed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `papers_doi_unique` ON `papers` (`doi`);--> statement-breakpoint
CREATE INDEX `papers_status_idx` ON `papers` (`status`);--> statement-breakpoint
CREATE INDEX `papers_journal_idx` ON `papers` (`journal_ta`);--> statement-breakpoint
CREATE INDEX `papers_year_idx` ON `papers` (`year`);