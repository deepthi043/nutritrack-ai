import { View, Text, StyleSheet } from "react-native";
import { Button } from "../Button";
import type { SyncStatus } from "../../types";

const STATUS_META: Record<SyncStatus, { emoji: string; label: string }> = {
  idle: { emoji: "⚪", label: "Not synced yet" },
  syncing: { emoji: "🔄", label: "Syncing..." },
  synced: { emoji: "🟢", label: "Synced" },
  pending: { emoji: "🟡", label: "Sync pending" },
  failed: { emoji: "🔴", label: "Sync failed" },
};

function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  return new Date(isoTimestamp).toLocaleDateString();
}

interface SyncStatusBarProps {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  errorMessage: string | null;
  onSyncNow: () => void;
}

export function SyncStatusBar({ status, lastSyncedAt, pendingCount, errorMessage, onSyncNow }: SyncStatusBarProps) {
  const meta = STATUS_META[status];

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {meta.emoji} {meta.label}
          {pendingCount > 0 && status !== "syncing" ? ` (${pendingCount})` : ""}
        </Text>
        {lastSyncedAt && <Text style={styles.timestamp}>Last synced {formatRelativeTime(lastSyncedAt)}</Text>}
      </View>
      <Button label="Sync Now" variant="outline" onPress={onSyncNow} disabled={status === "syncing"} />
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  statusRow: { gap: 2 },
  statusText: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  timestamp: { fontSize: 12, color: "#94a3b8" },
  error: { fontSize: 12, color: "#b91c1c" },
});
