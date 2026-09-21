/**
 * Section 7: estimated-distance calculation.
 *
 * The native step sensor has no distance sensor of its own — Android's
 * TYPE_STEP_COUNTER reports a step count, not meters. Distance is
 * therefore always an ESTIMATE derived from step count and an assumed
 * stride length, never GPS (this app does not use location for step/
 * distance tracking) and never presented as if it were sensor-measured.
 * Every caller-facing label for this value must say "Estimated distance."
 *
 * Formula (a standard, widely-used approximation — not this app's
 * invention):
 *
 *   strideLengthMeters = heightCm * STRIDE_LENGTH_RATIO / 100
 *   distanceMeters     = steps * strideLengthMeters
 *
 * STRIDE_LENGTH_RATIO (0.414) is a commonly cited average ratio of a
 * person's walking stride length to their height, used here because the
 * backend profile has no sex/gender field to further refine it (see
 * backend/app/models/profile.py) — using a single unisex ratio rather
 * than guessing a sex-based split the app never actually collected.
 *
 * When height is unavailable (profile not yet filled in), a documented
 * population-average stride length is used instead of skipping distance
 * entirely — this is explicitly a rougher fallback, and is exactly as
 * accurate as it claims to be: an average, not a personalized estimate.
 */

const STRIDE_LENGTH_RATIO = 0.414;

/** Average adult stride length in meters, used only when the user's
 * height is not available on their profile. Sourced from the same class
 * of general population walking-stride studies the height-based ratio
 * above is drawn from — a broad average, not tailored to this user. */
export const FALLBACK_STRIDE_LENGTH_METERS = 0.762;

export function estimateStrideLengthMeters(heightCm: number | null | undefined): number {
  if (heightCm && heightCm > 0) {
    return (heightCm * STRIDE_LENGTH_RATIO) / 100;
  }
  return FALLBACK_STRIDE_LENGTH_METERS;
}

export function estimateDistanceMeters(steps: number, heightCm: number | null | undefined): number {
  if (steps <= 0) return 0;
  return steps * estimateStrideLengthMeters(heightCm);
}
