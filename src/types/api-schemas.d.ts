// Auto-generated from openapi.yaml. Do not edit manually.

export interface ErrorResponse {
  errors?: {
    [key: string]: string[];
  };
}

export interface MessageResponse {
  data?: {
    message?: string;
  };
}

export interface DownloadUrlResponse {
  data?: {
    download_url?: string;
  };
}

export interface PreviewUrlResponse {
  data?: {
    preview_url?: string;
  };
}

export interface Pagination {
  page?: number;
  per_page?: number;
  total_items?: number;
  total_pages?: number;
}

export interface DownloadStats {
  daily_limit?: number;
  today_count?: number;
  remaining?: number;
  total_count?: number;
}

export interface DocumentStorageStats {
  limit?: number;
  used?: number;
  remaining?: number;
}

export interface User {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  gender?: "male" | "female" | null;
  birth_date?: string | null;
  role?: "user" | "admin";
  avatar?: string | null;
  created_at?: string;
  updated_at?: string;
  email_verified_at?: string | null;
  download_stats?: DownloadStats;
  daily_download_limit?: number;
  document_storage_limit?: number;
  document_storage_stats?: DocumentStorageStats;
  social_links?: UserSocialLink[];
  status?: "active" | "suspended" | "banned";
  status_reason?: string | null;
  suspended_until?: string | null;
}

export interface RegisterRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  phone?: string | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface GoogleLoginRequest {
  id_token: string;
}

export interface UpdateMeRequest {
  name?: string;
  username?: string;
  email?: string;
  phone?: string | null;
  avatar?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  gender?: "male" | "female" | null;
  birth_date?: string | null;
  social_links?: {
    id?: string | null;
    platform: string;
    url: string;
  }[];
}

export interface UserSocialLink {
  id?: string;
  user_id?: string;
  platform?: string;
  url?: string;
}

