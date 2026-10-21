CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`procedure` text NOT NULL,
	`indication` text DEFAULT '' NOT NULL,
	`planned_sessions` integer,
	`score_kind` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `courses_patient_idx` ON `courses` (`patient_id`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`chart_no` text NOT NULL,
	`alias` text DEFAULT '' NOT NULL,
	`features` text DEFAULT '' NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_chart_no_unique` ON `patients` (`chart_no`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`angle` text NOT NULL,
	`file` text NOT NULL,
	`thumb` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_visit_idx` ON `photos` (`visit_id`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`session_no` integer,
	`product` text DEFAULT '' NOT NULL,
	`params` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`gais_doctor` integer,
	`gais_patient` integer,
	`score` integer,
	`next_fu_date` text,
	`session_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `bbip_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `visits_course_idx` ON `visits` (`course_id`);--> statement-breakpoint
CREATE INDEX `visits_session_idx` ON `visits` (`session_id`);--> statement-breakpoint
ALTER TABLE `bbip_sessions` ADD `patient_id` text REFERENCES patients(id) ON DELETE set null;