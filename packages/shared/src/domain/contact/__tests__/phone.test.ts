import { isPhoneValid, normalizePhoneSafe } from "../phone";

describe("Phone Normalization", () => {
  describe("isPhoneValid", () => {
    it("returns true when phone has 10 digits", () => {
      const res = isPhoneValid("1234567890");
      expect(res).toBeTruthy();
    });

    it("returns false when phone is undefined", () => {
      const res = isPhoneValid(undefined as unknown as string);
      expect(res).toBeFalsy();
    });

    it("returns false when phone is string", () => {
      const res = isPhoneValid(null as unknown as string);
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains non-number prefix", () => {
      const res = isPhoneValid("a234567890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains non-number suffix", () => {
      const res = isPhoneValid("123456789c");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains non-number in the middle", () => {
      const res = isPhoneValid("1234-67890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains dashes", () => {
      const res = isPhoneValid("123-456-7890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains spaces and dashes", () => {
      const res = isPhoneValid("123 456-7890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains parentheses and dashes", () => {
      const res = isPhoneValid("(123)-456-7890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains multiple dashes", () => {
      const res = isPhoneValid("12-3456-7890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone has leading dash", () => {
      const res = isPhoneValid("-1234567890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone has trailing dash", () => {
      const res = isPhoneValid("1234567890-");
      expect(res).toBeFalsy();
    });

    it("returns false when phone is formatted with international code and dashes", () => {
      const res = isPhoneValid("+1-123-456-7890");
      expect(res).toBeFalsy();
    });

    describe(`test various non-numeric chars`, () => {
      const nonNumeriChars = "-_ #( )[]{}!@#$%^&*+=|\\;:'\",.<>?/`~";
      for (const c of nonNumeriChars) {
        it(`returns false if it contains '${c}'`, () => {
          const phone = c + "0987654321";
          expect(isPhoneValid(phone)).toEqual(false);
        });
      }
    });

    it("returns false when phone contains less than 8 digits", () => {
      const res = isPhoneValid("1234567");
      expect(res).toBeFalsy();
    });
  });

  describe("normalizePhoneSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      expect(normalizePhoneSafe(input)).toBeUndefined();
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      expect(normalizePhoneSafe(input)).toBeUndefined();
    });

    it(`does not remove country code when it starts with 1 and has 10 digits`, () => {
      const expectedOutput = "1098765431";
      expect(normalizePhoneSafe(expectedOutput)).toBe(expectedOutput);
    });

    it(`removes country code when it starts with 1 and has 11 digits`, () => {
      const expectedOutput = "1098765431";
      const input = "1" + expectedOutput;
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });

    it(`does not remove country code when it starts with diff than 1 and has 10 digits`, () => {
      const expectedOutput = "2098765431";
      expect(normalizePhoneSafe(expectedOutput)).toBe(expectedOutput);
    });

    it(`removes country code when it starts with 1 and has 12 digits`, () => {
      const expectedOutput = "1098765431";
      const input = "1" + expectedOutput + "1";
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });

    describe(`does not remove country when it does not start with 1`, () => {
      const phonesWithFewerDigits = ["2", "3", "4", "5", "6", "7", "8", "9", "0", "55", "21"];
      for (const code of phonesWithFewerDigits) {
        it(`starts with ${code}`, () => {
          const inputPhone = code + "1098765431";
          const expectedOutput = inputPhone.slice(0, 10);
          expect(normalizePhoneSafe(inputPhone)).toBe(expectedOutput);
        });
      }
    });

    it(`returns 10 leftmost digits when does not start with 1 and has more than 10 digits`, () => {
      const expectedOutput = "2098765431";
      const input = expectedOutput + " ext 999";
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });

    it(`removes first digit and returns remaining leftmost digits when starts with 1 and has more than 10 digits`, () => {
      const expectedOutput = "2098765431";
      const input = "1" + expectedOutput + " ext 999";
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });

    it(`handle short phones (v1)`, () => {
      const expectedOutput = "0198765431";
      const input = expectedOutput.slice(1, 10);
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });

    it(`handle short phones (v2)`, () => {
      const expectedOutput = "0098765431";
      const input = expectedOutput.slice(2, 10);
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });

    it("should trim input prefix", () => {
      const expectedOutput = "1098765432";
      const input = " " + expectedOutput;
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = "1098765432";
      const input = expectedOutput + " ";
      expect(normalizePhoneSafe(input)).toBe(expectedOutput);
    });
  });
});