export interface PublicUserProfile {
  id?: string;
  name?: string;
  username?: string;
  avatar?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  social_links?: UserSocialLink[];
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export type JobType =
  | "full_time"
  | "contract"
  | "internship"
  | "freelance"
  | "part_time";

export type WorkSystem = "onsite" | "hybrid" | "remote";

export interface Application {
  id?: string;
  user_id?: string;
  company_name?: string;
  company_url?: string | null;
  position?: string;
  job_source?: string | null;
  job_type?: JobType;
  work_system?: WorkSystem;
  salary_min?: number;
  salary_max?: number;
  location?: string | null;
  date?: string;
  status?: string;
  result_status?: "pending" | "passed" | "failed";
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  follow_up_date?: string | null;
  follow_up_note?: string | null;
  job_url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApplicationPayload {
  company_name: string;
  company_url?: string | null;
  position: string;
  job_source?: string | null;
  job_type: JobType;
  work_system: WorkSystem;
  salary_min?: number;
  salary_max?: number;
  location?: string | null;
  date: string;
  status: string;
  result_status: "pending" | "passed" | "failed";
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  follow_up_date?: string | null;
  follow_up_note?: string | null;
  job_url?: string | null;
  notes?: string | null;
}

export interface ApplicationResponse {
  data?: Application;
}

export interface ApplicationListResponse {
  data?: {
    items?: Application[];
    pagination?: Pagination;
  };
}

export interface ApplicationLetter {
  id?: string;
  user_id?: string;
  name?: string;
  birth_place_date?: string;
  gender?: "male" | "female";
  marital_status?: "single" | "married" | "widowed";
  education?: string;
  phone?: string;
  email?: string;
  address?: string;
  subject?: string;
  applicant_city?: string;
  application_date?: string;
  receiver_title?: string;
  company_name?: string;
  company_city?: string | null;
  company_address?: string | null;
  opening_paragraph?: string;
  body_paragraph?: string;
  attachments?: string;
  closing_paragraph?: string;
  signature?: string | null;
  template_id?: string | null;
  language?: "en" | "id";
  template?: {
    id?: string;
    name?: string;
    path?: string;
    type?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApplicationLetterPayload {
  name: string;
  birth_place_date: string;
  gender: "male" | "female";
  marital_status: "single" | "married" | "widowed";
  education: string;
  phone: string;
  email: string;
  address: string;
  subject: string;
  applicant_city: string;
  application_date: string;
  receiver_title: string;
  company_name: string;
  company_city?: string | null;
  company_address?: string | null;
  opening_paragraph: string;
  body_paragraph: string;
  attachments: string;
  closing_paragraph: string;
  signature?: string | null;
  template_id?: string | null;
  language?: "en" | "id";
}

export interface ApplicationLetterResponse {
  data?: ApplicationLetter;
}

export interface ApplicationLetterListResponse {
  data?: {
    items?: ApplicationLetter[];
    pagination?: Pagination;
  };
}

export type DocumentType =
  | "ktp"
  | "kk"
  | "sim"
  | "paspor"
  | "npwp"
  | "bpjs_kesehatan"
  | "bpjs_ketenagakerjaan"
  | "ijazah"
  | "transkrip"
  | "kartu_pelajar"
  | "kartu_mahasiswa"
  | "pas_foto"
  | "cv"
  | "surat_lamaran"
  | "portfolio"
  | "cover_letter"
  | "skck"
  | "surat_keterangan_sehat"
  | "surat_keterangan_kerja"
  | "surat_pengalaman_kerja"
  | "surat_rekomendasi"
  | "paklaring"
  | "surat_pengunduran_diri"
  | "kontrak_kerja"
  | "slip_gaji"
  | "kartu_nama"
  | "sertifikat"
  | "sertifikat_pelatihan"
  | "sertifikat_bahasa"
  | "sertifikat_profesi"
  | "sertifikat_vaksin"
  | "surat_bebas_narkoba"
  | "surat_domisili"
  | "surat_keterangan_catatan_akademik"
  | "surat_keterangan_lulus"
  | "kartu_keluarga_sejahtera"
  | "hasil_medical_checkup"
  | "hasil_tes_psikologi"
  | "hasil_tes_narkoba"
  | "demo_reel"
  | "karya_tulis"
  | "publikasi"
  | "piagam"
  | "lainnya";

export interface Document {
  id?: string;
  user_id?: string;
  type?: DocumentType;
  original_name?: string;
  path?: string;
  mime_type?: string;
  size?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentResponse {
  data?: Document;
}

export interface DocumentListResponse {
  data?: {
    items?: Document[];
    pagination?: Pagination;
  };
}

export interface DocumentUploadRequest {
  type: DocumentType;
  file?: string;
}

export interface DocumentMassDeleteRequest {
  ids: string[];
}

export interface DocumentMassDeleteResponse {
  data?: {
    message?: string;
    deleted_count?: number;
  };
}

export interface PortfolioMedia {
  id?: string;
  portfolio_id?: string;
  path?: string;
  caption?: string | null;
}

export interface PortfolioTool {
  id?: string;
  portfolio_id?: string;
  name?: string;
}

export type ProjectType = "work" | "freelance" | "personal" | "academic";

export interface Portfolio {
  id?: string;
  user_id?: string;
  title?: string;
  slug?: string;
  sort_description?: string;
  description?: string;
  role_title?: string;
  project_type?: ProjectType;
  industry?: string;
  month?: number;
  year?: number;
  live_url?: string | null;
  repo_url?: string | null;
  cover?: string;
  created_at?: string;
  updated_at?: string;
  medias?: PortfolioMedia[];
  tools?: PortfolioTool[];
}

export interface PortfolioPayload {
  title: string;

  sort_description: string;
  description: string;
  role_title: string;
  project_type: ProjectType;
  industry: string;
  month: number;
  year: number;
  live_url?: string | null;
  repo_url?: string | null;
  cover?: string;
  tools?: string[];
  medias?: {
    path?: string;
    caption?: string | null;
  }[];
}

export interface PortfolioResponse {
  data?: Portfolio;
}

export interface PortfolioListResponse {
  data?: {
    items?: Portfolio[];
    pagination?: Pagination;
  };
}

export interface PublicPortfolioResponse {
  data?: {
    user?: PublicUserProfile;
    portfolios?: Portfolio[];
  };
}

export interface PublicPortfolioDetailResponse {
  data?: {
    user?: PublicUserProfile;
    portfolio?: Portfolio;
  };
}

export interface CvEducation {
  degree?:
    | "middle_school"
    | "high_school"
    | "associate_d1"
    | "associate_d2"
    | "associate_d3"
    | "bachelor"
    | "master"
    | "doctorate"
    | "any";
  school_name?: string;
  school_location?: string;
  major?: string;
  start_month?: number;
  start_year?: number;
  end_month?: number | null;
  end_year?: number | null;
  is_current?: boolean;
  gpa?: number | null;
  description?: string | null;
}

export interface CvCertificate {
  title?: string;
  issuer?: string;
  issue_month?: number;
  issue_year?: number;
  expiry_month?: number | null;
  expiry_year?: number | null;
  no_expiry?: boolean | null;
  credential_id?: string | null;
  credential_url?: string | null;
  description?: string | null;
}

export interface CvExperience {
  job_title?: string;
  company_name?: string;
  company_location?: string;
  job_type?: JobType;
  start_month?: number;
  start_year?: number;
  end_month?: number | null;
  end_year?: number | null;
  is_current?: boolean;
  description?: string | null;
}

export interface CvSkill {
  name?: string;
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  skill_category?: SkillCategory;
}

export interface CvAward {
  title?: string;
  issuer?: string;
  description?: string | null;
  year?: number;
}

export interface CvSocialLink {
  platform?: string;
  url?: string;
}

export type SkillCategory =
  | "software"
  | "tools"
  | "hard_skill"
  | "soft_skill"
  | "other"
  | "ms_office"
  | "google_workspace"
  | "data_entry"
  | "administration"
  | "secretarial"
  | "document_management"
  | "archiving"
  | "scheduling"
  | "virtual_assistant"
  | "communication"
  | "public_speaking"
  | "presentation"
  | "negotiation"
  | "customer_service"
  | "sales"
  | "business_development"
  | "leadership"
  | "teamwork"
  | "problem_solving"
  | "time_management"
  | "critical_thinking"
  | "training_facilitation"
  | "coaching_mentoring"
  | "language"
  | "translation"
  | "interpretation"
  | "programming_language"
  | "web_development"
  | "mobile_development"
  | "backend_development"
  | "frontend_development"
  | "fullstack_development"
  | "api_development"
  | "system_design"
  | "algorithms"
  | "data_structures"
  | "version_control"
  | "code_review"
  | "refactoring"
  | "framework_library"
  | "cms"
  | "ecommerce_platform"
  | "data_analysis"
  | "data_science"
  | "machine_learning"
  | "deep_learning"
  | "nlp"
  | "computer_vision"
  | "data_engineering"
  | "etl_elt"
  | "business_intelligence"
  | "statistics"
  | "experimentation_ab_testing"
  | "analytics"
  | "database_sql"
  | "database_nosql"
  | "data_warehouse"
  | "data_lake"
  | "devops"
  | "ci_cd"
  | "containerization"
  | "orchestration"
  | "cloud_computing"
  | "linux"
  | "networking"
  | "site_reliability"
  | "monitoring_observability"
  | "infrastructure_as_code"
  | "cybersecurity"
  | "app_security"
  | "network_security"
  | "iam_security"
  | "vulnerability_management"
  | "penetration_testing"
  | "quality_assurance"
  | "manual_testing"
  | "automation_testing"
  | "performance_testing"
  | "test_management"
  | "ui_ux_design"
  | "product_design"
  | "graphic_design"
  | "branding"
  | "illustration"
  | "video_editing"
  | "motion_graphics"
  | "photography"
  | "copywriting"
  | "content_writing"
  | "content_strategy"
  | "product_management"
  | "project_management"
  | "program_management"
  | "agile_scrum"
  | "business_analysis"
  | "process_improvement"
  | "operations"
  | "strategy_planning"
  | "okr_kpi"
  | "digital_marketing"
  | "social_media"
  | "seo"
  | "sem_ppc"
  | "email_marketing"
  | "performance_marketing"
  | "brand_marketing"
  | "market_research"
  | "pr_communications"
  | "community_management"
  | "finance"
  | "accounting"
  | "bookkeeping"
  | "taxation"
  | "budgeting_forecasting"
  | "financial_analysis"
  | "audit_compliance"
  | "human_resources"
  | "recruitment"
  | "people_operations"
  | "payroll"
  | "learning_development"
  | "legal"
  | "contract_management"
  | "compliance"
  | "risk_management"
  | "procurement"
  | "inventory_management"
  | "supply_chain"
  | "logistics"
  | "warehouse_management"
  | "shipping_fulfillment"
  | "healthcare"
  | "education"
  | "hospitality"
  | "retail"
  | "manufacturing"
  | "construction";

export interface CvOrganization {
  organization_name?: string;
  role_title?: string;
  organization_type?:
    | "student"
    | "community"
    | "professional"
    | "volunteer"
    | "other";
  location?: string;
  start_month?: number;
  start_year?: number;
  end_month?: number | null;
  end_year?: number | null;
  is_current?: boolean;
  description?: string | null;
}

export interface CvProject {
  name?: string;
  description?: string | null;
  year?: number;
  repo_url?: string | null;
  live_url?: string | null;
}

export type CvVisibility = "private" | "public";

export interface Cv {
  id?: string;
  user_id?: string;
  slug?: string;
  name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  address?: string;
  about?: string;
  photo?: string | null;
  visibility?: CvVisibility;
  views?: number;
  template_id?: string | null;
  language?: "en" | "id";
  template?: {
    id?: string;
    name?: string;
    path?: string;
    type?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
  educations?: CvEducation[];
  certificates?: CvCertificate[];
  experiences?: CvExperience[];
  skills?: CvSkill[];
  awards?: CvAward[];
  social_links?: CvSocialLink[];
  organizations?: CvOrganization[];
  projects?: CvProject[];
}

export interface CvPayload {
  name: string;
  headline: string;
  email: string;
  phone: string;
  address: string;
  about: string;
  photo?: string | null;
  slug?: string;
  visibility?: CvVisibility;
  template_id?: string | null;
  language?: "en" | "id";
  educations?: CvEducation[];
  certificates?: CvCertificate[];
  experiences?: CvExperience[];
  skills?: CvSkill[];
  awards?: CvAward[];
  social_links?: CvSocialLink[];
  organizations?: CvOrganization[];
  projects?: CvProject[];
}

export interface CvResponse {
  data?: Cv;
}

export interface CvListResponse {
  data?: {
    items?: Cv[];
    pagination?: Pagination;
  };
}

export interface UserResponse {
  data?: User;
}

export interface AuthUserResponse {
  data?: User;
}

export type BlogStatus = "draft" | "published" | "archived";

export interface BlogCategory {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  blog_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BlogCategoryPayload {
  name: string;

  description?: string | null;
}

export interface BlogCategoryResponse {
  data?: BlogCategory;
}

export interface BlogCategoryListResponse {
  data?: {
    items?: BlogCategory[];
    pagination?: Pagination;
  };
}

export interface BlogTag {
  id?: string;
  name?: string;
  slug?: string;
  blog_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BlogTagPayload {
  name: string;
}

export interface BlogTagResponse {
  data?: BlogTag;
}

export interface BlogTagListResponse {
  data?: {
    items?: BlogTag[];
    pagination?: Pagination;
  };
}

export interface Blog {
  id?: string;
  user_id?: string;
  category_id?: string;
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  featured_image?: string | null;
  status?: BlogStatus;
  read_time?: number | null;
  views?: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
  user?: PublicUserProfile;
  category?: BlogCategory | null;
  tags?: BlogTag[];
}

export interface BlogPayload {
  title: string;

  excerpt?: string | null;
  content: string;
  featured_image?: string | null;
  status: BlogStatus;

  category_id: string;
  tag_ids?: string[];
}

export interface BlogResponse {
  data?: Blog;
}

export interface BlogListResponse {
  data?: {
    items?: Blog[];
    pagination?: Pagination;
  };
}
