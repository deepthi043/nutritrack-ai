import { api } from "../services/api";
import { getStreaks, getStreakHistory } from "../services/streakService";

jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = api.get as jest.Mock;

describe("streakService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17, 10, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("getStreaks sends the device's local date and returns the backend response verbatim (no client-side math)", async () => {
    const backendResponse = {
      overall: { current: 3, best: 5 },
      steps: { current: 3, best: 6 },
      hydration: { current: 2, best: 4 },
    };
    mockedGet.mockResolvedValue({ data: backendResponse });

    const result = await getStreaks();

    expect(mockedGet).toHaveBeenCalledWith("/api/streaks", { params: { local_date: "2026-09-17" } });
    expect(result).toEqual(backendResponse);
  });

  it("getStreakHistory sends days and local_date, defaulting days to 7", async () => {
    mockedGet.mockResolvedValue({ data: [] });

    await getStreakHistory();

    expect(mockedGet).toHaveBeenCalledWith("/api/streaks/history", {
      params: { days: 7, local_date: "2026-09-17" },
    });
  });

  it("getStreakHistory passes a custom days value through", async () => {
    mockedGet.mockResolvedValue({ data: [] });

    await getStreakHistory(30);

    expect(mockedGet).toHaveBeenCalledWith("/api/streaks/history", {
      params: { days: 30, local_date: "2026-09-17" },
    });
  });
});
