import * as Notifications from "expo-notifications";
import type { ReminderSettings } from "../storage/reminderSettingsStorage";

const NOTIFICATION_CATEGORY = "hydration-reminder";

/**
 * Part 16: computes the local reminder times (as "HH:MM" strings, 24h,
 * local time) a reminder should fire at, given the configured start/end
 * window and interval — pure logic, unit-testable without touching
 * expo-notifications at all.
 *
 * "Respect user settings / do not make reminders excessive": this
 * function only ever returns times strictly within [startHour, endHour],
 * and never less than a sane minimum interval apart (enforced by the
 * caller-configurable intervalMinutes itself, which the UI constrains to
 * a minimum — see HydrationRemindersScreen).
 */
export function computeReminderTimes(settings: ReminderSettings): string[] {
  if (!settings.enabled) return [];
  if (settings.endHour <= settings.startHour) return [];
  if (settings.intervalMinutes <= 0) return [];

  const times: string[] = [];
  const startMinutes = settings.startHour * 60;
  const endMinutes = settings.endHour * 60;

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += settings.intervalMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return times;
}

/** Requests the OS notification permission — only ever called from an
 * explicit user action (enabling reminders in settings), never on app
 * launch, matching this app's existing permission-request pattern
 * (PermissionGate/useActivityPermission). */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Cancels every previously scheduled hydration reminder, then schedules
 * fresh ones for the current settings. Called whenever settings change,
 * so stale reminders never linger after the user adjusts their window or
 * interval, and disabling reminders (settings.enabled=false) simply
 * results in zero scheduled notifications. */
export async function applyReminderSchedule(settings: ReminderSettings): Promise<void> {
  await cancelAllReminders();

  if (!settings.enabled) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const times = computeReminderTimes(settings);
  for (const time of times) {
    const [hour, minute] = time.split(":").map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💧 Hydration reminder",
        // Part 17: a gentle prompt to log, never a diagnostic/medical
        // claim (e.g. never "you are dehydrated").
        body: "If you've had water recently, log it in NutriTrack.",
        data: { category: NOTIFICATION_CATEGORY },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.category === NOTIFICATION_CATEGORY) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}
