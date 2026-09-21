import AsyncStorage from "@react-native-async-storage/async-storage";
import * as syncQueueStorage from "../storage/syncQueueStorage";
import type { PendingActivitySync } from "../types";

function makeEntry(overrides: Partial<PendingActivitySync["payload"]> = {}): PendingActivitySync {
  return {
    id: `${Math.random()}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    payload: {
      date: "2026-09-12",
      steps: 7842,
      distance_km: 5.3,
      active_minutes: 62,
      source: "android_health",
      ...overrides,
    },
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("syncQueueStorage", () => {
  it("starts empty", async () => {
    await expect(syncQueueStorage.getQueue()).resolves.toEqual([]);
  });

  it("enqueues an entry and can read it back", async () => {
    const entry = makeEntry();
    await syncQueueStorage.enqueue(entry);

    const queue = await syncQueueStorage.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.steps).toBe(7842);
  });

  it("replaces an existing queued entry for the same date+source instead of stacking duplicates", async () => {
    await syncQueueStorage.enqueue(makeEntry({ steps: 7000 }));
    await syncQueueStorage.enqueue(makeEntry({ steps: 7500 }));
    await syncQueueStorage.enqueue(makeEntry({ steps: 7842 }));

    const queue = await syncQueueStorage.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.steps).toBe(7842); // latest total wins
  });

  it("keeps entries for different dates/sources separate", async () => {
    await syncQueueStorage.enqueue(makeEntry({ date: "2026-09-11" }));
    await syncQueueStorage.enqueue(makeEntry({ date: "2026-09-12" }));
    await syncQueueStorage.enqueue(makeEntry({ source: "ios_health" }));

    const queue = await syncQueueStorage.getQueue();
    expect(queue).toHaveLength(3);
  });

  it("removes an entry by id", async () => {
    const entry = makeEntry();
    await syncQueueStorage.enqueue(entry);
    await syncQueueStorage.removeFromQueue(entry.id);

    await expect(syncQueueStorage.getQueue()).resolves.toEqual([]);
  });

  it("tracks last-synced-at timestamp", async () => {
    await expect(syncQueueStorage.getLastSyncedAt()).resolves.toBeNull();

    const now = new Date().toISOString();
    await syncQueueStorage.setLastSyncedAt(now);

    await expect(syncQueueStorage.getLastSyncedAt()).resolves.toBe(now);
  });

  it("survives corrupted stored JSON by returning an empty queue rather than throwing", async () => {
    await AsyncStorage.setItem("nutritrack_pending_activity_syncs", "{not valid json");
    await expect(syncQueueStorage.getQueue()).resolves.toEqual([]);
  });
});
