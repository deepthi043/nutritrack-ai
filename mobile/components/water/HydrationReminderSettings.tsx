import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch, TextInput } from "react-native";
import { Card } from "../Card";
import {
  getReminderSettings,
  saveReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from "../../storage/reminderSettingsStorage";
import { applyReminderSchedule, requestNotificationPermission } from "../../services/hydrationReminderService";

const MIN_INTERVAL_MINUTES = 30;

/** Part 16: enable/disable, start/end time, and interval — kept as a
 * self-contained settings card on the Hydration screen rather than a
 * separate screen, since it's a small, single-purpose form. */
export function HydrationReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await getReminderSettings();
      setSettings(stored);
    })();
  }, []);

  async function persist(next: ReminderSettings) {
    setSettings(next);
    setIsSaving(true);
    setError(null);
    try {
      await saveReminderSettings(next);
      if (next.enabled) {
        // Check permission explicitly (rather than letting
        // applyReminderSchedule silently no-op on denial) so the toggle
        // doesn't look "on" with nothing actually scheduled.
        const granted = await requestNotificationPermission();
        if (!granted) {
          setError("Notification permission was not granted — reminders won't be shown until it's allowed in device settings.");
          setSettings((current) => ({ ...current, enabled: false }));
          await saveReminderSettings({ ...next, enabled: false });
          return;
        }
      }
      await applyReminderSchedule(next);
    } catch {
      setError("Unable to update reminder settings. Check notification permissions in device settings.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleToggle(enabled: boolean) {
    void persist({ ...settings, enabled });
  }

  function handleIntervalChange(text: string) {
    const value = Number(text);
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(value, MIN_INTERVAL_MINUTES);
    setSettings((current) => ({ ...current, intervalMinutes: clamped }));
  }

  function handleIntervalCommit() {
    void persist(settings);
  }

  function handleHourChange(field: "startHour" | "endHour", text: string) {
    const value = Number(text);
    if (!Number.isFinite(value)) return;
    const clamped = Math.min(Math.max(Math.round(value), 0), 23);
    setSettings((current) => ({ ...current, [field]: clamped }));
  }

  function handleHourCommit() {
    void persist(settings);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>💧 Hydration Reminders</Text>
        <Switch value={settings.enabled} onValueChange={handleToggle} disabled={isSaving} />
      </View>

      {settings.enabled && (
        <>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Start (hour)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={String(settings.startHour)}
                onChangeText={(text) => handleHourChange("startHour", text)}
                onBlur={handleHourCommit}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>End (hour)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={String(settings.endHour)}
                onChangeText={(text) => handleHourChange("endHour", text)}
                onBlur={handleHourCommit}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Reminder interval (minutes)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(settings.intervalMinutes)}
            onChangeText={handleIntervalChange}
            onBlur={handleIntervalCommit}
          />

          <Text style={styles.hint}>
            A gentle daily prompt — quick-add buttons for logging water are on the Hydration screen above.
          </Text>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldGroup: { flex: 1 },
  fieldLabel: { fontSize: 12, color: "#64748b", marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  hint: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  error: { fontSize: 12, color: "#b91c1c" },
});
