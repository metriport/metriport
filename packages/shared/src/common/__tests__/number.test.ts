import { randomIntBetween } from "../numbers";

describe("number", () => {
  describe("randomIntBetween", () => {
    const tests = [
      { min: -10, max: 10 },
      { min: -10, max: -1 },
      { min: -10, max: 0 },
      { min: 0, max: 10 },
      { min: 1, max: 100 },
    ];

    describe("returns a number between", () => {
      tests.forEach(({ min, max }) => {
        it(`${min} and ${max}`, async () => {
          const result = randomIntBetween(min, max);
          expect(result).toBeGreaterThanOrEqual(min);
          expect(result).toBeLessThanOrEqual(max);
        });
      });
    });

    it(`throws if min is greater than max`, async () => {
      expect(() => randomIntBetween(1, 0)).toThrow();
    });

    it(`throws if min is NaN`, async () => {
      expect(() => randomIntBetween(NaN, 10)).toThrow();
    });

    it(`throws if max is NaN`, async () => {
      expect(() => randomIntBetween(1, NaN)).toThrow();
    });
  });
});
