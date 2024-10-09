import { buildDayjs } from "@metriport/shared/common/date";
import { addAgeToDob } from "../age";

describe("age", () => {
  describe("addAgeToDob", () => {
    it(`returns undefined when dob is empty`, async () => {
      const res = addAgeToDob({ value: 10, unit: "a" }, undefined);
      expect(res).toBeUndefined();
    });
    it(`returns undefined when age is empty`, async () => {
      const res = addAgeToDob(undefined, "2001-01-01");
      expect(res).toBeUndefined();
    });
    it(`returns undefined when age.value is empty`, async () => {
      const res = addAgeToDob({ unit: "a" }, "2001-01-01");
      expect(res).toBeUndefined();
    });
    it(`returns undefined when age.unit is empty`, async () => {
      const res = addAgeToDob({ value: 10 }, "2001-01-01");
      expect(res).toBeUndefined();
    });
    it(`returns undefined when age.unit is invalid`, async () => {
      const res = addAgeToDob({ value: 10, unit: "milliseconds" }, "2001-01-01");
      expect(res).toBeUndefined();
    });

    describe("official units", () => {
      it(`adds years using unit 'a'`, async () => {
        const dob = "2001-01-01";
        const res = addAgeToDob({ value: 10, unit: "a" }, dob);
        expect(res).toBeTruthy();
        expect(res).toEqual(buildDayjs(dob).add(10, "year").toISOString());
      });
      it(`adds years using unit 'mo'`, async () => {
        const dob = "2001-01-01";
        const res = addAgeToDob({ value: 24, unit: "mo" }, dob);
        expect(res).toBeTruthy();
        expect(res).toEqual(buildDayjs(dob).add(2, "year").toISOString());
      });
      it(`adds years using unit 'wk'`, async () => {
        const dob = "2001-01-01";
        const res = addAgeToDob({ value: 52, unit: "wk" }, dob);
        expect(res).toBeTruthy();
        expect(res).toEqual(buildDayjs(dob).add(52, "week").toISOString());
      });
      it(`adds years using unit 'd'`, async () => {
        const dob = "2001-01-01";
        const res = addAgeToDob({ value: 60, unit: "d" }, dob);
        expect(res).toBeTruthy();
        expect(res).toEqual(buildDayjs(dob).add(60, "day").toISOString());
      });
      it(`adds years using unit 'min'`, async () => {
        const dob = "2001-01-01";
        const res = addAgeToDob({ value: 4320, unit: "min" }, dob);
        expect(res).toBeTruthy();
        expect(res).toEqual(buildDayjs(dob).add(4320, "minute").toISOString());
      });
    });
  });
});
