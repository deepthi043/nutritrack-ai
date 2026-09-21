import * as Notifications from "expo-notifications";
import {
  computeReminderTimes,
  applyReminderSchedule,
  cancelAllReminders,
  requestNotificationPermission,
} from "../services/hydrationReminderService";
import { DEFAULT_REMINDER_SETTINGS } from "../storage/reminderSettingsStorage";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe("computeReminderTimes (Part 16 — respect user settings, never excessive)", () => {
  it("returns no times when reminders are disabled", () => {
    expect(computeReminderTimes({ ...DEFAULT_REMINDER_SETTINGS, enabled: false })).toEqual([]);
  });

  it("computes evenly-spaced times within the configured window", () => {
    const times = computeReminderTimes({
      enabled: true,
      startHour: 9,
      endHour: 12,
      intervalMinutes: 60,
    });
    expect(times).toEqual(["09:00", "10:00", "11:00", "12:00"]);
  });

  it("handles a non-hour-aligned interval correctly", () => {
    const times = computeReminderTimes({
      enabled: true,
      startHour: 8,
      endHour: 9,
      intervalMinutes: 30,
    });
    expect(times).toEqual(["08:00", "08:30", "09:00"]);
  });

  it("returns no times when the window is invalid (end before or equal to start)", () => {
    expect(computeReminderTimes({ enabled: true, startHour: 10, endHour: 10, intervalMinutes: 60 })).toEqual([]);
    expect(computeReminderTimes({ enabled: true, startHour: 12, endHour: 9, intervalMinutes: 60 })).toEqual([]);
  });

  it("returns no times for a zero or negative interval (never an infinite/excessive schedule)", () => {
    expect(computeReminderTimes({ enabled: true, startHour: 8, endHour: 20, intervalMinutes: 0 })).toEqual([]);
    expect(computeReminderTimes({ enabled: true, startHour: 8, endHour: 20, intervalMinutes: -30 })).toEqual([]);
  });

  it("never produces a time outside the configured window", () => {
    const times = computeReminderTimes({ enabled: true, startHour: 8, endHour: 21, intervalMinutes: 120 });
    for (const time of times) {
      const [hour] = time.split(":").map(Number);
      expect(hour).toBeGreaterThanOrEqual(8);
      expect(hour).toBeLessThanOrEqual(21);
    }
  });
});

describe("requestNotificationPermission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not re-request when already granted", async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission when not yet granted, only after an explicit call (never on app launch)", async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe("applyReminderSchedule / cancelAllReminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it("schedules one notification per computed reminder time when enabled and permitted", async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);

    await applyReminderSchedule({ enabled: true, startHour: 9, endHour: 11, intervalMinutes: 60 });

    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3); // 09:00, 10:00, 11:00
  });

  it("schedules nothing when disabled", async () => {
    await applyReminderSchedule({ enabled: false, startHour: 9, endHour: 11, intervalMinutes: 60 });

    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules nothing when permission is not granted", async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);

    await applyReminderSchedule({ enabled: true, startHour: 9, endHour: 11, intervalMinutes: 60 });

    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancels only this app's hydration-reminder notifications, not unrelated ones", async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "a", content: { data: { category: "hydration-reminder" } } },
      { identifier: "b", content: { data: { category: "some-other-feature" } } },
    ] as never);

    await cancelAllReminders();

    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("a");
  });

  it("cancels existing reminders before scheduling new ones, so changing settings never leaves duplicates", async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "old", content: { data: { category: "hydration-reminder" } } },
    ] as never);

    await applyReminderSchedule({ enabled: true, startHour: 9, endHour: 10, intervalMinutes: 60 });

    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("old");
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2); // 09:00, 10:00
  });
});
