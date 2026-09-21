import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getReminderSettings,
  saveReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
} from "../storage/reminderSettingsStorage";

describe("reminderSettingsStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns default settings (disabled) when nothing has been saved", async () => {
    await expect(getReminderSettings()).resolves.toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it("persists and retrieves custom settings", async () => {
    const custom = { enabled: true, startHour: 7, endHour: 22, intervalMinutes: 90 };
    await saveReminderSettings(custom);
    await expect(getReminderSettings()).resolves.toEqual(custom);
  });

  it("degrades to defaults if stored data is corrupted rather than throwing", async () => {
    await AsyncStorage.setItem("nutritrack_hydration_reminder_settings", "{not valid json");
    await expect(getReminderSettings()).resolves.toEqual(DEFAULT_REMINDER_SETTINGS);
  });
});
