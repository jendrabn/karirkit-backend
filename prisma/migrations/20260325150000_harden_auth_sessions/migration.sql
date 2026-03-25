ALTER TABLE `users`
    ADD COLUMN `password_reset_token_id` VARCHAR(255) NULL,
    ADD COLUMN `session_invalid_before` TIMESTAMP(0) NULL;
