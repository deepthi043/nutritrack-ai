import { api } from "./api";
import type { Profile, ProfileUpdateInput } from "../types";

export async function fetchProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>("/api/profile");
  return data;
}

export async function updateProfile(input: ProfileUpdateInput): Promise<Profile> {
  const { data } = await api.put<Profile>("/api/profile", input);
  return data;
}
