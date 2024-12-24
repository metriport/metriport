import { isValidISODate } from "../date";

describe("shared date functions", () => {
  describe("isValidISODate", () => {
    it("returns true for dates from E2E tests", async () => {
      expect(isValidISODate("2024-12-18T03:50:00.006Z")).toEqual(true);
      expect(isValidISODate("2024-12-18T04:18:01.263Z")).toEqual(true);
    });
  });
});
