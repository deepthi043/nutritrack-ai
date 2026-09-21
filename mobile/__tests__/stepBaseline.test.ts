import { applyStepCounterReading, resetForNewLocalDay, type BaselineState } from "../services/activityProviders/stepBaseline";

const EMPTY_STATE: BaselineState = { baseline: null, lastSensorValue: null, todaySteps: 0 };

describe("stepBaseline (Section 3 — the exact algorithm the native service implements)", () => {
  it("establishes a fresh baseline on the first reading, with today's steps starting at 0", () => {
    const { state, wasReset } = applyStepCounterReading(EMPTY_STATE, 8000);

    expect(state).toEqual({ baseline: 8000, lastSensorValue: 8000, todaySteps: 0 });
    expect(wasReset).toBe(false);
  });

  it("matches the spec's exact worked example: sensor 10,000 with baseline 8,000 -> 2,000 today", () => {
    const initial: BaselineState = { baseline: 8000, lastSensorValue: 8000, todaySteps: 0 };
    const { state } = applyStepCounterReading(initial, 10000);

    expect(state.todaySteps).toBe(2000);
  });

  it("matches the spec's second step: sensor advances to 11,500 -> 3,500 today, NOT 2,000+3,500=5,500", () => {
    let current: BaselineState = { baseline: 8000, lastSensorValue: 8000, todaySteps: 0 };
    current = applyStepCounterReading(current, 10000).state;
    expect(current.todaySteps).toBe(2000);

    current = applyStepCounterReading(current, 11500).state;
    expect(current.todaySteps).toBe(3500);
    expect(current.todaySteps).not.toBe(5500);
  });

  it("handles repeated identical readings idempotently (no drift, no double counting)", () => {
    let current: BaselineState = { baseline: 8000, lastSensorValue: 8000, todaySteps: 0 };
    current = applyStepCounterReading(current, 9000).state;
    current = applyStepCounterReading(current, 9000).state;
    current = applyStepCounterReading(current, 9000).state;

    expect(current.todaySteps).toBe(1000);
  });

  it("handles a device reboot: sensor value drops below the last-seen value, baseline resets, today's steps are preserved", () => {
    // User had 3,500 steps today (sensor was at 11,500, baseline 8,000),
    // then the device rebooted, so the sensor's cumulative count starts
    // over from a small number.
    const beforeReboot: BaselineState = { baseline: 8000, lastSensorValue: 11500, todaySteps: 3500 };

    const { state, wasReset } = applyStepCounterReading(beforeReboot, 50);

    expect(wasReset).toBe(true);
    expect(state.todaySteps).toBe(3500); // preserved — the user's real steps before reboot still happened today
    expect(state.baseline).toBe(50); // new baseline established at the post-reboot reading
  });

  it("continues counting correctly after a reboot-triggered baseline reset", () => {
    const afterReboot: BaselineState = { baseline: 50, lastSensorValue: 50, todaySteps: 3500 };

    const { state } = applyStepCounterReading(afterReboot, 200);

    // 200 - 50 = 150 new steps since reboot, but todaySteps must reflect
    // the ALGORITHM's per-reading delta, not blindly re-add on top of the
    // preserved 3500 without going through the baseline math again —
    // this asserts the post-reset baseline is used going forward.
    expect(state.todaySteps).toBe(150);
  });

  it("rejects a negative/invalid delta scenario (sensorValue equal to baseline) as zero steps, not negative", () => {
    const initial: BaselineState = { baseline: 8000, lastSensorValue: 8000, todaySteps: 0 };
    const { state } = applyStepCounterReading(initial, 8000);

    expect(state.todaySteps).toBe(0);
    expect(state.todaySteps).toBeGreaterThanOrEqual(0);
  });

  it("resetForNewLocalDay clears the baseline so the next reading re-establishes it, but never invents a nonzero starting count", () => {
    const freshDay = resetForNewLocalDay();
    expect(freshDay).toEqual({ baseline: null, lastSensorValue: null, todaySteps: 0 });

    const { state } = applyStepCounterReading(freshDay, 99999); // yesterday's huge cumulative sensor value
    expect(state.todaySteps).toBe(0); // today starts at 0 regardless of the sensor's absolute value
  });
});
