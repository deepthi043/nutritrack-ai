/**
 * Local, unencrypted persistence for the offline activity sync queue and
 * "last synced" timestamp. Contains no credentials — only aggregated daily
 * step/distance/minute totals already destined for the server — so plain
 * AsyncStorage is appropriate here (unlike the auth token, see
 * secureStorage.ts).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingActivitySync } from "../types";

const QUEUE_KEY = "nutritrack_pending_activity_syncs";
const LAST_SYNCED_KEY = "nutritrack_last_synced_at";

export async function getQueue(): Promise<PendingActivitySync[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingActivitySync[];
  } catch {
    return [];
  }
}

export async function saveQueue(queue: PendingActivitySync[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(entry: PendingActivitySync): Promise<void> {
  const queue = await getQueue();
  // Replace any existing queued entry for the same date+source rather than
  // stacking up stale duplicates — only the latest cumulative total per
  // day/source matters, matching the backend's own upsert semantics.
  const filtered = queue.filter(
    (item) => !(item.payload.date === entry.payload.date && item.payload.source === entry.payload.source)
  );
  filtered.push(entry);
  await saveQueue(filtered);
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await saveQueue(queue.filter((item) => item.id !== id));
}

export async function getLastSyncedAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNCED_KEY);
}

export async function setLastSyncedAt(isoTimestamp: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNCED_KEY, isoTimestamp);
}
