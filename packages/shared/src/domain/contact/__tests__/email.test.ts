import { normalizeEmailSafe, exampleEmail } from "../email";

describe("email", () => {
  describe("normalizeEmailSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      expect(normalizeEmailSafe(input)).toBeUndefined();
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      expect(normalizeEmailSafe(input)).toBeUndefined();
    });

    it("should handle example", () => {
      const input = exampleEmail;
      const expectedOutput = input;
      expect(normalizeEmailSafe(input)).toBe(expectedOutput);
    });

    it("should lowercase input", () => {
      const expectedOutput = exampleEmail;
      const input = expectedOutput.toUpperCase();
      expect(normalizeEmailSafe(input)).toBe(expectedOutput);
    });

    it("should trim input prefix", () => {
      const expectedOutput = exampleEmail;
      const input = " " + expectedOutput;
      expect(normalizeEmailSafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = exampleEmail;
      const input = expectedOutput + " ";
      expect(normalizeEmailSafe(input)).toBe(expectedOutput);
    });

    it("should relace mailto: prefix", () => {
      const expectedOutput = exampleEmail;
      const input = "mailto:" + expectedOutput;
      expect(normalizeEmailSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined for emails that invalid", () => {
      const input = "this.is.not.an.email";
      expect(normalizeEmailSafe(input)).toBeUndefined();
    });
  });
});
