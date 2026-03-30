ALTER TABLE `users`
    ADD COLUMN `last_login_at` TIMESTAMP(0) NULL AFTER `email_verified_at`;
