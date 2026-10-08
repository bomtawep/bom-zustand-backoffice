export type Role = "admin" | "manager" | "staff" | "viewer";

export type Permission =
  | "user:create"
  | "user:read"
  | "user:update"
  | "user:delete"
  | "template:create"
  | "template:read"
  | "template:update"
  | "template:delete"
  | "report:create"
  | "report:read"
  | "report:update"
  | "report:delete"
  | "report:generate";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeResponse extends User {
  permissions: Permission[];
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ErrorResponse {
  error: string;
}

export interface MessageResponse {
  message: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportParam {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export interface ReportDefinition {
  id: string;
  name: string;
  collection: string;
  pipelineTemplate: string;
  templateId: string;
  paramSchema: ReportParam[];
  createdAt: string;
  updatedAt: string;
}
