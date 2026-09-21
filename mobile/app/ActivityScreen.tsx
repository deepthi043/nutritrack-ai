import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ActivityStatCard } from "../components/activity/ActivityStatCard";
import { PermissionGate } from "../components/activity/PermissionGate";
import { SyncStatusBar } from "../components/activity/SyncStatusBar";
import { ManualActivityModal } from "../components/activity/ManualActivityModal";
import { useActivitySync } from "../hooks/useActivitySync";
import { useLiveActivityReading } from "../hooks/useLiveActivityReading";
import { getPlatformActivityProvider } from "../services/activityProviders";
import { getTodayActivity, getWeeklyActivity } from "../services/activityService";
import { getStreaks } from "../services/streakService";
import { getApiErrorMessage } from "../services/api";
import type { TodayActivity, DailyStepsPoint, Streaks } from "../types";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const SOURCE_LABEL: Record<string, string> = {
  android_native: "Phone Step Sensor",
  android_health: "Health Connect",
  ios_health: "Apple Health",
  wearable: "Wearable",
  mock: "Mock Activity — Development Only",
};

function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function ActivityContent() {
  const [today, setToday] = useState<TodayActivity | null>(null);
  const [weekly, setWeekly] = useState<DailyStepsPoint[]>([]);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const sync = useActivitySync();
  const provider = getPlatformActivityProvider();
  const providerSource = provider.source;
  const live = useLiveActivityReading();
  const isAutomaticSourceUnavailable = providerSource === "android_native" && live.status === "unavailable";

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [todayData, weeklyData, streaksData] = await Promise.all([
        getTodayActivity(),
        getWeeklyActivity(),
        getStreaks(),
      ]);
      setToday(todayData);
      setWeekly(weeklyData);
      setStreaks(streaksData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadData();
      setIsLoading(false);
    })();
  }, [loadData]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await sync.syncNow();
    await loadData();
    setIsRefreshing(false);
  }

  async function handleSyncNow() {
    await sync.syncNow();
    await Promise.all([loadData(), live.refresh()]);
  }

  // Auto-sync whenever the Activity tab comes into focus (e.g. switching
  // back to it after a walk), so steps/km/minutes update without a manual
  // "Sync Now" tap.
  useFocusEffect(
    useCallback(() => {
      void handleSyncNow();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Auto-sync when the app returns to the foreground (e.g. user was on the
  // home screen or in Health Connect and comes back).
  useEffect(() => {
    function onAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        void handleSyncNow();
      }
    }
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic auto-sync while the Activity tab is open and the app is in the
  // foreground, so numbers keep updating without any user action.
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        void handleSyncNow();
      }
    }, 60_000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <LoadingState message="Loading activity..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!today) return null;

  const maxSteps = Math.max(...weekly.map((d) => d.steps), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.sourceLabel}>
        Source: {isAutomaticSourceUnavailable ? "Unavailable" : (SOURCE_LABEL[providerSource] ?? providerSource)}
      </Text>

      {isAutomaticSourceUnavailable ? (
        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Phone step sensor unavailable</Text>
          <Text style={styles.warningText}>
            Automatic tracking cannot run on this device. Steps, distance, and active time below are not
            sensor-derived. Use manual entry to log activity instead.
          </Text>
        </Card>
      ) : (
        <>
          <SyncStatusBar
            status={sync.status}
            lastSyncedAt={sync.lastSyncedAt}
            pendingCount={sync.pendingCount}
            errorMessage={sync.errorMessage}
            onSyncNow={handleSyncNow}
          />

          <View style={styles.statRow}>
            <ActivityStatCard
              emoji="👟"
              value={live.reading ? live.reading.steps.toLocaleString() : "—"}
              label={providerSource === "android_native" ? "Steps (Automatic)" : "Steps"}
            />
            <ActivityStatCard
              emoji="📏"
              value={live.reading ? `${(live.reading.distanceMeters / 1000).toFixed(2)} km` : "—"}
              label={providerSource === "android_native" ? "Distance (Estimated)" : "Distance"}
            />
            <ActivityStatCard
              emoji="⏱️"
              value={live.reading ? `${live.reading.activeMinutes} min` : "—"}
              label={providerSource === "android_native" ? "Active Time (Automatic)" : "Active Time"}
            />
          </View>

          {sync.lastSyncedAt && (
            <Text style={styles.lastUpdatedLabel}>Last updated: {formatRelativeTime(sync.lastSyncedAt)}</Text>
          )}
        </>
      )}

      <Card style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalLabel}>Daily Goal</Text>
          <Text style={styles.goalValue}>{today.goal_progress_percent}%</Text>
        </View>
        <ProgressBar percent={today.goal_progress_percent} />
        <Text style={styles.goalDetail}>
          {today.steps.toLocaleString()} / {today.step_goal.toLocaleString()} steps today
          {live.reading && today.steps !== live.reading.steps ? " (includes manually logged activity)" : ""}
        </Text>
      </Card>

      {streaks && (
        <Card style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View>
            <Text style={styles.streakValue}>
              {streaks.steps.current} day{streaks.steps.current === 1 ? "" : "s"}
            </Text>
            <Text style={styles.streakLabel}>Step Streak · Best {streaks.steps.best}</Text>
          </View>
        </Card>
      )}

      {!today.has_activity && (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No activity data is available yet.</Text>
        </Card>
      )}

      <Text style={styles.sectionLabel}>Weekly Activity</Text>
      <Card style={styles.chartCard}>
        <View style={styles.chartRow}>
          {weekly.map((point, index) => {
            const barHeight = Math.max((point.steps / maxSteps) * 80, 2);
            return (
              <View key={point.date} style={styles.chartBarWrapper}>
                <View style={styles.chartBarTrack}>
                  <View style={[styles.chartBar, { height: barHeight }]} />
                </View>
                <Text style={styles.chartLabel}>{DAY_LABELS[new Date(`${point.date}T00:00:00`).getDay()]}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Button
        label="Add Activity Manually"
        variant="ghost"
        onPress={() => setIsManualModalOpen(true)}
        style={styles.manualButton}
      />

      <ManualActivityModal
        visible={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSaved={loadData}
      />
    </ScrollView>
  );
}

/** Top-level export: gates the real screen behind the activity permission
 * flow (section 7) — PermissionGate shows the explanation/denied UI itself
 * and only renders ActivityContent once permission is resolved. */
export function ActivityScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.gateContent}>
      <PermissionGate>
        <ActivityContent />
      </PermissionGate>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  gateContent: { padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  sourceLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 12 },
  warningCard: { backgroundColor: "#fffbeb", borderColor: "#fde68a", gap: 6 },
  warningTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  warningText: { fontSize: 13, color: "#92400e" },
  lastUpdatedLabel: { fontSize: 12, color: "#94a3b8" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginTop: 12 },
  statRow: { flexDirection: "row", gap: 10 },
  goalCard: { gap: 8 },
  goalHeader: { flexDirection: "row", justifyContent: "space-between" },
  goalLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  goalValue: { fontSize: 14, fontWeight: "700", color: "#059669" },
  goalDetail: { fontSize: 12, color: "#94a3b8" },
  streakCard: { flexDirection: "row", alignItems: "center", gap: 10 },
  streakEmoji: { fontSize: 24 },
  streakValue: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  streakLabel: { fontSize: 12, color: "#94a3b8" },
  emptyCard: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: "#64748b", fontSize: 14 },
  chartCard: { paddingVertical: 16 },
  chartRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 110 },
  chartBarWrapper: { alignItems: "center", gap: 6, flex: 1 },
  chartBarTrack: { height: 80, justifyContent: "flex-end" },
  chartBar: { width: 14, backgroundColor: "#059669", borderRadius: 4 },
  chartLabel: { fontSize: 11, color: "#94a3b8" },
  manualButton: { marginTop: 8 },
});
