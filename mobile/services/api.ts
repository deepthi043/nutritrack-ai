import { default as axios, type AxiosError } from "axios";
import Constants from "expo-constants";
import { getToken, clearToken } from "../storage/secureStorage";

// Same backend the web app talks to — no second backend, per Phase 6 spec.
// Configured via app.json's `extra.apiBaseUrl` (falls back to localhost for
// local development). On a physical device this must be your machine's
// LAN IP, not localhost — see mobile/README.md.
const API_BASE_URL = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) || "http://localhost:8010";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;

/** Registered once by AuthProvider so a 401 anywhere logs the user out
 * locally (the token is invalid/expired) without every call site needing
 * to handle it individually. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (detail) return detail;
    if (error.code === "ECONNABORTED" || error.message?.includes("Network Error")) {
      return "Unable to reach the server. Check your connection and try again.";
    }
    if (error.message) return error.message;
  }
  return "Something went wrong. Please try again.";
}
