CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`zone` text NOT NULL,
	`section` text NOT NULL,
	`birth` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`uf` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`cpf` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_records_owner` ON `records` (`owner`);