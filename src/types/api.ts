export type Role = "admin" | "manager" | "staff" | "viewer";

export type Permission =
  | "user:create"
  | "user:read"
  | "user:update"
  | "user:delete";

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
