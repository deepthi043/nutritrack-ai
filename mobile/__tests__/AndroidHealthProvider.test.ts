import { Platform } from "react-native";
import { AndroidHealthProvider } from "../services/activityProviders/AndroidHealthProvider";

// react-native-health-connect has no JS-usable mock outside a real Android
// dev build; AndroidHealthProvider deliberately lazy-`require`s it inside a
// try/catch specifically so it can be swapped out here.
jest.mock(
  "react-native-health-connect",
  () => ({
    getSdkStatus: jest.fn(),
    SdkAvailabilityStatus: { SDK_AVAILABLE: "SDK_AVAILABLE", SDK_UNAVAILABLE: "SDK_UNAVAILABLE" },
    getGrantedPermissions: jest.fn(),
    initialize: jest.fn(),
    requestPermission: jest.fn(),
    aggregateRecord: jest.fn(),
  }),
  { virtual: true }
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const hc = require("react-native-health-connect");

describe("AndroidHealthProvider", () => {
  let provider: AndroidHealthProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { get: () => "android" });
    provider = new AndroidHealthProvider();
  });

  it("identifies itself with the android_health source", () => {
    expect(provider.source).toBe("android_health");
  });

  describe("isAvailable", () => {
    it("is available when the SDK reports SDK_AVAILABLE", async () => {
      hc.getSdkStatus.mockResolvedValue("SDK_AVAILABLE");
      await expect(provider.isAvailable()).resolves.toBe(true);
    });

    it("is unavailable when the SDK reports SDK_UNAVAILABLE (e.g. Health Connect not installed)", async () => {
      hc.getSdkStatus.mockResolvedValue("SDK_UNAVAILABLE");
      await expect(provider.isAvailable()).resolves.toBe(false);
    });

    it("is unavailable when the platform is not android", async () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios" });
      await expect(provider.isAvailable()).resolves.toBe(false);
    });
  });

  describe("getPermissionState", () => {
    it("reports granted when both Steps and Distance are granted", async () => {
      hc.getGrantedPermissions.mockResolvedValue([
        { accessType: "read", recordType: "Steps" },
        { accessType: "read", recordType: "Distance" },
      ]);
      await expect(provider.getPermissionState()).resolves.toBe("granted");
    });

    it("reports denied when permission has not been granted", async () => {
      hc.getGrantedPermissions.mockResolvedValue([]);
      await expect(provider.getPermissionState()).resolves.toBe("denied");
    });

    it("reports denied (not a crash) when the native call throws", async () => {
      hc.getGrantedPermissions.mockRejectedValue(new Error("not initialized"));
      await expect(provider.getPermissionState()).resolves.toBe("denied");
    });
  });

  describe("readTodayActivity — real cumulative daily totals", () => {
    it("reads today's real step/distance/exercise aggregates from Health Connect", async () => {
      hc.aggregateRecord.mockImplementation(({ recordType }: { recordType: string }) => {
        if (recordType === "Steps") return Promise.resolve({ COUNT_TOTAL: 7842 });
        if (recordType === "Distance") return Promise.resolve({ DISTANCE: { inMeters: 5300 } });
        if (recordType === "ExerciseSession") return Promise.resolve({ EXERCISE_DURATION_TOTAL: { inSeconds: 3720 } });
        return Promise.resolve(null);
      });

      const reading = await provider.readTodayActivity();

      expect(reading).toEqual({ steps: 7842, distanceMeters: 5300, activeMinutes: 62 });
    });

    it("returns a genuine zero when Health Connect has no step data yet today (not fabricated)", async () => {
      hc.aggregateRecord.mockResolvedValue(null);

      const reading = await provider.readTodayActivity();

      expect(reading).toEqual({ steps: 0, distanceMeters: 0, activeMinutes: 0 });
    });

    it("queries a time window starting at local midnight, not a UTC truncation", async () => {
      let capturedStart = "";
      hc.aggregateRecord.mockImplementation(({ timeRangeFilter }: { timeRangeFilter: { startTime: string } }) => {
        capturedStart = timeRangeFilter.startTime;
        return Promise.resolve({ COUNT_TOTAL: 100 });
      });

      await provider.readTodayActivity();

      const parsedStart = new Date(capturedStart);
      // Local midnight means the LOCAL hour/minute/second components are
      // zero, regardless of what timezone offset that corresponds to in
      // UTC — this is what distinguishes it from a UTC-day truncation,
      // which would only show zero local components for a UTC-based
      // device and skew for every other timezone.
      expect(parsedStart.getHours()).toBe(0);
      expect(parsedStart.getMinutes()).toBe(0);
      expect(parsedStart.getSeconds()).toBe(0);
    });

    it("does not crash and returns zero for a metric when its aggregate call rejects (e.g. permission revoked mid-session)", async () => {
      hc.aggregateRecord.mockImplementation(({ recordType }: { recordType: string }) => {
        if (recordType === "Steps") return Promise.resolve({ COUNT_TOTAL: 500 });
        return Promise.reject(new Error("permission revoked"));
      });

      const reading = await provider.readTodayActivity();

      expect(reading).toEqual({ steps: 500, distanceMeters: 0, activeMinutes: 0 });
    });

    it("returns zero when Health Connect itself is unavailable rather than throwing", async () => {
      hc.getSdkStatus.mockResolvedValue("SDK_UNAVAILABLE");
      Object.defineProperty(Platform, "OS", { get: () => "ios" }); // forces hc() to return null

      const reading = await provider.readTodayActivity();

      expect(reading).toEqual({ steps: 0, distanceMeters: 0, activeMinutes: 0 });
    });
  });
});
