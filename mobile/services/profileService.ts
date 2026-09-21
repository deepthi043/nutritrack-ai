import { api } from "./api";

/** Minimal shape — only the field the native step-sensor provider needs
 * for stride-length estimation (see activityProviders/estimateDistance.ts).
 * Not a general-purpose profile client; add fields here only as another
 * caller actually needs them. */
export interface ProfileHeight {
  height_cm: number | null;
}

export async function getProfileHeight(): Promise<number | null> {
  try {
    const { data } = await api.get<ProfileHeight>("/api/profile");
    return data.height_cm ?? null;
  } catch {
    // Profile fetch failing must never block step tracking — distance
    // estimation falls back to the documented population-average stride
    // length (see estimateDistance.ts) rather than surfacing an error.
    return null;
  }
}
