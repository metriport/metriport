import { isPhoneValid, normalizePhoneSafe } from "../phone";

describe("phone", () => {
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
    it(`removes country code when it starts with 1 and has 11 digits`, () => {
      const expectedPhone = "0987654321";
      const result = normalizePhoneSafe("1" + expectedPhone);
      expect(result).toBe(expectedPhone);
    });

    it(`does not remove country code when it starts with diff than 1 and has 11 digits`, () => {
      const inputPhone = "20987654321";
      const expectedPhone = "2098765432";
      const result = normalizePhoneSafe(inputPhone);
      expect(result).toBe(expectedPhone);
    });

    it(`does not remove country code when it starts with 1 and has 10 digits`, () => {
      const expectedPhone = "1098765432";
      const result = normalizePhoneSafe(expectedPhone);
      expect(result).toBe(expectedPhone);
    });

    it(`removes country code when it starts with 1 and has 12 digits`, () => {
      const expectedPhone = "0987654321";
      const result = normalizePhoneSafe("1" + expectedPhone);
      expect(result).toBe(expectedPhone);
    });

    describe(`does not remove country when it does not start with 1`, () => {
      const phonesWithFewerDigits = ["2", "3", "4", "5", "6", "7", "8", "9", "55", "21"];
      for (const code of phonesWithFewerDigits) {
        it(`starts with ${code}`, () => {
          const inputPhone = code + "0987654321";
          const expectedPhone = inputPhone.slice(0, 10);
          const result = normalizePhoneSafe(inputPhone);
          expect(result).toBe(expectedPhone);
        });
      }
    });

    it(`returns 10 leftmost digits when does not start with 1 and has more than 10 digits`, () => {
      const result = normalizePhoneSafe("0987654321 ext 999");
      expect(result).toBe("0987654321");
    });

    it(`removes first digit and returns remaining leftmost digits when starts with 1 and has more than 10 digits`, () => {
      const result = normalizePhoneSafe("1987654321 ext 555");
      expect(result).toBe("9876543215");
    });
  });
});
