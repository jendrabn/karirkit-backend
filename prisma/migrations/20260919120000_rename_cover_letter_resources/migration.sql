-- Rename the existing table in place so all rows and primary keys are preserved.
RENAME TABLE `application_letters` TO `cover_letters`;

-- Recreate the foreign keys with terminology matching the renamed table.
ALTER TABLE `cover_letters`
    DROP FOREIGN KEY `application_letters_user_id_fkey`,
    DROP FOREIGN KEY `application_letters_template_id_fkey`;

ALTER TABLE `cover_letters`
    RENAME INDEX `idx_application_letters_user_id` TO `idx_cover_letters_user_id`,
    RENAME INDEX `application_letters_template_id_fkey` TO `cover_letters_template_id_fkey`;

ALTER TABLE `cover_letters`
    ADD CONSTRAINT `cover_letters_user_id_fkey`
        FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `cover_letters_template_id_fkey`
        FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Temporarily allow both values, then convert existing rows before removing
-- the legacy enum value.
ALTER TABLE `templates`
    MODIFY COLUMN `type` ENUM('cv', 'application_letter', 'cover_letter') NOT NULL;

UPDATE `templates`
SET `type` = 'cover_letter'
WHERE `type` = 'application_letter';

ALTER TABLE `templates`
    MODIFY COLUMN `type` ENUM('cv', 'cover_letter') NOT NULL;

-- Temporarily allow both values, then convert existing rows before removing
-- the legacy enum values.
ALTER TABLE `usage_logs`
    MODIFY COLUMN `feature` ENUM(
        'cv_download_pdf',
        'cv_download_docx',
        'app_letter_download_pdf',
        'app_letter_download_docx',
        'cover_letter_download_pdf',
        'cover_letter_download_docx',
        'ai_improve_cv',
        'ai_improve_app_letter',
        'ai_improve_cover_letter'
    ) NOT NULL;

UPDATE `usage_logs`
SET `feature` = CASE `feature`
    WHEN 'app_letter_download_pdf' THEN 'cover_letter_download_pdf'
    WHEN 'app_letter_download_docx' THEN 'cover_letter_download_docx'
    WHEN 'ai_improve_app_letter' THEN 'ai_improve_cover_letter'
    ELSE `feature`
END
WHERE `feature` IN (
    'app_letter_download_pdf',
    'app_letter_download_docx',
    'ai_improve_app_letter'
);

ALTER TABLE `usage_logs`
    MODIFY COLUMN `feature` ENUM(
        'cv_download_pdf',
        'cv_download_docx',
        'cover_letter_download_pdf',
        'cover_letter_download_docx',
        'ai_improve_cv',
        'ai_improve_cover_letter'
    ) NOT NULL;
