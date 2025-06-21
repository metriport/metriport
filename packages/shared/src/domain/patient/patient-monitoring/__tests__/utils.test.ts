import dayjs from "dayjs";
import {
  backoffFive,
  backoffFour,
  backoffOne,
  backoffSix,
  backoffThree,
  backoffTwo,
  calculateScheduledAt,
  pickEarliestScheduledAt,
  pickLargestRemainingAttempts,
} from "../utils";

describe("patientMonitoringUtils", () => {
  describe("calculateNextScheduledAt", () => {
    // Mock the current date to ensure consistent test results
    const mockDate = new Date("2024-01-01T12:00:00Z");

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("should calculate correct time for first attempt (5 minutes)", () => {
      const result = calculateScheduledAt(7);
      expect(result).toEqual(dayjs(mockDate).add(backoffOne).toDate());
    });

    it("should calculate correct time for second attempt (30 minutes)", () => {
      const result = calculateScheduledAt(6);
      expect(result).toEqual(dayjs(mockDate).add(backoffTwo).toDate());
    });

    it("should calculate correct time for third attempt (4 hours)", () => {
      const result = calculateScheduledAt(5);
      expect(result).toEqual(dayjs(mockDate).add(backoffThree).toDate());
    });

    it("should calculate correct time for fourth attempt (12 hours)", () => {
      const result = calculateScheduledAt(4);
      expect(result).toEqual(dayjs(mockDate).add(backoffFour).toDate());
    });

    it("should calculate correct time for fifth attempt (1 day)", () => {
      const result = calculateScheduledAt(3);
      expect(result).toEqual(dayjs(mockDate).add(backoffFive).toDate());
    });

    it("should calculate correct time for sixth attempt (2 days)", () => {
      const result = calculateScheduledAt(2);
      expect(result).toEqual(dayjs(mockDate).add(backoffSix).toDate());
    });
  });

  describe("pickLargestRemainingAttempts", () => {
    it("should return the largest remaining attempts", () => {
      const result = pickLargestRemainingAttempts(1, 2);
      expect(result).toEqual(2);
    });

    it("should return the largest remaining attempts when both are the same", () => {
      const result = pickLargestRemainingAttempts(2, 2);
      expect(result).toEqual(2);
    });
  });

  describe("pickClosestScheduledAt", () => {
    it("should return the closest scheduled at", () => {
      const date1 = new Date("2024-01-01T12:00:00Z");
      const date2 = new Date("2024-01-01T12:05:00Z");

      const result = pickEarliestScheduledAt(date1, date2);
      expect(result).toEqual(date1);
    });
  });
});
