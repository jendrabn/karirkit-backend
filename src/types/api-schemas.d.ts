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

export interface User {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string | null;
  role?: "user" | "admin";
  avatar?: string | null;
  created_at?: string;
  updated_at?: string;
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
    user?: {
      id?: string;
      name?: string;
      username?: string;
      avatar?: string | null;
      headline?: string | null;
    };
    portfolios?: Portfolio[];
  };
}

export interface PublicPortfolioDetailResponse {
  data?: {
    user?: {
      id?: string;
      name?: string;
      username?: string;
      avatar?: string | null;
      headline?: string | null;
    };
    portfolio?: Portfolio;
  };
}

export interface CvEducation {
  degree?:
    | "highschool"
    | "associate"
    | "bachelor"
    | "master"
    | "doctorate"
    | "other";
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

export interface Cv {
  id?: string;
  user_id?: string;
  name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  address?: string;
  about?: string;
  photo?: string | null;
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
}

export interface CvPayload {
  name: string;
  headline: string;
  email: string;
  phone: string;
  address: string;
  about: string;
  photo?: string | null;
  template_id?: string | null;
  language?: "en" | "id";
  educations?: CvEducation[];
  certificates?: CvCertificate[];
  experiences?: CvExperience[];
  skills?: CvSkill[];
  awards?: CvAward[];
  social_links?: CvSocialLink[];
  organizations?: CvOrganization[];
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
  user?: User;
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
