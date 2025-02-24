import { isEmailValid, normalizeEmail, normalizeEmailWithMailto } from "../email";

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

  describe("normalizeEmailWithMailto", () => {
    it("should trim whitespace and convert to lowercase", () => {
      expect(normalizeEmailWithMailto("  Test@Example.COM  ")).toBe("test@example.com");
    });

    it('should handle email with "mailto:" prefix without modification', () => {
      expect(normalizeEmailWithMailto("mailto:test@example.com")).toBe("test@example.com");
    });
  });

  describe("normalizeEmail", () => {
    it("should trim whitespace and convert to lowercase", () => {
      expect(normalizeEmail("  Test@Example.COM  ")).toBe("test@example.com");
    });

    it('should handle email with "mailto:" prefix without modification', () => {
      expect(normalizeEmail("mailto:test@example.com")).toBe("test@example.com");
    });
  });
});
