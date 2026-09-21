/**
 * Pure TypeScript mirror of the baseline-delta algorithm implemented in
 * Kotlin at modules/nutritrack-step-sensor/android/src/main/java/ai/
 * nutritrack/stepsensor/StepTrackingService.kt (handleStepCounterEvent).
 *
 * Not used at runtime by the app — the real implementation runs natively
 * because it must keep working while the JS engine is suspended (foreground
 * service, Section 6). This module exists so the exact algorithm described
 * in Section 3 (baseline subtraction, reboot/reset handling) has an
 * executable, unit-testable specification that a change to the Kotlin
 * logic should be checked against, and so the worked examples in the spec
 * are verified by a real test run rather than only by reading Kotlin.
 */

export interface BaselineState {
  baseline: number | null; // null = no baseline established yet
  lastSensorValue: number | null;
  todaySteps: number;
}

export interface BaselineResult {
  state: BaselineState;
  wasReset: boolean; // true if this reading indicated a sensor/boot reset
}

/**
 * Section 3 worked example:
 *   sensor=10000, baseline=8000            -> todaySteps = 2000
 *   sensor=11500, baseline unchanged (8000) -> todaySteps = 3500 (NOT 2000+3500)
 *
 * Section 3 reset handling: TYPE_STEP_COUNTER is monotonically increasing
 * only within one boot cycle. A new reading LOWER than the last one seen
 * means the counter reset (reboot, or OS-level sensor reset) — today's
 * already-accumulated steps are preserved, and a fresh baseline is
 * established at the new (lower) reading so future deltas stay correct.
 */
export function applyStepCounterReading(state: BaselineState, sensorValue: number): BaselineResult {
  if (state.baseline === null) {
    return {
      state: { baseline: sensorValue, lastSensorValue: sensorValue, todaySteps: 0 },
      wasReset: false,
    };
  }

  const referenceValue = state.lastSensorValue ?? state.baseline;
  if (sensorValue < referenceValue) {
    return {
      state: { baseline: sensorValue, lastSensorValue: sensorValue, todaySteps: state.todaySteps },
      wasReset: true,
    };
  }

  const todaySteps = sensorValue - state.baseline;
  return {
    state: { baseline: state.baseline, lastSensorValue: sensorValue, todaySteps },
    wasReset: false,
  };
}

/** Section 4: called when the device's local calendar day has advanced.
 * Resets ONLY the local baseline/state — never the hardware sensor, which
 * an app cannot reset and which keeps counting since boot regardless. */
export function resetForNewLocalDay(): BaselineState {
  return { baseline: null, lastSensorValue: null, todaySteps: 0 };
}
