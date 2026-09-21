import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as activityService from "../services/activityService";
import * as activitySyncService from "../services/activitySyncService";
import { getPlatformActivityProvider } from "../services/activityProviders";

jest.mock("../services/activityService");
jest.mock("../services/activityProviders");
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(),
}));

const mockedSyncActivity = activityService.syncActivity as jest.Mock;
const mockedGetProvider = getPlatformActivityProvider as jest.Mock;
const mockedNetInfoFetch = NetInfo.fetch as jest.Mock;

function mockProviderReading(steps: number) {
  mockedGetProvider.mockReturnValue({
    source: "android_health",
    readTodayActivity: jest.fn().mockResolvedValue({ steps, distanceMeters: steps * 0.75, activeMinutes: 40 }),
  });
}

function setOnline(online: boolean) {
  mockedNetInfoFetch.mockResolvedValue({ isConnected: online, isInternetReachable: online });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("activitySyncService", () => {
  describe("isOnline", () => {
    it("reflects NetInfo connectivity state", async () => {
      setOnline(true);
      await expect(activitySyncService.isOnline()).resolves.toBe(true);

      setOnline(false);
      await expect(activitySyncService.isOnline()).resolves.toBe(false);
    });
  });

  describe("captureAndQueueTodayActivity", () => {
    it("reads from the platform provider and queues without hitting the network", async () => {
      mockProviderReading(7842);

      const payload = await activitySyncService.captureAndQueueTodayActivity();

      expect(payload.steps).toBe(7842);
      expect(payload.source).toBe("android_health");
      expect(mockedSyncActivity).not.toHaveBeenCalled();
      await expect(activitySyncService.getPendingCount()).resolves.toBe(1);
    });
  });

  describe("flushQueue — offline behavior (section 11)", () => {
    it("leaves the queue untouched when offline", async () => {
      mockProviderReading(5000);
      setOnline(false);

      await activitySyncService.captureAndQueueTodayActivity();
      const result = await activitySyncService.flushQueue();

      expect(result).toEqual({ synced: 0, remaining: 1 });
      expect(mockedSyncActivity).not.toHaveBeenCalled();
    });

    it("delivers queued entries once back online and clears them on success", async () => {
      mockProviderReading(5000);
      setOnline(false);
      await activitySyncService.captureAndQueueTodayActivity();

      setOnline(true);
      mockedSyncActivity.mockResolvedValue({ id: 1, was_updated: false });
      const result = await activitySyncService.flushQueue();

      expect(result).toEqual({ synced: 1, remaining: 0 });
      expect(mockedSyncActivity).toHaveBeenCalledTimes(1);
      await expect(activitySyncService.getPendingCount()).resolves.toBe(0);
    });

    it("keeps a failed entry queued for retry rather than dropping it", async () => {
      mockProviderReading(5000);
      setOnline(true);
      await activitySyncService.captureAndQueueTodayActivity();

      mockedSyncActivity.mockRejectedValue(new Error("network error"));
      const result = await activitySyncService.flushQueue();

      expect(result).toEqual({ synced: 0, remaining: 1 });
    });

    it("retries a previously failed entry successfully on the next flush", async () => {
      mockProviderReading(5000);
      setOnline(true);
      await activitySyncService.captureAndQueueTodayActivity();

      mockedSyncActivity.mockRejectedValueOnce(new Error("network error"));
      await activitySyncService.flushQueue();

      mockedSyncActivity.mockResolvedValueOnce({ id: 1, was_updated: false });
      const secondAttempt = await activitySyncService.flushQueue();

      expect(secondAttempt).toEqual({ synced: 1, remaining: 0 });
    });
  });

  describe("captureAndSync — increasing step count across the day (section 15/23)", () => {
    it("queues and syncs each successive reading, superseding the previous queued total", async () => {
      setOnline(true);
      mockedSyncActivity.mockResolvedValue({ id: 1, was_updated: true });

      mockProviderReading(7000);
      await activitySyncService.captureAndSync();
      expect(mockedSyncActivity).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 7000 }));

      mockProviderReading(7500);
      await activitySyncService.captureAndSync();
      expect(mockedSyncActivity).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 7500 }));

      mockProviderReading(7842);
      await activitySyncService.captureAndSync();
      expect(mockedSyncActivity).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 7842 }));

      expect(mockedSyncActivity).toHaveBeenCalledTimes(3);
    });

    it("repeated identical syncs each deliver the same total exactly once per flush (no client-side doubling)", async () => {
      setOnline(true);
      mockProviderReading(7842);
      mockedSyncActivity.mockResolvedValue({ id: 1, was_updated: true });

      await activitySyncService.captureAndSync();
      await activitySyncService.captureAndSync();
      await activitySyncService.captureAndSync();

      for (const call of mockedSyncActivity.mock.calls) {
        expect(call[0].steps).toBe(7842);
      }
    });
  });

  describe("todayDateString — local timezone (section 8)", () => {
    it("queues the payload under the device's local calendar date, not a UTC-shifted one", async () => {
      // Pin the system clock to a moment where UTC and local date would
      // differ for many real-world timezones (11:30pm local in UTC+5:30
      // is already 6:00pm UTC the same day, but 11:30pm in UTC-8 would be
      // 7:30am UTC the *next* day) — toISOString()-based date derivation
      // would get this wrong; Date#getFullYear/getMonth/getDate must not.
      const fixedLocalMidnightish = new Date(2026, 8, 17, 23, 30, 0); // 2026-09-17 23:30 local
      jest.useFakeTimers().setSystemTime(fixedLocalMidnightish);

      mockProviderReading(1234);
      const payload = await activitySyncService.captureAndQueueTodayActivity();

      expect(payload.date).toBe("2026-09-17");

      jest.useRealTimers();
    });
  });

  describe("getLastSyncedAt / pending count", () => {
    it("records last-synced-at only after a successful sync", async () => {
      mockProviderReading(1000);
      setOnline(true);
      mockedSyncActivity.mockResolvedValue({ id: 1, was_updated: false });

      await expect(activitySyncService.getLastSyncedAt()).resolves.toBeNull();
      await activitySyncService.captureAndSync();
      await expect(activitySyncService.getLastSyncedAt()).resolves.not.toBeNull();
    });
  });
});
