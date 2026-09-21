import * as SecureStore from "expo-secure-store";
import * as secureStorage from "../storage/secureStorage";

jest.mock("expo-secure-store");

const mockedGetItem = SecureStore.getItemAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("secureStorage (auth token)", () => {
  it("stores the token via the OS secure store, not plain storage", async () => {
    await secureStorage.setToken("abc.def.ghi");
    expect(mockedSetItem).toHaveBeenCalledWith("nutritrack_access_token", "abc.def.ghi");
  });

  it("reads the token back from secure store", async () => {
    mockedGetItem.mockResolvedValue("abc.def.ghi");
    await expect(secureStorage.getToken()).resolves.toBe("abc.def.ghi");
  });

  it("returns null when no token is stored", async () => {
    mockedGetItem.mockResolvedValue(null);
    await expect(secureStorage.getToken()).resolves.toBeNull();
  });

  it("clears the token on logout", async () => {
    await secureStorage.clearToken();
    expect(mockedDeleteItem).toHaveBeenCalledWith("nutritrack_access_token");
  });
});
