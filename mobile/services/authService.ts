import { api } from "./api";
import type { AuthResponse, User } from "../types";

// Reuses the exact same FastAPI auth endpoints the web app uses — no
// separate mobile authentication system, per Phase 6 spec.

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

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<User>("/api/auth/me");
  return data;
}
