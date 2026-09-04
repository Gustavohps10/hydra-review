export interface HydraConfig {
  redmineUrl: string;
  redmineApiKey: string;
  gitlabUrl: string;
  gitlabToken: string;
}

export interface ValidationResult<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface RedmineUserResponse {
  user: {
    id: number;
    login: string;
    firstname: string;
    lastname: string;
    mail: string;
    api_key: string;
  };
}

export interface GitLabUserResponse {
  id: number;
  username: string;
  name: string;
  email?: string;
  state: string;
  locked: boolean;
}

export interface RedmineIssue {
  id: number;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
  priority: { id: number; name: string };
  author: { id: number; name: string };
  assigned_to?: { id: number; name: string };
  fixed_version?: { id: number; name: string };
  subject: string;
  description: string;
  done_ratio: number;
  created_on: string;
  updated_on: string;
  custom_fields?: Array<{
    id: number;
    name: string;
    value: string | string[];
    multiple?: boolean;
  }>;
}

export interface RedmineIssuesResponse {
  issues: RedmineIssue[];
  total_count: number;
  offset: number;
  limit: number;
}
