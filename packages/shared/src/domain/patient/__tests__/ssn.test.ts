import { normalizeSsn } from "../ssn";

describe("normalizeSsn", () => {
  const ssnValid = "000000000";
  const ssnsToCheck = [ssnValid, " 000000000 ", "000-00-0000", "1000000000"];
  for (const ssn of ssnsToCheck) {
    it(`ssn: ${ssn}`, async () => {
      const result = normalizeSsn(ssn);
      expect(result).toBe(ssnValid);
    });
  }
});
