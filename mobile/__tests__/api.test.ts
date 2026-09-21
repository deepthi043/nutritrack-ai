import MockAdapter from "axios-mock-adapter";
import { api, setUnauthorizedHandler, getApiErrorMessage } from "../services/api";
import * as secureStorage from "../storage/secureStorage";

jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiBaseUrl: "http://test-api.local" } } }));

describe("api client", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
    jest.restoreAllMocks();
  });

  it("attaches the stored bearer token to every request", async () => {
    jest.spyOn(secureStorage, "getToken").mockResolvedValue("my-jwt-token");
    mock.onGet("/api/auth/me").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer my-jwt-token");
      return [200, { id: 1 }];
    });

    await api.get("/api/auth/me");
  });

  it("sends no Authorization header when there is no stored token", async () => {
    jest.spyOn(secureStorage, "getToken").mockResolvedValue(null);
    mock.onGet("/api/auth/me").reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, {}];
    });

    await api.get("/api/auth/me");
  });

  it("clears the token and notifies the unauthorized handler on a 401 (expired/invalid token)", async () => {
    jest.spyOn(secureStorage, "getToken").mockResolvedValue("stale-token");
    const clearTokenSpy = jest.spyOn(secureStorage, "clearToken").mockResolvedValue(undefined);
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    mock.onGet("/api/activity/today").reply(401, { detail: "Could not validate credentials" });

    await expect(api.get("/api/activity/today")).rejects.toBeTruthy();
    expect(clearTokenSpy).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it("does not clear the token on a non-401 error", async () => {
    jest.spyOn(secureStorage, "getToken").mockResolvedValue("valid-token");
    const clearTokenSpy = jest.spyOn(secureStorage, "clearToken").mockResolvedValue(undefined);

    mock.onGet("/api/activity/today").reply(500, { detail: "Server error" });

    await expect(api.get("/api/activity/today")).rejects.toBeTruthy();
    expect(clearTokenSpy).not.toHaveBeenCalled();
  });
});

describe("getApiErrorMessage", () => {
  it("extracts the backend's detail message", () => {
    const error = { isAxiosError: true, response: { data: { detail: "Incorrect email or password" } } };
    expect(getApiErrorMessage(error)).toBe("Incorrect email or password");
  });

  it("falls back to a friendly message for a plain network error", () => {
    const error = { isAxiosError: true, message: "Network Error", response: undefined };
    expect(getApiErrorMessage(error)).toBe("Unable to reach the server. Check your connection and try again.");
  });

  it("falls back to a generic message for a non-axios error", () => {
    expect(getApiErrorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });
});
