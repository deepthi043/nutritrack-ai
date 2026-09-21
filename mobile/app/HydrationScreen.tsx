import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TextInput } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { getTodayWater, getTodayWaterEntries, addWater, deleteWater } from "../services/waterService";
import { getStreaks } from "../services/streakService";
import { getApiErrorMessage } from "../services/api";
import { HydrationReminderSettings } from "../components/water/HydrationReminderSettings";
import type { TodayWater, WaterRecord, Streaks } from "../types";

// Part 14's exact quick-add set.
const QUICK_AMOUNTS_ML = [100, 250, 500, 750, 1000];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function HydrationScreen() {
  const [today, setToday] = useState<TodayWater | null>(null);
  const [entries, setEntries] = useState<WaterRecord[]>([]);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [todayData, entriesData, streaksData] = await Promise.all([
        getTodayWater(),
        getTodayWaterEntries(),
        getStreaks(),
      ]);
      setToday(todayData);
      setEntries(entriesData);
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

  // Reload whenever this tab comes into focus, so a log made elsewhere
  // (or on the web app) is reflected without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }

  async function handleAdd(amountMl: number) {
    setIsAdding(true);
    try {
      await addWater(amountMl);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleAddCustom() {
    const amount = Number(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await handleAdd(Math.round(amount));
    setCustomAmount("");
  }

  async function handleDelete(id: number) {
    try {
      await deleteWater(id);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  if (isLoading) return <LoadingState message="Loading hydration..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!today) return null;

  const remainingMl = Math.max(today.goal_ml - today.total_ml, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <Text style={styles.title}>💧 Hydration</Text>

        {streaks && streaks.hydration.current > 0 && (
          <Card style={styles.streakCard}>
            <Text style={styles.streakText}>
              🔥 Hydration Streak: {streaks.hydration.current} day{streaks.hydration.current === 1 ? "" : "s"} · Best{" "}
              {streaks.hydration.best}
            </Text>
          </Card>
        )}

        <Card style={styles.progressCard}>
          <Text style={styles.progressValue}>
            {today.total_ml.toLocaleString()} / {today.goal_ml.toLocaleString()} ml
          </Text>
          <ProgressBar percent={today.progress_percent} color="#0ea5e9" />
          <Text style={styles.progressDetail}>
            {today.progress_percent}%{remainingMl > 0 ? ` · ${remainingMl.toLocaleString()} ml remaining` : " · Goal reached"}
          </Text>
          {today.is_using_recommended_goal && (
            <Text style={styles.recommendedNote}>
              🎯 Automatically estimated from your weight — a general wellness estimate, adjustable in Goals.
            </Text>
          )}
        </Card>

        <Text style={styles.sectionLabel}>Add Water</Text>
        <View style={styles.quickAddRow}>
          {QUICK_AMOUNTS_ML.map((amount) => (
            <Button
              key={amount}
              label={amount >= 1000 ? `${amount / 1000} L` : `${amount} ml`}
              variant="outline"
              onPress={() => handleAdd(amount)}
              disabled={isAdding}
              style={styles.quickAddButton}
            />
          ))}
        </View>

        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="Custom amount (ml)"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            value={customAmount}
            onChangeText={setCustomAmount}
          />
          <Button label="Add" onPress={handleAddCustom} isLoading={isAdding} style={styles.customButton} />
        </View>

        <HydrationReminderSettings />

        {entries.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Today&apos;s Log</Text>
            <Card style={styles.entriesCard}>
              {entries
                .slice()
                .reverse()
                .map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Text style={styles.entryText}>
                      {entry.amount_ml} ml · {formatTime(entry.consumed_at)}
                    </Text>
                    <Text style={styles.entryDelete} onPress={() => handleDelete(entry.id)}>
                      Remove
                    </Text>
                  </View>
                ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  streakCard: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  streakText: { fontSize: 13, fontWeight: "600", color: "#9a3412" },
  progressCard: { gap: 8 },
  progressValue: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  progressDetail: { fontSize: 12, color: "#94a3b8" },
  recommendedNote: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginTop: 12 },
  quickAddRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAddButton: { flexGrow: 1, minWidth: "28%" },
  customRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  customButton: { minWidth: 80 },
  entriesCard: { gap: 8 },
  entryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryText: { fontSize: 14, color: "#334155" },
  entryDelete: { fontSize: 12, color: "#b91c1c", fontWeight: "600" },
});
