import { api } from "./api";
import type { AuthResponse, User, ForgotPasswordResponse } from "../types";

export async function registerUser(email: string, password: string, fullName?: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/register", {
    email,
    password,
    full_name: fullName || null,
  });
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", { email, password });
  return data;
}

export async function logoutUser(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<User>("/api/auth/me");
  return data;
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  const { data } = await api.post<ForgotPasswordResponse>("/api/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post("/api/auth/reset-password", { token, new_password: newPassword });
}
