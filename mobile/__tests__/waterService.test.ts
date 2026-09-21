import { api } from "../services/api";
import { getTodayWater, getTodayWaterEntries, getWeeklyWater, addWater, deleteWater } from "../services/waterService";

jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

const mockedGet = api.get as jest.Mock;
const mockedPost = api.post as jest.Mock;
const mockedDelete = api.delete as jest.Mock;

describe("waterService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getTodayWater returns the backend response verbatim (server remains authoritative)", async () => {
    const backendResponse = {
      date: "2026-09-17",
      total_ml: 1750,
      goal_ml: 2500,
      progress_percent: 70,
      recommended_goal_ml: 2100,
      is_using_recommended_goal: false,
    };
    mockedGet.mockResolvedValue({ data: backendResponse });

    const result = await getTodayWater();

    expect(mockedGet).toHaveBeenCalledWith("/api/water/today");
    expect(result).toEqual(backendResponse);
  });

  it("getTodayWaterEntries fetches today's individual log entries", async () => {
    mockedGet.mockResolvedValue({ data: [] });
    await getTodayWaterEntries();
    expect(mockedGet).toHaveBeenCalledWith("/api/water/today/entries");
  });

  it("getWeeklyWater fetches the 7-day chart data", async () => {
    mockedGet.mockResolvedValue({ data: [] });
    await getWeeklyWater();
    expect(mockedGet).toHaveBeenCalledWith("/api/water/weekly");
  });

  it("addWater posts a real record with the exact amount tapped (Part 14 quick-add)", async () => {
    mockedPost.mockResolvedValue({ data: { id: 1, amount_ml: 250 } });

    await addWater(250);

    expect(mockedPost).toHaveBeenCalledWith("/api/water", { amount_ml: 250 });
  });

  it("deleteWater calls the record-specific delete endpoint", async () => {
    mockedDelete.mockResolvedValue({});

    await deleteWater(42);

    expect(mockedDelete).toHaveBeenCalledWith("/api/water/42");
  });
});
