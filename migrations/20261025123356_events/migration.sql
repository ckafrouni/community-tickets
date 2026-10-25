CREATE TABLE `event_members` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `event_members_pk` PRIMARY KEY(`event_id`, `user_id`),
	CONSTRAINT `fk_event_members_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_members_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`starts_at` text DEFAULT '' NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`info` text DEFAULT '' NOT NULL,
	`ticket_price` integer NOT NULL,
	`currency` text NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_events_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`),
	CONSTRAINT "events_ticket_price_not_negative" CHECK("ticket_price" >= 0)
);
--> statement-breakpoint
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`event_id` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_email` text DEFAULT '' NOT NULL,
	`buyer_phone` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`cancelled_at` text,
	`cancel_reason` text DEFAULT '' NOT NULL,
	`email_status` text DEFAULT 'not_sent' NOT NULL,
	`email_updated_at` text,
	`email_error` text DEFAULT '' NOT NULL,
	CONSTRAINT `fk_orders_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`),
	CONSTRAINT "orders_quantity_positive" CHECK("quantity" > 0),
	CONSTRAINT "orders_amount_not_negative" CHECK("amount" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_orders` (`id`, `buyer_name`, `buyer_email`, `buyer_phone`, `quantity`, `amount`, `currency`, `notes`, `created_at`, `cancelled_at`, `cancel_reason`, `email_status`, `email_updated_at`, `email_error`, `event_id`) SELECT `id`, `buyer_name`, `buyer_email`, `buyer_phone`, `quantity`, `amount`, `currency`, `notes`, `created_at`, `cancelled_at`, `cancel_reason`, `email_status`, `email_updated_at`, `email_error`, NULL FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
CREATE INDEX `event_members_user_id_idx` ON `event_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_event_id_idx` ON `orders` (`event_id`);--> statement-breakpoint
DROP TABLE `settings`;