import { isDateWithinDateRange, safeDate } from "../consolidated-filter-shared";

describe("filterShared", () => {
  describe("safeDate", () => {
    it(`returns undefined when it gets undefined`, async () => {
      const res = safeDate(undefined);
      expect(res).toBeUndefined();
    });

    it(`returns value when gets valid date`, async () => {
      const date = "2024-01-01";
      const res = safeDate(date);
      expect(res).toEqual(date);
    });

    it(`returns value when gets valid datetime to seconds`, async () => {
      const date = "2024-01-01T01:02:03Z";
      const res = safeDate(date);
      expect(res).toEqual(date);
    });

    it(`returns value when gets valid datetime to millis`, async () => {
      const date = "2024-01-17T01:13:22Z";
      const res = safeDate(date);
      expect(res).toEqual(date);
    });

    it(`returns value when gets valid datetime w/o T to millis`, async () => {
      const date = "2024-01-17 01:13:22Z";
      const res = safeDate(date);
      expect(res).toEqual(date);
    });

    it(`returns datetime when it gets number`, async () => {
      const date = 1726608684;
      const res = safeDate(date);
      expect(res).toEqual(new Date(date).toISOString());
    });

    it(`returns undefined when it gets invalid date1`, async () => {
      const res = safeDate("");
      expect(res).toBeUndefined();
    });

    it(`returns undefined when it gets invalid date2`, async () => {
      const res = safeDate("17684");
      expect(res).toBeUndefined();
    });

    it(`returns undefined when it gets invalid date3`, async () => {
      const res = safeDate("a202");
      expect(res).toBeUndefined();
    });
  });

  describe("isDateWithinDateRange", () => {
    describe("date", () => {
      it(`returns true when it's within range`, async () => {
        const date = "2024-01-02";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it matches start of range`, async () => {
        const date = "2024-01-01";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it matches end of range`, async () => {
        const date = "2024-01-03";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns false when it's before start of range`, async () => {
        const date = "2023-12-31";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
      it(`returns false when it's after end of range`, async () => {
        const date = "2024-01-04";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
      it(`returns undefined when gets undefined`, async () => {
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(undefined, range);
        expect(res).toEqual(undefined);
      });
      it(`returns undefined when gets invalid date`, async () => {
        const date = "a2024";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(undefined);
      });
      // only from
      it(`returns true when it's after from`, async () => {
        const date = "2024-01-02";
        const range = { dateFrom: "2024-01-01" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it's same as from`, async () => {
        const date = "2024-01-01";
        const range = { dateFrom: "2024-01-01" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns false when it's before from`, async () => {
        const date = "2023-12-31";
        const range = { dateFrom: "2024-01-01" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
      // only to
      it(`returns true when it's before to`, async () => {
        const date = "2024-01-02";
        const range = { dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it's same as to`, async () => {
        const date = "2024-01-03";
        const range = { dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns false when it's after to`, async () => {
        const date = "2024-01-04";
        const range = { dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
    });

    describe("datetime", () => {
      it(`returns true when it's within range`, async () => {
        const date = "2024-01-02T01:02:03Z";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it matches start of range`, async () => {
        const date = "2024-01-01T01:02:03Z";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it matches end of range`, async () => {
        const date = "2024-01-03T01:02:03Z";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns false when it's before start of range`, async () => {
        const date = "2023-12-31T23:59:03Z";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
      it(`returns false when it's after end of range`, async () => {
        const date = "2024-01-04T00:01:03Z";
        const range = { dateFrom: "2024-01-01", dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
      // only from
      it(`returns true when it's after from`, async () => {
        const date = "2024-01-02T00:01:03Z";
        const range = { dateFrom: "2024-01-01" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it's same as from`, async () => {
        const date = "2024-01-01T00:01:03Z";
        const range = { dateFrom: "2024-01-01" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns false when it's before from`, async () => {
        const date = "2023-12-31T23:59:03Z";
        const range = { dateFrom: "2024-01-01" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
      // only to
      it(`returns true when it's before to`, async () => {
        const date = "2024-01-02T23:59:03Z";
        const range = { dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns true when it's same as to`, async () => {
        const date = "2024-01-03T23:59:03Z";
        const range = { dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(true);
      });
      it(`returns false when it's after to`, async () => {
        const date = "2024-01-04T00:01:03Z";
        const range = { dateTo: "2024-01-03" };
        const res = isDateWithinDateRange(date, range);
        expect(res).toEqual(false);
      });
    });
  });
});
