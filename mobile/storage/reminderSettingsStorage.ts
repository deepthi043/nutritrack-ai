/**
 * Local persistence for hydration reminder preferences (Part 16). Purely
 * a per-device UI setting — never synced to the backend — so AsyncStorage
 * is appropriate here, same as the offline sync queue.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nutritrack_hydration_reminder_settings";

export interface ReminderSettings {
  enabled: boolean;
  startHour: number; // 0-23, local time
  endHour: number; // 0-23, local time, must be > startHour
  intervalMinutes: number; // minutes between reminders
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  startHour: 8,
  endHour: 21,
  intervalMinutes: 120,
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_REMINDER_SETTINGS;
  try {
    return { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
