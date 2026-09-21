import { useCallback, useEffect, useRef, useState } from "react";
import * as activitySyncService from "../services/activitySyncService";
import type { SyncStatus } from "../types";

/**
 * Drives the sync status indicator (🟢/🟡/🔴, "Sync Now", "Last synced …")
 * shown on the mobile Activity screen (sections 17/18).
 */
export function useActivitySync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMounted = useRef(true);

  const refreshStatus = useCallback(async () => {
    const [last, pending] = await Promise.all([
      activitySyncService.getLastSyncedAt(),
      activitySyncService.getPendingCount(),
    ]);
    if (!isMounted.current) return;
    setLastSyncedAt(last);
    setPendingCount(pending);
    // Functional update so this never clobbers a concurrent "syncing"
    // state with a stale read of `status` from closure.
    setStatus((current) => (current === "syncing" ? current : pending > 0 ? "pending" : last ? "synced" : "idle"));
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void refreshStatus();
    return () => {
      isMounted.current = false;
    };
  }, [refreshStatus]);

  async function syncNow() {
    setStatus("syncing");
    setErrorMessage(null);
    try {
      const online = await activitySyncService.isOnline();
      if (!online) {
        await activitySyncService.captureAndQueueTodayActivity();
        setStatus("pending");
        setErrorMessage("No internet connection. We'll sync automatically when you're back online.");
        await refreshStatus();
        return;
      }

      const result = await activitySyncService.captureAndSync();
      if (result.remaining > 0) {
        setStatus("failed");
        setErrorMessage("Unable to sync activity. We'll try again later.");
      } else {
        setStatus("synced");
      }
      await refreshStatus();
    } catch {
      setStatus("failed");
      setErrorMessage("Unable to sync activity. We'll try again later.");
    }
  }

  return { status, lastSyncedAt, pendingCount, errorMessage, syncNow, refreshStatus };
}
