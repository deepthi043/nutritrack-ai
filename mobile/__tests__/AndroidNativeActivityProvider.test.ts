import { Platform, PermissionsAndroid } from "react-native";
import { AndroidNativeActivityProvider } from "../services/activityProviders/AndroidNativeActivityProvider";
import * as profileService from "../services/profileService";

jest.mock(
  "nutritrack-step-sensor",
  () => ({
    isStepCounterAvailable: jest.fn(),
    isStepDetectorAvailable: jest.fn(),
    hasActivityRecognitionPermission: jest.fn(),
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
    getCurrentState: jest.fn(),
    getDiagnostics: jest.fn(),
    addTodayStepsListener: jest.fn(),
    addActivityStateListener: jest.fn(),
  }),
  { virtual: true }
);

jest.mock("../services/profileService", () => ({
  getProfileHeight: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativeModule = require("nutritrack-step-sensor");
const mockedGetProfileHeight = profileService.getProfileHeight as jest.Mock;

describe("AndroidNativeActivityProvider (Section 2/22 — primary Android source)", () => {
  let provider: AndroidNativeActivityProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { get: () => "android" });
    Object.defineProperty(Platform, "Version", { get: () => 33 });
    mockedGetProfileHeight.mockResolvedValue(null);
    provider = new AndroidNativeActivityProvider();
  });

  it("identifies itself with the android_native source — not health-platform-dependent", () => {
    expect(provider.source).toBe("android_native");
  });

  describe("isAvailable", () => {
    it("is available when the hardware step counter sensor exists", async () => {
      nativeModule.isStepCounterAvailable.mockReturnValue(true);
      await expect(provider.isAvailable()).resolves.toBe(true);
    });

    it("is unavailable when the device has no step counter sensor (Section 16's exact case)", async () => {
      nativeModule.isStepCounterAvailable.mockReturnValue(false);
      await expect(provider.isAvailable()).resolves.toBe(false);
    });

    it("is unavailable on a non-Android platform", async () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios" });
      await expect(provider.isAvailable()).resolves.toBe(false);
    });
  });

  describe("getPermissionState", () => {
    it("reports granted when ACTIVITY_RECOGNITION has been granted", async () => {
      nativeModule.hasActivityRecognitionPermission.mockReturnValue(true);
      await expect(provider.getPermissionState()).resolves.toBe("granted");
    });

    it("reports denied when not yet granted", async () => {
      nativeModule.hasActivityRecognitionPermission.mockReturnValue(false);
      await expect(provider.getPermissionState()).resolves.toBe("denied");
    });
  });

  describe("requestPermission", () => {
    it("requests ACTIVITY_RECOGNITION and starts tracking once granted", async () => {
      const requestSpy = jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const result = await provider.requestPermission();

      expect(requestSpy).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
      expect(nativeModule.startTracking).toHaveBeenCalledTimes(1);
      expect(result).toBe("granted");
    });

    it("does not start tracking when the OS permission dialog is denied", async () => {
      jest.spyOn(PermissionsAndroid, "request").mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

      const result = await provider.requestPermission();

      expect(nativeModule.startTracking).not.toHaveBeenCalled();
      expect(result).toBe("denied");
    });
  });

  describe("readTodayActivity — real sensor-derived readings only", () => {
    it("returns steps straight from native state, with active minutes derived from accumulated active seconds", async () => {
      nativeModule.getCurrentState.mockReturnValue({
        todaySteps: 3500,
        activeSeconds: 1680, // 28 minutes
        activityState: "IDLE",
        hasBaseline: true,
        baselineDate: "2026-09-17",
      });
      mockedGetProfileHeight.mockResolvedValue(170);

      const reading = await provider.readTodayActivity();

      expect(reading.steps).toBe(3500);
      expect(reading.activeMinutes).toBe(28);
      expect(reading.distanceMeters).toBeGreaterThan(0); // estimated, not zero-filled
    });

    it("returns a genuine zero reading (not fabricated) when the native module throws", async () => {
      nativeModule.getCurrentState.mockImplementation(() => {
        throw new Error("service not running");
      });

      const reading = await provider.readTodayActivity();

      expect(reading).toEqual({ steps: 0, distanceMeters: 0, activeMinutes: 0 });
    });

    it("estimates distance from steps and height rather than reading a distance sensor (Section 7)", async () => {
      nativeModule.getCurrentState.mockReturnValue({
        todaySteps: 1000,
        activeSeconds: 0,
        activityState: "IDLE",
        hasBaseline: true,
        baselineDate: "2026-09-17",
      });
      mockedGetProfileHeight.mockResolvedValue(180);

      const reading = await provider.readTodayActivity();

      // 180cm * 0.414 / 100 = 0.7452m/step * 1000 steps = 745.2m
      expect(reading.distanceMeters).toBeCloseTo(745.2, 1);
    });

    it("falls back to the population-average stride when the profile has no height set", async () => {
      nativeModule.getCurrentState.mockReturnValue({
        todaySteps: 1000,
        activeSeconds: 0,
        activityState: "IDLE",
        hasBaseline: true,
        baselineDate: "2026-09-17",
      });
      mockedGetProfileHeight.mockResolvedValue(null);

      const reading = await provider.readTodayActivity();

      expect(reading.distanceMeters).toBeCloseTo(762, 1);
    });
  });

  describe("subscribeToLiveUpdates — real-time push, the fix for the missed-steps bug report", () => {
    it("subscribes to both native events and delivers a full reading on each one", () => {
      const removeSteps = jest.fn();
      const removeActivity = jest.fn();
      let stepsListener: (() => void) | undefined;
      let activityListener: (() => void) | undefined;
      nativeModule.addTodayStepsListener.mockImplementation((cb: () => void) => {
        stepsListener = cb;
        return { remove: removeSteps };
      });
      nativeModule.addActivityStateListener.mockImplementation((cb: () => void) => {
        activityListener = cb;
        return { remove: removeActivity };
      });
      nativeModule.getCurrentState.mockReturnValue({
        todaySteps: 250,
        activeSeconds: 60,
        activityState: "ACTIVE",
        hasBaseline: true,
        baselineDate: "2026-09-17",
      });

      const onChange = jest.fn();
      const unsubscribe = provider.subscribeToLiveUpdates(onChange);

      expect(nativeModule.addTodayStepsListener).toHaveBeenCalledTimes(1);
      expect(nativeModule.addActivityStateListener).toHaveBeenCalledTimes(1);

      // Simulate the native sensor firing a real step event — this is
      // what walking while the app is open must trigger, with no "Sync
      // Now" and no waiting for the 60s interval.
      stepsListener?.();
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ steps: 250, activeMinutes: 1 })
      );

      activityListener?.();
      expect(onChange).toHaveBeenCalledTimes(2);

      unsubscribe?.();
      expect(removeSteps).toHaveBeenCalledTimes(1);
      expect(removeActivity).toHaveBeenCalledTimes(1);
    });

    it("returns null (no subscription) when the native module is not loaded", () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios" });
      const onChange = jest.fn();

      const unsubscribe = provider.subscribeToLiveUpdates(onChange);

      expect(unsubscribe).toBeNull();
    });

    it("does not crash onChange when a native call fails mid-stream", () => {
      let stepsListener: (() => void) | undefined;
      nativeModule.addTodayStepsListener.mockImplementation((cb: () => void) => {
        stepsListener = cb;
        return { remove: jest.fn() };
      });
      nativeModule.addActivityStateListener.mockReturnValue({ remove: jest.fn() });
      nativeModule.getCurrentState.mockImplementation(() => {
        throw new Error("service died mid-session");
      });

      const onChange = jest.fn();
      provider.subscribeToLiveUpdates(onChange);

      expect(() => stepsListener?.()).not.toThrow();
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
