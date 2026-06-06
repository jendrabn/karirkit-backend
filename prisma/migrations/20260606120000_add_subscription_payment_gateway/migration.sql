ALTER TABLE `subscriptions`
    ADD COLUMN `gateway` ENUM('manual', 'midtrans') NOT NULL DEFAULT 'midtrans',
    ADD COLUMN `pending_key` VARCHAR(255) NULL;

UPDATE `subscriptions`
SET `gateway` = 'manual'
WHERE `midtrans_order_id` LIKE 'MANUAL-%';

UPDATE `subscriptions` AS `older`
INNER JOIN `subscriptions` AS `newer`
    ON `newer`.`user_id` = `older`.`user_id`
    AND `newer`.`status` = 'pending'
    AND (
        `newer`.`created_at` > `older`.`created_at`
        OR (
            `newer`.`created_at` = `older`.`created_at`
            AND `newer`.`id` > `older`.`id`
        )
    )
SET
    `older`.`status` = 'cancelled',
    `older`.`updated_at` = CURRENT_TIMESTAMP
WHERE `older`.`status` = 'pending';

UPDATE `subscriptions`
SET `pending_key` = `user_id`
WHERE `status` = 'pending';

CREATE UNIQUE INDEX `subscriptions_pending_key_key`
    ON `subscriptions`(`pending_key`);
CREATE INDEX `subscriptions_gateway_idx`
    ON `subscriptions`(`gateway`);
