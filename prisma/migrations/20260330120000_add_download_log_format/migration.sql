ALTER TABLE `download_logs`
    ADD COLUMN `format` ENUM('pdf', 'docx') NOT NULL DEFAULT 'docx' AFTER `type`,
    ADD INDEX `download_logs_user_id_type_format_downloaded_at_idx` (`user_id`, `type`, `format`, `downloaded_at`);
