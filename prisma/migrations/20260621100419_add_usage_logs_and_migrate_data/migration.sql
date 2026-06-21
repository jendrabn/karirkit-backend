-- CreateTable: usage_logs
CREATE TABLE `usage_logs` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `feature` ENUM('cv_download_pdf', 'cv_download_docx', 'app_letter_download_pdf', 'app_letter_download_docx', 'ai_improve_cv', 'ai_improve_app_letter') NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `usage_logs_user_id_idx`(`user_id`),
    INDEX `usage_logs_created_at_idx`(`created_at`),
    INDEX `usage_logs_user_id_feature_created_at_idx`(`user_id`, `feature`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate data from download_logs to usage_logs
INSERT INTO `usage_logs` (`id`, `user_id`, `feature`, `created_at`)
SELECT
    `id`,
    `user_id`,
    CASE
        WHEN `type` = 'cv' AND `format` = 'pdf' THEN 'cv_download_pdf'
        WHEN `type` = 'cv' AND (`format` = 'docx' OR `format` IS NULL) THEN 'cv_download_docx'
        WHEN `type` = 'application_letter' AND `format` = 'pdf' THEN 'app_letter_download_pdf'
        WHEN `type` = 'application_letter' AND (`format` = 'docx' OR `format` IS NULL) THEN 'app_letter_download_docx'
    END AS `feature`,
    `downloaded_at` AS `created_at`
FROM `download_logs`
WHERE `type` IN ('cv', 'application_letter');

-- Migrate data from ai_improvement_logs to usage_logs
INSERT INTO `usage_logs` (`id`, `user_id`, `feature`, `created_at`)
SELECT
    `id`,
    `user_id`,
    CASE
        WHEN `type` = 'cv' THEN 'ai_improve_cv'
        WHEN `type` = 'application_letter' THEN 'ai_improve_app_letter'
    END AS `feature`,
    `used_at` AS `created_at`
FROM `ai_improvement_logs`
WHERE `type` IN ('cv', 'application_letter');

-- Drop old tables
DROP TABLE `ai_improvement_logs`;
DROP TABLE `download_logs`;

-- AddForeignKey
ALTER TABLE `usage_logs` ADD CONSTRAINT `usage_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
