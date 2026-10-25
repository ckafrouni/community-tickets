CREATE TABLE `__events_backup` AS SELECT * FROM `events`;--> statement-breakpoint
CREATE TABLE `__event_members_backup` AS SELECT * FROM `event_members`;--> statement-breakpoint
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`starts_at` text DEFAULT '' NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`info` text DEFAULT '' NOT NULL,
	`currency` text NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`bank_details` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_events_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
INSERT INTO `events`(`id`, `name`, `starts_at`, `venue`, `info`, `currency`, `contact_email`, `created_by`, `created_at`) SELECT `id`, `name`, `starts_at`, `venue`, `info`, `currency`, `contact_email`, `created_by`, `created_at` FROM `__events_backup`;--> statement-breakpoint
DELETE FROM `event_members`;--> statement-breakpoint
INSERT INTO `event_members` (`event_id`, `user_id`, `role`, `created_at`) SELECT `event_id`, `user_id`, `role`, `created_at` FROM `__event_members_backup`;--> statement-breakpoint
DROP TABLE `__event_members_backup`;--> statement-breakpoint
CREATE TABLE `ticket_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`archived_at` text,
	CONSTRAINT `fk_ticket_types_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT "ticket_types_price_not_negative" CHECK("price" >= 0)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`order_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`received_at` text NOT NULL,
	`recorded_by` text DEFAULT '' NOT NULL,
	CONSTRAINT `fk_payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
	CONSTRAINT "payments_amount_positive" CHECK("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `tickets_sent_at` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `ticket_type_id` integer REFERENCES ticket_types(id);--> statement-breakpoint
INSERT INTO `ticket_types` (`event_id`, `name`, `price`, `position`, `created_at`) SELECT `id`, 'Plein tarif', `ticket_price`, 0, `created_at` FROM `__events_backup`;--> statement-breakpoint
DROP TABLE `__events_backup`;--> statement-breakpoint
UPDATE `tickets` SET `ticket_type_id` = (SELECT `tt`.`id` FROM `ticket_types` `tt` JOIN `orders` `o` ON `o`.`event_id` = `tt`.`event_id` WHERE `o`.`id` = `tickets`.`order_id` ORDER BY `tt`.`id` LIMIT 1);--> statement-breakpoint
INSERT INTO `payments` (`order_id`, `amount`, `method`, `note`, `received_at`, `recorded_by`) SELECT `id`, `amount`, 'cash', '', `created_at`, '' FROM `orders` WHERE `amount` > 0;--> statement-breakpoint
UPDATE `orders` SET `tickets_sent_at` = `email_updated_at` WHERE `email_status` = 'sent';--> statement-breakpoint
CREATE INDEX `payments_order_id_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `ticket_types_event_id_idx` ON `ticket_types` (`event_id`);
