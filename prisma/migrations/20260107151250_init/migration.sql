-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `phone` VARCHAR(255) NULL,
    `headline` VARCHAR(255) NULL,
    `bio` TEXT NULL,
    `location` VARCHAR(255) NULL,
    `gender` ENUM('male', 'female') NULL,
    `birth_date` DATE NULL,
    `google_id` VARCHAR(255) NULL,
    `avatar` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,
    `email_verified_at` TIMESTAMP(0) NULL,
    `daily_download_limit` INTEGER NOT NULL DEFAULT 10,
    `document_storage_limit` INTEGER NOT NULL DEFAULT 104857600,
    `status` ENUM('active', 'suspended', 'banned') NOT NULL DEFAULT 'active',
    `status_reason` TEXT NULL,
    `suspended_until` TIMESTAMP(0) NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cvs` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `template_id` VARCHAR(255) NULL,
    `name` VARCHAR(255) NOT NULL,
    `headline` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(255) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `about` TEXT NOT NULL,
    `photo` VARCHAR(255) NULL,
    `language` ENUM('en', 'id') NOT NULL DEFAULT 'id',
    `slug` VARCHAR(255) NOT NULL,
    `visibility` ENUM('private', 'public') NOT NULL DEFAULT 'private',
    `views` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `uq_cvs_slug`(`slug`),
    INDEX `idx_cvs_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portfolios` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `sort_description` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `role_title` VARCHAR(255) NOT NULL,
    `project_type` ENUM('work', 'freelance', 'personal', 'academic') NOT NULL,
    `industry` VARCHAR(255) NOT NULL,
    `month` TINYINT NOT NULL,
    `year` YEAR NOT NULL,
    `live_url` VARCHAR(255) NULL,
    `repo_url` VARCHAR(255) NULL,
    `cover` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `uq_portfolios_slug`(`slug`),
    INDEX `idx_portfolios_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applications` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `company_name` VARCHAR(255) NOT NULL,
    `company_url` TEXT NULL,
    `position` VARCHAR(255) NOT NULL,
    `job_source` VARCHAR(255) NULL,
    `job_type` ENUM('full_time', 'contract', 'internship', 'freelance', 'part_time') NOT NULL,
    `work_system` ENUM('onsite', 'hybrid', 'remote') NOT NULL,
    `salary_min` BIGINT NULL,
    `salary_max` BIGINT NULL,
    `location` VARCHAR(255) NULL,
    `date` DATE NOT NULL,
    `status` ENUM('draft', 'submitted', 'administration_screening', 'hr_screening', 'online_test', 'psychological_test', 'technical_test', 'hr_interview', 'user_interview', 'final_interview', 'offering', 'mcu', 'onboarding', 'accepted', 'rejected') NOT NULL,
    `result_status` ENUM('pending', 'passed', 'failed') NOT NULL,
    `contact_name` VARCHAR(255) NULL,
    `contact_email` VARCHAR(255) NULL,
    `contact_phone` VARCHAR(255) NULL,
    `follow_up_date` DATE NULL,
    `follow_up_note` TEXT NULL,
    `job_url` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_applications_user_id`(`user_id`),
    INDEX `idx_applications_status`(`status`),
    INDEX `idx_applications_date`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_letters` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `template_id` VARCHAR(255) NULL,
    `name` VARCHAR(255) NOT NULL,
    `birth_place_date` VARCHAR(255) NOT NULL,
    `gender` ENUM('male', 'female') NOT NULL,
    `marital_status` ENUM('single', 'married', 'widowed') NOT NULL,
    `education` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `applicant_city` VARCHAR(255) NOT NULL,
    `application_date` VARCHAR(255) NOT NULL,
    `receiver_title` VARCHAR(255) NOT NULL,
    `company_name` VARCHAR(255) NOT NULL,
    `company_city` VARCHAR(255) NULL,
    `company_address` VARCHAR(255) NULL,
    `opening_paragraph` TEXT NOT NULL,
    `body_paragraph` TEXT NOT NULL,
    `attachments` TEXT NOT NULL,
    `closing_paragraph` TEXT NOT NULL,
    `signature` VARCHAR(255) NOT NULL,
    `language` ENUM('en', 'id') NOT NULL DEFAULT 'id',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_application_letters_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_educations` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `degree` ENUM('middle_school', 'high_school', 'associate_d1', 'associate_d2', 'associate_d3', 'bachelor', 'master', 'doctorate', 'any') NOT NULL,
    `school_name` VARCHAR(255) NOT NULL,
    `school_location` VARCHAR(255) NOT NULL,
    `major` VARCHAR(255) NOT NULL,
    `start_month` TINYINT NOT NULL,
    `start_year` YEAR NOT NULL,
    `end_month` TINYINT NULL,
    `end_year` YEAR NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `gpa` FLOAT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_educations_cv_id`(`cv_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_certificates` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `issuer` VARCHAR(255) NOT NULL,
    `issue_month` TINYINT NOT NULL,
    `issue_year` YEAR NOT NULL,
    `expiry_month` TINYINT NULL,
    `expiry_year` YEAR NULL,
    `no_expiry` BOOLEAN NOT NULL DEFAULT false,
    `credential_id` VARCHAR(255) NULL,
    `credential_url` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_certificates_cv_id`(`cv_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_experiences` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `job_title` VARCHAR(255) NOT NULL,
    `company_name` VARCHAR(255) NOT NULL,
    `company_location` VARCHAR(255) NOT NULL,
    `job_type` ENUM('full_time', 'contract', 'internship', 'freelance', 'part_time') NOT NULL,
    `start_month` TINYINT NOT NULL,
    `start_year` YEAR NOT NULL,
    `end_month` TINYINT NULL,
    `end_year` YEAR NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_experiences_cv_id`(`cv_id`),
    INDEX `idx_cv_experiences_company`(`company_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_skills` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `level` ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL,
    `skill_category` ENUM('software', 'tools', 'hard_skill', 'soft_skill', 'other', 'ms_office', 'google_workspace', 'data_entry', 'administration', 'secretarial', 'document_management', 'archiving', 'scheduling', 'virtual_assistant', 'communication', 'public_speaking', 'presentation', 'negotiation', 'customer_service', 'sales', 'business_development', 'leadership', 'teamwork', 'problem_solving', 'time_management', 'critical_thinking', 'training_facilitation', 'coaching_mentoring', 'language', 'translation', 'interpretation', 'programming_language', 'web_development', 'mobile_development', 'backend_development', 'frontend_development', 'fullstack_development', 'api_development', 'system_design', 'algorithms', 'data_structures', 'version_control', 'code_review', 'refactoring', 'framework_library', 'cms', 'ecommerce_platform', 'data_analysis', 'data_science', 'machine_learning', 'deep_learning', 'nlp', 'computer_vision', 'data_engineering', 'etl_elt', 'business_intelligence', 'statistics', 'experimentation_ab_testing', 'analytics', 'database_sql', 'database_nosql', 'data_warehouse', 'data_lake', 'devops', 'ci_cd', 'containerization', 'orchestration', 'cloud_computing', 'linux', 'networking', 'site_reliability', 'monitoring_observability', 'infrastructure_as_code', 'cybersecurity', 'app_security', 'network_security', 'iam_security', 'vulnerability_management', 'penetration_testing', 'quality_assurance', 'manual_testing', 'automation_testing', 'performance_testing', 'test_management', 'ui_ux_design', 'product_design', 'graphic_design', 'branding', 'illustration', 'video_editing', 'motion_graphics', 'photography', 'copywriting', 'content_writing', 'content_strategy', 'product_management', 'project_management', 'program_management', 'agile_scrum', 'business_analysis', 'process_improvement', 'operations', 'strategy_planning', 'okr_kpi', 'digital_marketing', 'social_media', 'seo', 'sem_ppc', 'email_marketing', 'performance_marketing', 'brand_marketing', 'market_research', 'pr_communications', 'community_management', 'finance', 'accounting', 'bookkeeping', 'taxation', 'budgeting_forecasting', 'financial_analysis', 'audit_compliance', 'human_resources', 'recruitment', 'people_operations', 'payroll', 'learning_development', 'legal', 'contract_management', 'compliance', 'risk_management', 'procurement', 'inventory_management', 'supply_chain', 'logistics', 'warehouse_management', 'shipping_fulfillment', 'healthcare', 'education', 'hospitality', 'retail', 'manufacturing', 'construction') NOT NULL DEFAULT 'other',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_skills_cv_id`(`cv_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_awards` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `issuer` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `year` YEAR NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_awards_cv_id`(`cv_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_social_links` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `platform` ENUM('linkedin', 'website', 'blog', 'portfolio', 'github', 'gitlab', 'bitbucket', 'stackoverflow', 'devto', 'hashnode', 'medium', 'leetcode', 'hackerrank', 'codewars', 'topcoder', 'kaggle', 'behance', 'dribbble', 'figma', 'adobe_portfolio', 'artstation', 'youtube', 'vimeo', 'tiktok', 'twitch', 'x', 'instagram', 'facebook', 'threads', 'discord', 'telegram', 'whatsapp', 'line', 'wechat', 'skype', 'google_scholar', 'orcid', 'researchgate', 'arxiv') NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_social_links_cv_id`(`cv_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_organizations` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `organization_name` VARCHAR(255) NOT NULL,
    `role_title` VARCHAR(255) NOT NULL,
    `organization_type` ENUM('student', 'community', 'professional', 'volunteer', 'other') NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `start_month` TINYINT NOT NULL,
    `start_year` YEAR NOT NULL,
    `end_month` TINYINT NULL,
    `end_year` YEAR NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_organizations_cv_id`(`cv_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_projects` (
    `id` VARCHAR(255) NOT NULL,
    `cv_id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `year` YEAR NOT NULL,
    `repo_url` VARCHAR(255) NULL,
    `live_url` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_cv_projects_cv_id`(`cv_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portfolio_medias` (
    `id` VARCHAR(255) NOT NULL,
    `portfolio_id` VARCHAR(255) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `caption` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_portfolio_medias_portfolio_id`(`portfolio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portfolio_tools` (
    `id` VARCHAR(255) NOT NULL,
    `portfolio_id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_portfolio_tools_portfolio_id`(`portfolio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_categories` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `blog_categories_name_key`(`name`),
    UNIQUE INDEX `blog_categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_tags` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `blog_tags_name_key`(`name`),
    UNIQUE INDEX `blog_tags_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blogs` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `category_id` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `excerpt` TEXT NULL,
    `content` TEXT NOT NULL,
    `featured_image` VARCHAR(255) NULL,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `read_time` INTEGER NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,
    `published_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `blogs_slug_key`(`slug`),
    INDEX `idx_blogs_user_id`(`user_id`),
    INDEX `idx_blogs_category_id`(`category_id`),
    INDEX `idx_blogs_status`(`status`),
    INDEX `idx_blogs_published_at`(`published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_tag_relations` (
    `id` VARCHAR(255) NOT NULL,
    `blog_id` VARCHAR(255) NOT NULL,
    `tag_id` VARCHAR(255) NOT NULL,

    INDEX `idx_blog_tag_relation_blog_id`(`blog_id`),
    INDEX `idx_blog_tag_relation_tag_id`(`tag_id`),
    UNIQUE INDEX `uq_blog_tag_relation`(`blog_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `templates` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('cv', 'application_letter') NOT NULL,
    `language` ENUM('en', 'id') NOT NULL DEFAULT 'en',
    `path` VARCHAR(255) NOT NULL,
    `preview` VARCHAR(255) NULL,
    `is_premium` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otps` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `code` VARCHAR(10) NOT NULL,
    `purpose` ENUM('login_verification') NOT NULL DEFAULT 'login_verification',
    `expires_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_otps_user_id`(`user_id`),
    INDEX `idx_otps_code`(`code`),
    INDEX `idx_otps_expires_at`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provinces` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cities` (
    `id` VARCHAR(255) NOT NULL,
    `province_id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,

    INDEX `idx_cities_province_id`(`province_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `logo` VARCHAR(255) NULL,
    `employee_size` ENUM('one_to_ten', 'eleven_to_fifty', 'fifty_one_to_two_hundred', 'two_hundred_one_to_five_hundred', 'five_hundred_plus') NULL,
    `business_sector` VARCHAR(255) NULL,
    `website_url` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `companies_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_roles` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `job_roles_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` VARCHAR(255) NOT NULL,
    `company_id` VARCHAR(255) NOT NULL,
    `job_role_id` VARCHAR(255) NOT NULL,
    `city_id` VARCHAR(255) NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `job_type` ENUM('full_time', 'contract', 'internship', 'freelance', 'part_time') NOT NULL,
    `work_system` ENUM('onsite', 'hybrid', 'remote') NOT NULL,
    `education_level` ENUM('middle_school', 'high_school', 'associate_d1', 'associate_d2', 'associate_d3', 'bachelor', 'master', 'doctorate', 'any') NOT NULL,
    `min_years_of_experience` TINYINT NOT NULL,
    `max_years_of_experience` TINYINT NULL,
    `description` TEXT NOT NULL,
    `requirements` TEXT NOT NULL,
    `salary_min` BIGINT NULL,
    `salary_max` BIGINT NULL,
    `talent_quota` TINYINT NULL,
    `job_url` TEXT NULL,
    `contact_name` VARCHAR(255) NULL,
    `contact_email` VARCHAR(255) NULL,
    `contact_phone` VARCHAR(255) NULL,
    `status` ENUM('draft', 'published', 'closed', 'archived') NOT NULL DEFAULT 'draft',
    `expiration_date` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `jobs_slug_key`(`slug`),
    INDEX `idx_jobs_company_id`(`company_id`),
    INDEX `idx_jobs_job_role_id`(`job_role_id`),
    INDEX `idx_jobs_city_id`(`city_id`),
    INDEX `idx_jobs_status`(`status`),
    INDEX `idx_jobs_job_type`(`job_type`),
    INDEX `idx_jobs_work_system`(`work_system`),
    INDEX `idx_jobs_education_level`(`education_level`),
    INDEX `idx_jobs_salary_min`(`salary_min`),
    INDEX `idx_jobs_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_medias` (
    `id` VARCHAR(255) NOT NULL,
    `job_id` VARCHAR(255) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_job_medias_job_id`(`job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_logs` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `type` ENUM('cv', 'application_letter') NOT NULL,
    `document_id` VARCHAR(255) NOT NULL,
    `document_name` VARCHAR(255) NOT NULL,
    `downloaded_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `download_logs_user_id_idx`(`user_id`),
    INDEX `download_logs_downloaded_at_idx`(`downloaded_at`),
    INDEX `download_logs_user_id_downloaded_at_idx`(`user_id`, `downloaded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `type` ENUM('ktp', 'kk', 'sim', 'paspor', 'npwp', 'bpjs_kesehatan', 'bpjs_ketenagakerjaan', 'ijazah', 'transkrip', 'kartu_pelajar', 'kartu_mahasiswa', 'pas_foto', 'cv', 'surat_lamaran', 'portfolio', 'cover_letter', 'skck', 'surat_keterangan_sehat', 'surat_keterangan_kerja', 'surat_pengalaman_kerja', 'surat_rekomendasi', 'paklaring', 'surat_pengunduran_diri', 'kontrak_kerja', 'slip_gaji', 'kartu_nama', 'sertifikat', 'sertifikat_pelatihan', 'sertifikat_bahasa', 'sertifikat_profesi', 'sertifikat_vaksin', 'surat_bebas_narkoba', 'surat_domisili', 'surat_keterangan_catatan_akademik', 'surat_keterangan_lulus', 'kartu_keluarga_sejahtera', 'hasil_medical_checkup', 'hasil_tes_psikologi', 'hasil_tes_narkoba', 'demo_reel', 'karya_tulis', 'publikasi', 'piagam', 'lainnya') NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `size` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_documents_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_social_links` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `platform` ENUM('linkedin', 'website', 'blog', 'portfolio', 'github', 'gitlab', 'bitbucket', 'stackoverflow', 'devto', 'hashnode', 'medium', 'leetcode', 'hackerrank', 'codewars', 'topcoder', 'kaggle', 'behance', 'dribbble', 'figma', 'adobe_portfolio', 'artstation', 'youtube', 'vimeo', 'tiktok', 'twitch', 'x', 'instagram', 'facebook', 'threads', 'discord', 'telegram', 'whatsapp', 'line', 'wechat', 'skype', 'google_scholar', 'orcid', 'researchgate', 'arxiv') NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_user_social_links_user_id`(`user_id`),
    INDEX `idx_user_social_links_platform`(`platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cvs` ADD CONSTRAINT `cvs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cvs` ADD CONSTRAINT `cvs_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portfolios` ADD CONSTRAINT `portfolios_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_letters` ADD CONSTRAINT `application_letters_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_letters` ADD CONSTRAINT `application_letters_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_educations` ADD CONSTRAINT `cv_educations_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_certificates` ADD CONSTRAINT `cv_certificates_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_experiences` ADD CONSTRAINT `cv_experiences_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_skills` ADD CONSTRAINT `cv_skills_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_awards` ADD CONSTRAINT `cv_awards_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_social_links` ADD CONSTRAINT `cv_social_links_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_organizations` ADD CONSTRAINT `cv_organizations_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cv_projects` ADD CONSTRAINT `cv_projects_cv_id_fkey` FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portfolio_medias` ADD CONSTRAINT `portfolio_medias_portfolio_id_fkey` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portfolio_tools` ADD CONSTRAINT `portfolio_tools_portfolio_id_fkey` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blogs` ADD CONSTRAINT `blogs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blogs` ADD CONSTRAINT `blogs_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `blog_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blog_tag_relations` ADD CONSTRAINT `blog_tag_relations_blog_id_fkey` FOREIGN KEY (`blog_id`) REFERENCES `blogs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blog_tag_relations` ADD CONSTRAINT `blog_tag_relations_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `blog_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otps` ADD CONSTRAINT `otps_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_job_role_id_fkey` FOREIGN KEY (`job_role_id`) REFERENCES `job_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_medias` ADD CONSTRAINT `job_medias_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_logs` ADD CONSTRAINT `download_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_social_links` ADD CONSTRAINT `user_social_links_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
