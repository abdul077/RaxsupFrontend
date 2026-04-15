export interface User {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  emailVerified?: boolean;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  fullName: string;
  role: string;
  email: string;
  emailVerified: boolean;
}

