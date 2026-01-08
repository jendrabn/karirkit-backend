// Types for job portal API

export type EmployeeSize =
  | "one_to_ten"
  | "eleven_to_fifty"
  | "fifty_one_to_two_hundred"
  | "two_hundred_one_to_five_hundred"
  | "five_hundred_plus";

export type JobStatus = "draft" | "published" | "closed" | "archived";

export type EducationLevel =
  | "middle_school"
  | "high_school"
  | "associate_d1"
  | "associate_d2"
  | "associate_d3"
  | "bachelor"
  | "master"
  | "doctorate"
  | "any";

export interface Company {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  logo?: string | null;
  employee_size?: EmployeeSize | null;
  business_sector?: string | null;
  website_url?: string | null;
  created_at?: string;
  updated_at?: string;
  job_count?: number;
}

export interface CompanyResponse {
  data?: Company;
}

export interface CompanyListResponse {
  items?: Company[];
  pagination?: {
    page?: number;
    per_page?: number;
    total_items?: number;
    total_pages?: number;
  };
}

export interface CompanyListQueryParams {
  page?: number;
  per_page?: number;
  q?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  business_sector?: string;
  employee_size?: EmployeeSize;
}

export interface CreateCompanyRequest {
  name: string;

  description?: string | null;
  logo?: string | null;
  employee_size?: EmployeeSize | null;
  business_sector?: string | null;
  website_url?: string | null;
}

export interface UpdateCompanyRequest {
  name?: string;

  description?: string | null;
  logo?: string | null;
  employee_size?: EmployeeSize | null;
  business_sector?: string | null;
  website_url?: string | null;
}

export interface JobRole {
  id?: string;
  name?: string;
  slug?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JobRoleResponse {
  data?: JobRole;
}

export interface JobRoleListResponse {
  items?: JobRole[];
  pagination?: {
    page?: number;
    per_page?: number;
    total_items?: number;
    total_pages?: number;
  };
}

export interface JobRoleListQueryParams {
  page?: number;
  per_page?: number;
  q?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface CreateJobRoleRequest {
  name: string;
}

export interface UpdateJobRoleRequest {
  name?: string;
}

export interface City {
  id?: string;
  province_id?: string;
  name?: string;
  province?: {
    id?: string;
    name?: string;
  };
  job_count?: number;
}

export interface CityResponse {
  data?: City;
}

export interface CityListResponse {
  items?: City[];
  pagination?: {
    page?: number;
    per_page?: number;
    total_items?: number;
    total_pages?: number;
  };
}

export interface CityListQueryParams {
  page?: number;
  per_page?: number;
  q?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  province_id?: string;
}

export interface JobMedia {
  id?: string;
  job_id?: string;
  path?: string;
}

export interface Job {
  id?: string;
  company_id?: string;
  job_role_id?: string;
  city_id?: string | null;
  title?: string;
  slug?: string;
  job_type?:
    | "full_time"
    | "part_time"
    | "contract"
    | "internship"
    | "freelance";
  work_system?: "onsite" | "hybrid" | "remote";
  education_level?: EducationLevel;
  min_years_of_experience?: number;
  max_years_of_experience?: number | null;
  description?: string;
  requirements?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  talent_quota?: number | null;
  job_url?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  medias?: JobMedia[];
  status?: JobStatus;
  expiration_date?: string | null;
  created_at?: string;
  updated_at?: string;
  company?: Company;
  job_role?: JobRole;
  city?: City;
  is_saved?: boolean;
}

export interface JobResponse {
  data?: Job;
}

export interface JobListResponse {
  items?: Job[];
  pagination?: {
    page?: number;
    per_page?: number;
    total_items?: number;
    total_pages?: number;
  };
}

export interface SavedJobToggleRequest {
  id: string;
}

export interface SavedJobMassDeleteRequest {
  ids: string[];
}

export interface SavedJobMassDeleteResponse {
  message?: string;
  deleted_count?: number;
}

export interface JobListQueryParams {
  page?: number;
  per_page?: number;
  q?: string;
  company_id?: string;
  job_role_id?: string;
  city_id?: string;
  province_id?: string;
  job_type?:
    | "full_time"
    | "part_time"
    | "contract"
    | "internship"
    | "freelance";
  work_system?: "onsite" | "hybrid" | "remote";
  education_level?: EducationLevel;
  experience_min?: number;
  salary_min?: number;
  sort?: string;
  sort_order?: "asc" | "desc";
  status?: JobStatus;
}

export interface CreateJobRequest {
  company_id: string;
  job_role_id: string;
  city_id?: string | null;
  title: string;

  job_type: "full_time" | "part_time" | "contract" | "internship" | "freelance";
  work_system: "onsite" | "hybrid" | "remote";
  education_level: EducationLevel;
  min_years_of_experience: number;
  max_years_of_experience?: number | null;
  description: string;
  requirements: string;
  salary_min?: number | null;
  salary_max?: number | null;
  talent_quota?: number | null;
  job_url?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  medias?: {
    path?: string;
  }[];
  status?: JobStatus;
  expiration_date?: string | null;
}

export interface UpdateJobRequest {
  company_id?: string;
  job_role_id?: string;
  city_id?: string | null;
  title?: string;

  job_type?:
    | "full_time"
    | "part_time"
    | "contract"
    | "internship"
    | "freelance";
  work_system?: "onsite" | "hybrid" | "remote";
  education_level?: EducationLevel;
  min_years_of_experience?: number;
  max_years_of_experience?: number | null;
  description?: string;
  requirements?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  talent_quota?: number | null;
  job_url?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  medias?: {
    path?: string;
  }[];
  status?: JobStatus;
  expiration_date?: string | null;
}

export interface CompanyWithJobsResponse {
  company?: Company;
  jobs?: Job[];
}
