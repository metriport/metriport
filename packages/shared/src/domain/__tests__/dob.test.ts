import { normalizeDob, normalizeDobSafe } from "../dob";

describe("dob", () => {
  describe("normalizeDob", () => {
    it("should throw an error if dob is an empty string", () => {
      expect(() => normalizeDob("")).toThrow();
    });

    it("should work when gets valid dob", () => {
      const res = normalizeDob("1945-01-01");
      expect(res).toBeTruthy();
      expect(res).toEqual("1945-01-01");
    });
  });

  describe("safe normalizeDobSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      const expectedOutput = undefined;
      expect(normalizeDobSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined when gets invalid date", () => {
      expect(normalizeDobSafe("something thats not a date")).toBeUndefined();
    });

    describe("examples from the wild", () => {
      const tests = [
        { input: "1951-03-29 ", expectedOutput: "1951-03-29" },
        { input: "Jan 1, 1951", expectedOutput: "1951-01-01" },
      ];
      for (const { input, expectedOutput } of tests) {
        it(`should return ${expectedOutput} when input is ${input}`, () => {
          expect(normalizeDobSafe(input)).toBe(expectedOutput);
        });
      }
    });
  });
});
