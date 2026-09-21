import { readLiveActivity } from "../hooks/useLiveActivityReading";
import type { ActivityProvider } from "../services/activityProviders";

function makeProvider(overrides: Partial<ActivityProvider>): ActivityProvider {
  return {
    source: "android_native",
    isAvailable: jest.fn().mockResolvedValue(true),
    getPermissionState: jest.fn().mockResolvedValue("granted"),
    requestPermission: jest.fn(),
    readTodayActivity: jest.fn().mockResolvedValue({ steps: 0, distanceMeters: 0, activeMinutes: 0 }),
    ...overrides,
  };
}

describe("readLiveActivity — automatic-only reading, not the backend's combined total", () => {
  it("reads directly from the active provider, not from a backend aggregate", async () => {
    const readTodayActivity = jest.fn().mockResolvedValue({ steps: 3500, distanceMeters: 2450, activeMinutes: 25 });
    const provider = makeProvider({ readTodayActivity });

    const result = await readLiveActivity(provider);

    expect(result).toEqual({
      status: "available",
      reading: { steps: 3500, distanceMeters: 2450, activeMinutes: 25 },
    });
    expect(readTodayActivity).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable (not a fabricated zero reading) when the provider is unavailable — the exact bug report scenario", async () => {
    const provider = makeProvider({ isAvailable: jest.fn().mockResolvedValue(false) });

    const result = await readLiveActivity(provider);

    expect(result).toEqual({ status: "unavailable", reading: null });
  });

  it("reports unavailable when permission has not been granted, even if the sensor itself exists", async () => {
    const readTodayActivity = jest.fn();
    const provider = makeProvider({
      isAvailable: jest.fn().mockResolvedValue(true),
      getPermissionState: jest.fn().mockResolvedValue("denied"),
      readTodayActivity,
    });

    const result = await readLiveActivity(provider);

    expect(result).toEqual({ status: "unavailable", reading: null });
    expect(readTodayActivity).not.toHaveBeenCalled();
  });

  it("reports unavailable rather than throwing when the provider itself throws", async () => {
    const provider = makeProvider({
      isAvailable: jest.fn().mockRejectedValue(new Error("native module not linked")),
    });

    const result = await readLiveActivity(provider);

    expect(result).toEqual({ status: "unavailable", reading: null });
  });

  it("does not call readTodayActivity at all when the sensor is unavailable (no stale/cached number can leak through)", async () => {
    const readTodayActivity = jest.fn();
    const provider = makeProvider({ isAvailable: jest.fn().mockResolvedValue(false), readTodayActivity });

    await readLiveActivity(provider);

    expect(readTodayActivity).not.toHaveBeenCalled();
  });
});
