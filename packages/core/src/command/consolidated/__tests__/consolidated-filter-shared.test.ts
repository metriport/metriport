import { safeDate } from "../consolidated-filter-shared";

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
});
