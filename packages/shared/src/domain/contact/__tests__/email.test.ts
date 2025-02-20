import {
  isEmailValid,
  normalizeEmail,
  normalizeEmailStrict,
  normalizeEmailNewSafe,
  exampleEmail,
} from "../email";

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

  describe("normalizeEmail", () => {
    it("should trim whitespace and convert to lowercase", () => {
      expect(normalizeEmail("  Test@Example.COM  ")).toBe("test@example.com");
    });

    it('should handle email with "mailto:" prefix without modification', () => {
      expect(normalizeEmail("mailto:test@example.com")).toBe("mailto:test@example.com");
    });
  });

  describe("normalizeEmailStrict", () => {
    it("should return normalized email when valid", () => {
      expect(normalizeEmailStrict("  Test@Example.COM  ")).toBe("test@example.com");
    });

    it("should throw an error for invalid email format", () => {
      expect(() => normalizeEmailStrict("invalid-email")).toThrow("Invalid email.");
    });

    it('should throw an error for email with "mailto:" prefix', () => {
      expect(() => normalizeEmailStrict("mailto:test@example.com")).toThrow("Invalid email.");
    });
  });
});

describe("email", () => {
  describe("normalizeEmailNewSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      expect(normalizeEmailNewSafe(input)).toBeUndefined();
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      expect(normalizeEmailNewSafe(input)).toBeUndefined();
    });

    it("should handle example", () => {
      const input = exampleEmail;
      const expectedOutput = input;
      expect(normalizeEmailNewSafe(input)).toBe(expectedOutput);
    });

    it("should lowercase input", () => {
      const expectedOutput = exampleEmail;
      const input = expectedOutput.toUpperCase();
      expect(normalizeEmailNewSafe(input)).toBe(expectedOutput);
    });

    it("should trim input prefix", () => {
      const expectedOutput = exampleEmail;
      const input = " " + expectedOutput;
      expect(normalizeEmailNewSafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = exampleEmail;
      const input = expectedOutput + " ";
      expect(normalizeEmailNewSafe(input)).toBe(expectedOutput);
    });

    it("should relace mailto: prefix", () => {
      const expectedOutput = exampleEmail;
      const input = "mailto:" + expectedOutput;
      expect(normalizeEmailNewSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined for emails that invalid", () => {
      const input = "this.is.not.an.email";
      expect(normalizeEmailNewSafe(input)).toBeUndefined();
    });
  });
});
