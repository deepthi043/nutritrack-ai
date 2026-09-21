import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, AppState, Pressable } from "react-native";
import type { AppStateStatus } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ActivityStatCard } from "../components/activity/ActivityStatCard";
import { useAuth } from "../providers/AuthProvider";
import { getTodayActivity } from "../services/activityService";
import { getTodayWater } from "../services/waterService";
import { getStreaks } from "../services/streakService";
import { getApiErrorMessage } from "../services/api";
import type { TodayActivity, TodayWater, Streaks } from "../types";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Mobile dashboard (section 4). Reads exclusively from the existing
 * backend endpoints — no business logic (goal math, activity totals) is
 * re-implemented here, matching the "do not duplicate business logic in
 * the mobile frontend" instruction.
 */
export function HomeScreen() {
  const { user, logout } = useAuth();
  const [activity, setActivity] = useState<TodayActivity | null>(null);
  const [water, setWater] = useState<TodayWater | null>(null);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [activityData, waterData, streaksData] = await Promise.all([
        getTodayActivity(),
        getTodayWater(),
        getStreaks(),
      ]);
      setActivity(activityData);
      setWater(waterData);
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
    await loadData();
    setIsRefreshing(false);
  }

  // Reload whenever this tab comes into focus, so it reflects any sync that
  // happened on the Activity tab without needing a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  // Reload when the app returns to the foreground.
  useEffect(() => {
    function onAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        void loadData();
      }
    }
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, [loadData]);

  const firstName = user?.full_name?.split(" ")[0] || "there";

  if (isLoading) return <LoadingState message="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!activity || !water) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            {user && <Text style={styles.subGreeting}>{firstName}</Text>}
          </View>
          <Pressable onPress={() => logout()} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        {streaks && streaks.overall.current > 0 && (
          <Card style={styles.streakBanner}>
            <Text style={styles.streakBannerText}>
              🔥 {streaks.overall.current} Day Streak
            </Text>
          </Card>
        )}

        <Text style={styles.sectionLabel}>Today&apos;s Activity</Text>
      <View style={styles.statRow}>
        <ActivityStatCard emoji="👣" value={activity.steps.toLocaleString()} label="Steps" />
        <ActivityStatCard emoji="📍" value={`${activity.distance_km.toFixed(1)} km`} label="Distance" />
        <ActivityStatCard emoji="⏱️" value={`${activity.active_minutes} min`} label="Active" />
      </View>

      <Card style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalLabel}>Step Goal</Text>
          <Text style={styles.goalValue}>
            {activity.steps.toLocaleString()} / {activity.step_goal.toLocaleString()}
          </Text>
        </View>
        <ProgressBar percent={activity.goal_progress_percent} />
        <Text style={styles.goalPercent}>{activity.goal_progress_percent}% complete</Text>
      </Card>

      <Text style={styles.sectionLabel}>Hydration</Text>
      <Card>
        <Text style={styles.waterValue}>
          {(water.total_ml / 1000).toFixed(1)} / {(water.goal_ml / 1000).toFixed(1)} L
        </Text>
        <ProgressBar percent={water.progress_percent} color="#0ea5e9" />
      </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTextGroup: { flexShrink: 1 },
  greeting: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  subGreeting: { fontSize: 14, color: "#64748b", marginBottom: 8 },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    marginLeft: 12,
  },
  logoutText: { fontSize: 13, fontWeight: "600", color: "#dc2626" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginTop: 12 },
  statRow: { flexDirection: "row", gap: 10 },
  goalCard: { gap: 8 },
  goalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  goalLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  goalValue: { fontSize: 13, color: "#64748b" },
  goalPercent: { fontSize: 12, color: "#94a3b8" },
  waterValue: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  streakBanner: { backgroundColor: "#fff7ed", borderColor: "#fed7aa", alignItems: "center" },
  streakBannerText: { fontSize: 16, fontWeight: "700", color: "#9a3412" },
});
