import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { getPlatformActivityProvider } from "../services/activityProviders";
import type { ActivityProvider, RawActivityReading } from "../services/activityProviders";

export type LiveReadingStatus = "loading" | "available" | "unavailable";

export interface LiveActivityResult {
  status: LiveReadingStatus;
  reading: RawActivityReading | null;
}

/** A provider that can push live updates as they happen, instead of only
 * being pollable. Only `AndroidNativeActivityProvider` implements this
 * today (backed by the native step sensor's real-time events) — Health
 * Connect and HealthKit are pull-only platform APIs with no equivalent
 * push channel, so any other provider is used purely via readTodayActivity(). */
interface LivePushCapableProvider extends ActivityProvider {
  subscribeToLiveUpdates(onChange: (reading: RawActivityReading) => void): (() => void) | null;
}

function supportsLivePush(provider: ActivityProvider): provider is LivePushCapableProvider {
  return typeof (provider as Partial<LivePushCapableProvider>).subscribeToLiveUpdates === "function";
}

/**
 * Pure decision logic for one-shot reads, extracted from the hook below so
 * it's directly unit-testable without a React renderer (this codebase's
 * test suite is logic-only — see mobile/README.md "Testing"). Reads
 * TODAY'S activity directly from the active platform provider — NOT the
 * backend's `/api/activity/today` aggregate, which sums automatic (synced)
 * totals together with any manual entries for the day. That sum is
 * correct for the Dashboard/Goals/History "how active was I today"
 * question, but showing it under a "Source: Phone Step Sensor" label is
 * misleading if part of it came from a manual entry — the exact bug
 * report this function fixes (168 steps / 1.1km / 1min all coming from a
 * stale manual row, displayed as if the sensor produced them).
 */
export async function readLiveActivity(provider: ActivityProvider): Promise<LiveActivityResult> {
  try {
    const available = await provider.isAvailable();
    if (!available) {
      return { status: "unavailable", reading: null };
    }
    const permission = await provider.getPermissionState();
    if (permission !== "granted") {
      return { status: "unavailable", reading: null };
    }
    const reading = await provider.readTodayActivity();
    return { status: "available", reading };
  } catch {
    return { status: "unavailable", reading: null };
  }
}

/**
 * `ActivityScreen` uses this for the automatic-tracking block, and shows
 * the backend's combined total separately only when it differs from the
 * live automatic reading (i.e. only when a manual entry actually exists
 * for today).
 *
 * Real-time behavior: when the active provider supports push updates
 * (currently only `AndroidNativeActivityProvider`, backed by the native
 * step sensor's live events), this hook subscribes directly to the
 * sensor's own change notifications — the UI updates the instant a step
 * is detected, with NO dependency on tab focus, app-foreground, the 60s
 * sync interval, or "Sync Now". Those triggers still exist for backend
 * *sync*, which is a separate concern (see activitySyncService) — this
 * hook's job is only the on-screen number, which must work even fully
 * offline. For a provider without push support (Health Connect, HealthKit),
 * `refresh()` remains available as an explicit pull and the auto-sync
 * triggers in ActivityScreen call it as before.
 */
export function useLiveActivityReading() {
  const [reading, setReading] = useState<RawActivityReading | null>(null);
  const [status, setStatus] = useState<LiveReadingStatus>("loading");

  const refresh = useCallback(async () => {
    const result = await readLiveActivity(getPlatformActivityProvider());
    setReading(result.reading);
    setStatus(result.status);
  }, []);

  useEffect(() => {
    const provider = getPlatformActivityProvider();
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    async function pullAndSubscribe() {
      const initial = await readLiveActivity(provider);
      if (!isMounted) return;
      setReading(initial.reading);
      setStatus(initial.status);

      if (initial.status !== "available" || !supportsLivePush(provider)) return;

      // Subscribes to the native sensor's own push events (Section 4/5):
      // every future step-count or active-state change arrives here
      // directly from the phone's sensor, independent of any polling
      // interval or screen-focus trigger.
      unsubscribe = provider.subscribeToLiveUpdates((liveReading) => {
        setReading(liveReading);
        setStatus("available");
      });
    }

    void pullAndSubscribe();

    // Section 5 (foreground recovery): while the app is backgrounded,
    // Android can throttle/suspend the JS thread's event delivery even
    // though StepTrackingService keeps running and keeps accumulating
    // steps natively — so a push event fired while backgrounded may never
    // reach this JS listener. Re-pulling getCurrentState() once on every
    // return to foreground reconciles the UI against the sensor's true
    // current value regardless of whether any events were missed.
    function onAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        void (async () => {
          const result = await readLiveActivity(provider);
          if (!isMounted) return;
          setReading(result.reading);
          setStatus(result.status);
        })();
      }
    }
    const appStateSubscription = AppState.addEventListener("change", onAppStateChange);

    return () => {
      isMounted = false;
      unsubscribe?.();
      appStateSubscription.remove();
    };
  }, []);

  return { reading, status, refresh };
}
