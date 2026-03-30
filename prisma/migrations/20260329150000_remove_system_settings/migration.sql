-- DropForeignKey
ALTER TABLE `system_settings` DROP FOREIGN KEY `system_settings_updated_by_fkey`;

-- DropTable
DROP TABLE `system_settings`;
