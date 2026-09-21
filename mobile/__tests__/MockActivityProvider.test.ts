import { MockActivityProvider } from "../services/activityProviders/MockActivityProvider";

describe("MockActivityProvider", () => {
  const provider = new MockActivityProvider();

  it("is always available", async () => {
    await expect(provider.isAvailable()).resolves.toBe(true);
  });

  it("reports permission as already granted (no real permission needed)", async () => {
    await expect(provider.getPermissionState()).resolves.toBe("granted");
    await expect(provider.requestPermission()).resolves.toBe("granted");
  });

  it("returns zeroed activity rather than fabricated numbers", async () => {
    const reading = await provider.readTodayActivity();
    expect(reading).toEqual({ steps: 0, distanceMeters: 0, activeMinutes: 0 });
  });

  it("identifies itself with the 'mock' source, matching backend's mock provider tag", () => {
    expect(provider.source).toBe("mock");
  });
});
