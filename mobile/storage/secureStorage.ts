/**
 * Secure storage for the auth token, using the OS keychain/keystore via
 * expo-secure-store — never AsyncStorage or plain state, since the JWT
 * grants full access to the user's account.
 *
 * AsyncStorage (unencrypted) is used elsewhere in this app only for
 * non-sensitive data: the offline sync queue and "last synced" timestamp.
 */

import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "nutritrack_access_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
