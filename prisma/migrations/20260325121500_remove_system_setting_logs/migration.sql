-- DropForeignKey
ALTER TABLE `system_setting_logs` DROP FOREIGN KEY `system_setting_logs_setting_key_fkey`;

-- DropForeignKey
ALTER TABLE `system_setting_logs` DROP FOREIGN KEY `system_setting_logs_changed_by_fkey`;

-- DropTable
DROP TABLE `system_setting_logs`;
