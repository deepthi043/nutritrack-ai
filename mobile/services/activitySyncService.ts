/**
 * Orchestrates reading today's activity from the platform provider,
 * queuing it locally, and syncing to the backend — with offline support
 * (section 8/10/11 of the Phase 6 spec).
 *
 *   Device health API
 *     -> ActivityProvider.readTodayActivity() (current daily total)
 *     -> enqueue locally (survives app restarts, network loss)
 *     -> flushQueue(): while online, POST /api/activity/sync per entry
 *     -> on success: dequeue + record "last synced at"
 *     -> on failure: leave queued, retried on next flush
 *
 * flushQueue is safe to call as often as needed (app foreground, pull to
 * refresh, connectivity restored, manual "Sync Now") because the backend
 * sync endpoint is idempotent — repeated delivery of the same reading
 * never double-counts (see backend/app/services/activity_service.py
 * sync_activity_record and its tests).
 */

import { isAxiosError } from "axios";
import NetInfo from "@react-native-community/netinfo";
import { syncActivity } from "./activityService";
import { getPlatformActivityProvider } from "./activityProviders";
import { localDateString as todayDateString } from "./localDate";
import * as syncQueueStorage from "../storage/syncQueueStorage";
import type { ActivitySyncRequest, PendingActivitySync } from "../types";

/** Section 16: dev-only sync diagnostics — logs enough to tell a request
 * validation error (4xx: wrong payload shape, e.g. an unrecognized
 * `source`) apart from a real connectivity/server failure (network error,
 * timeout, 5xx), without ever logging the request body, headers, or any
 * token. Both currently surface to the user as the same generic "Unable
 * to sync activity" message — this log is what makes the real cause
 * visible during development instead of just seeing "it failed." */
function logSyncFailure(err: unknown) {
  if (!__DEV__) return;
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const category = status && status >= 400 && status < 500 ? "CLIENT_ERROR (bad request)" : status && status >= 500 ? "SERVER_ERROR" : err.code === "ECONNABORTED" ? "TIMEOUT" : "NETWORK_ERROR";
    console.log("[activitySyncService] SYNC FAILED", {
      endpoint: "/api/activity/sync",
      status: status ?? "(no response)",
      category,
      detail: (err.response?.data as { detail?: unknown } | undefined)?.detail,
    });
  } else {
    console.log("[activitySyncService] SYNC FAILED", { endpoint: "/api/activity/sync", category: "UNKNOWN", err });
  }
}

function makeQueueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

/** Reads today's activity from the device and queues it for sync — does
 * NOT attempt the network call directly, so this always succeeds even
 * fully offline (section 11). Call flushQueue() afterward to attempt
 * delivery. */
export async function captureAndQueueTodayActivity(): Promise<ActivitySyncRequest> {
  const provider = getPlatformActivityProvider();
  const reading = await provider.readTodayActivity();

  const payload: ActivitySyncRequest = {
    date: todayDateString(),
    steps: reading.steps,
    distance_km: Math.round((reading.distanceMeters / 1000) * 100) / 100,
    active_minutes: reading.activeMinutes,
    source: provider.source,
  };

  const entry: PendingActivitySync = {
    id: makeQueueId(),
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  await syncQueueStorage.enqueue(entry);
  return payload;
}

/** Attempts to deliver every queued reading. Entries that fail (network
 * error, server error) stay queued for the next attempt rather than being
 * dropped — activity data is never lost to a transient connectivity
 * problem (section 11). */
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  const online = await isOnline();
  if (!online) {
    const queue = await syncQueueStorage.getQueue();
    return { synced: 0, remaining: queue.length };
  }

  const queue = await syncQueueStorage.getQueue();
  let synced = 0;

  for (const entry of queue) {
    if (__DEV__) {
      console.log("[activitySyncService] SYNC START", { endpoint: "/api/activity/sync", source: entry.payload.source, date: entry.payload.date });
    }
    try {
      await syncActivity(entry.payload);
      await syncQueueStorage.removeFromQueue(entry.id);
      synced += 1;
    } catch (err) {
      // Leave it queued — will be retried on the next flush. We don't
      // increment attempts into a dead-letter/give-up state here because
      // daily activity totals remain valid and worth retrying indefinitely
      // until the next successful sync supersedes them.
      //
      // EXCEPTION: a 4xx validation error (e.g. an unrecognized `source`
      // value, as happened when the backend's schema and this client's
      // source list briefly drifted) will NEVER succeed on retry without a
      // code fix — but it still stays queued here rather than being
      // silently dropped, since dropping real activity data on an
      // unexpected error is worse than an indefinitely-stuck queue entry a
      // developer can diagnose via the log below.
      logSyncFailure(err);
    }
  }

  if (synced > 0) {
    await syncQueueStorage.setLastSyncedAt(new Date().toISOString());
  }

  const remaining = await syncQueueStorage.getQueue();
  return { synced, remaining: remaining.length };
}

/** Convenience one-shot: capture today's reading, queue it, then
 * immediately attempt to flush. Used by "Sync Now" and pull-to-refresh. */
export async function captureAndSync(): Promise<{ synced: number; remaining: number }> {
  await captureAndQueueTodayActivity();
  return flushQueue();
}

export { getLastSyncedAt } from "../storage/syncQueueStorage";
export async function getPendingCount(): Promise<number> {
  const queue = await syncQueueStorage.getQueue();
  return queue.length;
}
