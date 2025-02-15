import { normalizeSsn, normalizeSsnSafe } from "../ssn";

describe("normalizeSsn", () => {
  describe("safe normalizeSsnSafe", () => {
    it(`returns undefined if ssn is empty`, async () => {
      const result = normalizeSsnSafe("");
      expect(result).toBe(undefined);
    });

    it(`returns undefined if ssn is less than 9 digits`, async () => {
      const result = normalizeSsnSafe("12345678");
      expect(result).toBe(undefined);
    });

    it(`discards right-most digits if more than 9 digits`, async () => {
      const result = normalizeSsnSafe("12345678901234567890");
      expect(result).toBe("123456789");
    });
  });

  describe("normalizeSsn", () => {
    it(`throws if ssn is empty`, async () => {
      expect(() => normalizeSsn("")).toThrow();
    });

    it(`throws if ssn is less than 9 digits`, async () => {
      expect(() => normalizeSsn("12345678")).toThrow();
    });

    describe("multiple formats", () => {
      const ssnValid = "000000000";
      const ssnsToCheck = [ssnValid, " 000000000 ", "000-00-0000", "a00b0000c000d"];
      for (const ssn of ssnsToCheck) {
        it(`ssn: ${ssn}`, async () => {
          const result = normalizeSsn(ssn);
          expect(result).toBe(ssnValid);
        });
      }
    });
  });
});
