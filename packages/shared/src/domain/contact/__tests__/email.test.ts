import { normalizeEmailSafe, isEmailValid, exampleEmail } from "../email";

describe("Email Normalization", () => {
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

describe("Email Utility Functions", () => {
  describe("isEmailValid", () => {
    it("should return false for empty string", () => {
      expect(isEmailValid("")).toBe(false);
    });

    it("should return false for invalid email format", () => {
      expect(isEmailValid("invalid-email")).toBe(false);
    });

    it("should return true for valid email", () => {
      expect(isEmailValid("test@example.com")).toBe(true);
    });

    it('should return false for email with "mailto:" prefix', () => {
      expect(isEmailValid("mailto:test@example.com")).toBe(false);
    });
  });
});
