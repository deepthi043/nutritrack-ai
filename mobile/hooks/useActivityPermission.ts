import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPlatformActivityProvider } from "../services/activityProviders";
import type { PermissionState } from "../types";

const DENIED_STORAGE_KEY = "nutritrack_activity_permission_denied";

/**
 * Tracks the platform activity permission state and exposes a
 * request() action. Deliberately never auto-requests on mount — the
 * explanation screen (components/activity/PermissionGate.tsx) must be
 * shown and the user must tap "Connect Activity Data" first (section 7).
 *
 * Persists "previously denied" in AsyncStorage (survives app restarts) so
 * the UI can stop re-showing the OS permission dialog — which the OS may
 * silently no-op on repeat anyway — and instead point the user to device
 * settings (section 7's "do not repeatedly request denied permissions").
 */
export function useActivityPermission() {
  const [state, setState] = useState<PermissionState>("unknown");
  const [wasPreviouslyDenied, setWasPreviouslyDenied] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const isMounted = useRef(true);

  const provider = getPlatformActivityProvider();

  // The check itself never synchronously calls setState before its first
  // await — every setState here happens inside an async continuation, not
  // at the top of the function body — so this is safe to fire from the
  // mount effect below.
  const check = useCallback(async () => {
    try {
      const deniedFlag = await AsyncStorage.getItem(DENIED_STORAGE_KEY);
      if (!isMounted.current) return;
      setWasPreviouslyDenied(deniedFlag === "true");

      const available = await provider.isAvailable();
      if (!isMounted.current) return;
      if (!available) {
        setState("unavailable");
        return;
      }
      const current = await provider.getPermissionState();
      if (!isMounted.current) return;
      setState(current === "unknown" ? "denied" : current);
    } finally {
      if (isMounted.current) setIsChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void check();
    return () => {
      isMounted.current = false;
    };
  }, [check]);

  /** Re-runs the check on demand (e.g. after returning from device
   * settings). Safe to call synchronously from event handlers — this is
   * NOT called from an effect, so flipping isChecking back on immediately
   * is fine here. */
  const refresh = useCallback(() => {
    setIsChecking(true);
    return check();
  }, [check]);

  async function request(): Promise<PermissionState> {
    const result = await provider.requestPermission();
    setState(result);
    if (result === "denied") {
      await AsyncStorage.setItem(DENIED_STORAGE_KEY, "true");
      setWasPreviouslyDenied(true);
    } else if (result === "granted") {
      await AsyncStorage.removeItem(DENIED_STORAGE_KEY);
      setWasPreviouslyDenied(false);
    }
    return result;
  }

  return { state, isChecking, wasPreviouslyDenied, request, refresh, providerSource: provider.source };
}
