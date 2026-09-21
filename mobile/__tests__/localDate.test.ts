import { localDateString } from "../services/localDate";

describe("localDateString", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the device's local calendar date, not a UTC-shifted one", () => {
    // 2026-09-17 23:30 local — in many timezones this is already a
    // different UTC calendar day than the local one.
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17, 23, 30, 0));
    expect(localDateString()).toBe("2026-09-17");
  });

  it("zero-pads single-digit months and days", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
    expect(localDateString()).toBe("2026-01-05");
  });
});
