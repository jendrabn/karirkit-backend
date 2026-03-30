ALTER TABLE `users`
    MODIFY `daily_download_limit` INTEGER NOT NULL DEFAULT 3,
    MODIFY `document_storage_limit` INTEGER NOT NULL DEFAULT 52428800,
    ADD COLUMN `subscription_plan` ENUM('free', 'pro', 'max') NOT NULL DEFAULT 'free',
    ADD COLUMN `subscription_expires_at` TIMESTAMP(0) NULL,
    ADD COLUMN `max_cvs` INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN `max_application_letters` INTEGER NOT NULL DEFAULT 2;

CREATE TABLE `subscriptions` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `plan` ENUM('free', 'pro', 'max') NOT NULL,
    `status` ENUM('pending', 'paid', 'expired', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    `midtrans_order_id` VARCHAR(255) NOT NULL,
    `midtrans_token` VARCHAR(500) NULL,
    `midtrans_payment_type` VARCHAR(100) NULL,
    `amount` INTEGER NOT NULL,
    `paid_at` TIMESTAMP(0) NULL,
    `expires_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `subscriptions_midtrans_order_id_key`(`midtrans_order_id`),
    INDEX `subscriptions_user_id_idx`(`user_id`),
    INDEX `subscriptions_status_idx`(`status`),
    INDEX `subscriptions_midtrans_order_id_idx`(`midtrans_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `subscriptions`
    ADD CONSTRAINT `subscriptions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;
