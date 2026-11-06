CREATE TABLE `bills` (
	`id` integer PRIMARY KEY NOT NULL,
	`room_id` integer NOT NULL,
	`tenant_id` integer,
	`month` text NOT NULL,
	`rent` real NOT NULL,
	`elec_prev` real NOT NULL,
	`elec_curr` real NOT NULL,
	`elec_rate` real NOT NULL,
	`water_prev` real NOT NULL,
	`water_curr` real NOT NULL,
	`water_rate` real NOT NULL,
	`other` real DEFAULT 0 NOT NULL,
	`other_note` text,
	`total` real NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`paid_at` text,
	`method` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bills_room_month` ON `bills` (`room_id`,`month`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`room_type` text,
	`move_in` text,
	`message` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` integer PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`floor` integer NOT NULL,
	`type` text NOT NULL,
	`size` real,
	`rent` real NOT NULL,
	`maintenance` integer DEFAULT 0 NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_number_unique` ON `rooms` (`number`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`address` text,
	`phone` text,
	`line_id` text,
	`elec_rate` real DEFAULT 7 NOT NULL,
	`water_rate` real DEFAULT 18 NOT NULL,
	`due_day` integer DEFAULT 5 NOT NULL,
	`late_fee` real DEFAULT 50 NOT NULL,
	`bank_name` text,
	`bank_account` text,
	`bank_holder` text
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`line_id` text,
	`room_id` integer,
	`move_in` text,
	`move_out` text,
	`deposit` real DEFAULT 0 NOT NULL,
	`elec_start` real DEFAULT 0 NOT NULL,
	`water_start` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`note` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY NOT NULL,
	`room_id` integer,
	`title` text NOT NULL,
	`detail` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
