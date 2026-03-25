-- CreateTable
CREATE TABLE `system_settings` (
    `id` VARCHAR(255) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `group` VARCHAR(100) NOT NULL,
    `type` ENUM('boolean', 'number', 'string', 'json') NOT NULL,
    `value_json` JSON NOT NULL,
    `default_value_json` JSON NOT NULL,
    `description` TEXT NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `is_editable` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `system_settings_key_key`(`key`),
    INDEX `idx_system_settings_group`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_setting_logs` (
    `id` VARCHAR(255) NOT NULL,
    `setting_key` VARCHAR(255) NOT NULL,
    `old_value_json` JSON NULL,
    `new_value_json` JSON NOT NULL,
    `changed_by` VARCHAR(255) NULL,
    `reason` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_system_setting_logs_setting_key`(`setting_key`),
    INDEX `idx_system_setting_logs_changed_by`(`changed_by`),
    INDEX `idx_system_setting_logs_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_setting_logs` ADD CONSTRAINT `system_setting_logs_setting_key_fkey` FOREIGN KEY (`setting_key`) REFERENCES `system_settings`(`key`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_setting_logs` ADD CONSTRAINT `system_setting_logs_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
