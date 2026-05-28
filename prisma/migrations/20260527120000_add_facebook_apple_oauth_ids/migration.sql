ALTER TABLE `users`
    ADD COLUMN `facebook_id` VARCHAR(255) NULL AFTER `google_id`,
    ADD COLUMN `apple_id` VARCHAR(255) NULL AFTER `facebook_id`;

CREATE INDEX `idx_users_google_id` ON `users`(`google_id`);
CREATE INDEX `idx_users_facebook_id` ON `users`(`facebook_id`);
CREATE INDEX `idx_users_apple_id` ON `users`(`apple_id`);
