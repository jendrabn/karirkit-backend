-- CreateTable
CREATE TABLE `ai_improvement_logs` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `type` ENUM('cv', 'application_letter') NOT NULL,
    `used_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ai_improvement_logs_user_id_idx`(`user_id`),
    INDEX `ai_improvement_logs_used_at_idx`(`used_at`),
    INDEX `ai_improvement_logs_user_id_type_used_at_idx`(`user_id`, `type`, `used_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_improvement_logs` ADD CONSTRAINT `ai_improvement_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
