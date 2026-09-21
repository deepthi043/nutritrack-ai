import { api } from "../services/api";
import { getTodayActivity, getWeeklyActivity } from "../services/activityService";

jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = api.get as jest.Mock;

describe("activityService — local date passthrough (section 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getTodayActivity sends the device's local calendar date, not toISOString's UTC date", async () => {
    const fixedLocalMidnightish = new Date(2026, 8, 17, 23, 30, 0); // 2026-09-17 23:30 local
    jest.useFakeTimers().setSystemTime(fixedLocalMidnightish);
    mockedGet.mockResolvedValue({ data: {} });

    await getTodayActivity();

    expect(mockedGet).toHaveBeenCalledWith("/api/activity/today", {
      params: { local_date: "2026-09-17" },
    });

    jest.useRealTimers();
  });

  it("getWeeklyActivity sends the same local-date param", async () => {
    const fixedDate = new Date(2026, 0, 5, 10, 0, 0); // 2026-01-05 local
    jest.useFakeTimers().setSystemTime(fixedDate);
    mockedGet.mockResolvedValue({ data: [] });

    await getWeeklyActivity();

    expect(mockedGet).toHaveBeenCalledWith("/api/activity/weekly", {
      params: { local_date: "2026-01-05" },
    });

    jest.useRealTimers();
  });
});
