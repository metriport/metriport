import {
  isEmailValid,
  isEmailAPhoneNumber,
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

    it("should return true for email with exclamation mark", () => {
      expect(isEmailValid("test!user@example.com")).toBe(true);
    });

    it("should return true for email with other valid special characters", () => {
      expect(isEmailValid("test#user@example.com")).toBe(true);
      expect(isEmailValid("test$user@example.com")).toBe(true);
      expect(isEmailValid("test%user@example.com")).toBe(true);
      expect(isEmailValid("test&user@example.com")).toBe(true);
      expect(isEmailValid("test'user@example.com")).toBe(true);
      expect(isEmailValid("test*user@example.com")).toBe(true);
      expect(isEmailValid("test+user@example.com")).toBe(true);
      expect(isEmailValid("test-user@example.com")).toBe(true);
      expect(isEmailValid("test/user@example.com")).toBe(true);
      expect(isEmailValid("test=user@example.com")).toBe(true);
      expect(isEmailValid("test?user@example.com")).toBe(true);
      expect(isEmailValid("test^user@example.com")).toBe(true);
      expect(isEmailValid("test_user@example.com")).toBe(true);
      expect(isEmailValid("test`user@example.com")).toBe(true);
      expect(isEmailValid("test{user@example.com")).toBe(true);
      expect(isEmailValid("test|user@example.com")).toBe(true);
      expect(isEmailValid("test}user@example.com")).toBe(true);
      expect(isEmailValid("test~user@example.com")).toBe(true);
    });

    it("should return false for phone number format (+1 prefix)", () => {
      expect(isEmailValid("+1234567890@example.com")).toBe(false);
      expect(isEmailValid("+1-234-567-8900@example.com")).toBe(false);
    });
  });

  describe("isEmailAPhoneNumber", () => {
    it("should return true for phone number format", () => {
      expect(isEmailAPhoneNumber("+1234567890")).toBe(true);
      expect(isEmailAPhoneNumber("+1-234-567-8900")).toBe(true);
      expect(isEmailAPhoneNumber("+1 (234) 567-8900")).toBe(true);
    });

    it("should return false for regular email", () => {
      expect(isEmailAPhoneNumber("test@example.com")).toBe(false);
      expect(isEmailAPhoneNumber("user+tag@example.com")).toBe(false);
    });

    it("should handle whitespace", () => {
      expect(isEmailAPhoneNumber(" +1234567890")).toBe(true);
      expect(isEmailAPhoneNumber(" +1-234-567-8900")).toBe(true);
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

    it("should return normalized email with special characters", () => {
      expect(normalizeEmailStrict("  Test!User@Example.COM  ")).toBe("test!user@example.com");
    });

    it("should throw an error for invalid email format", () => {
      expect(() => normalizeEmailStrict("invalid-email")).toThrow("Invalid email.");
    });

    it('should throw an error for email with "mailto:" prefix', () => {
      expect(() => normalizeEmailStrict("mailto:test@example.com")).toThrow("Invalid email.");
    });

    it("should throw specific error for phone number format", () => {
      expect(() => normalizeEmailStrict("+1234567890@example.com")).toThrow(
        "Invalid email: appears to be a phone number (starts with +1). Please enter a valid email address."
      );
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

    it("should replace mailto: prefix", () => {
      const expectedOutput = exampleEmail;
      const input = "mailto:" + expectedOutput;
      expect(normalizeEmailNewSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined for emails that are invalid", () => {
      const input = "this.is.not.an.email";
      expect(normalizeEmailNewSafe(input)).toBeUndefined();
    });

    it("should handle emails with special characters", () => {
      const input = "test!user@example.com";
      expect(normalizeEmailNewSafe(input)).toBe("test!user@example.com");
    });

    it("should return undefined for phone number format", () => {
      const input = "+1234567890@example.com";
      expect(normalizeEmailNewSafe(input)).toBeUndefined();
    });
  });
});
