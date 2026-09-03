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
