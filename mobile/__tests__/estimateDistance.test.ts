import {
  estimateStrideLengthMeters,
  estimateDistanceMeters,
  FALLBACK_STRIDE_LENGTH_METERS,
} from "../services/activityProviders/estimateDistance";

describe("estimateDistance (Section 7)", () => {
  describe("estimateStrideLengthMeters", () => {
    it("derives stride length from height using the documented ratio", () => {
      // 170cm * 0.414 / 100 = 0.7038m
      expect(estimateStrideLengthMeters(170)).toBeCloseTo(0.7038, 4);
    });

    it("falls back to the documented population-average stride when height is missing", () => {
      expect(estimateStrideLengthMeters(null)).toBe(FALLBACK_STRIDE_LENGTH_METERS);
      expect(estimateStrideLengthMeters(undefined)).toBe(FALLBACK_STRIDE_LENGTH_METERS);
    });

    it("falls back for a non-positive height rather than producing a negative/zero stride", () => {
      expect(estimateStrideLengthMeters(0)).toBe(FALLBACK_STRIDE_LENGTH_METERS);
      expect(estimateStrideLengthMeters(-10)).toBe(FALLBACK_STRIDE_LENGTH_METERS);
    });
  });

  describe("estimateDistanceMeters", () => {
    it("multiplies steps by the height-derived stride length", () => {
      const distance = estimateDistanceMeters(1000, 170);
      expect(distance).toBeCloseTo(703.8, 1);
    });

    it("uses the fallback stride length when height is unavailable", () => {
      const distance = estimateDistanceMeters(1000, null);
      expect(distance).toBeCloseTo(762, 1);
    });

    it("returns exactly zero for zero steps, never a fabricated nonzero baseline", () => {
      expect(estimateDistanceMeters(0, 170)).toBe(0);
    });

    it("returns zero for a negative step count rather than a negative distance", () => {
      expect(estimateDistanceMeters(-5, 170)).toBe(0);
    });
  });
});
