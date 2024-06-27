import { isPhoneValid, normalizePhoneNumber } from "../phone";

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

    it("returns false when phone contains non-numbers", () => {
      const res = isPhoneValid("a234567890");
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

    it("returns false when phone contains less than 10 digits", () => {
      const res = isPhoneValid("123456789");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains more than 10 digits", () => {
      const res = isPhoneValid("12345678901");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains more than 10 digits", () => {
      const res = isPhoneValid("12345678901");
      expect(res).toBeFalsy();
    });
  });

  describe("normalizePhoneNumber", () => {
    it("removes non-digits and returns original", () => {
      const inputPhone = " a0987b65 43-21 ext(012/3) ";
      const expectedPhone = "09876543210123";
      const result = normalizePhoneNumber(inputPhone);
      expect(result).toEqual(expectedPhone);
    });

    describe("specific phone formats to try", () => {
      const phoneValid = "4150000000";
      const phonesToCheck = [phoneValid, " 4150000000 ", "(415)-000-0000", "14150000000"];
      for (const phone of phonesToCheck) {
        it(`returns original phone w/o format - ${phone}`, () => {
          const result = normalizePhoneNumber(phone);
          expect(result).toBe(phoneValid);
        });
      }
    });

    describe("less than 10 digits", () => {
      const phonesWithFewerDigits = ["12345", "123456", "1234567", "12345678", "123456789"];
      for (const phone of phonesWithFewerDigits) {
        it(`returns original value when it gets ${phone} (less than 10 digits)`, () => {
          const result = normalizePhoneNumber(phone);
          expect(result).toBe(phone);
        });
      }
    });

    it(`removes country code when it starts with 1 and has 11 digits`, () => {
      const expectedPhone = "0987654321";
      const result = normalizePhoneNumber("1" + expectedPhone);
      expect(result).toBe(expectedPhone);
    });

    it(`does not remove country code when it starts with diff than 1 and has 11 digits`, () => {
      const inputPhone = "20987654321";
      const expectedPhone = "2098765432";
      const result = normalizePhoneNumber(inputPhone, true);
      expect(result).toBe(expectedPhone);
    });

    it(`does not remove country code when it starts with 1 and has 10 digits`, () => {
      const expectedPhone = "1098765432";
      const result = normalizePhoneNumber(expectedPhone);
      expect(result).toBe(expectedPhone);
    });

    it(`does not remove country code when it starts with 1 and has 12 digits`, () => {
      const expectedPhone = "109876543219";
      const result = normalizePhoneNumber(expectedPhone);
      expect(result).toBe(expectedPhone);
    });

    describe(`does not remove country when it does not start with 1`, () => {
      const phonesWithFewerDigits = ["2", "3", "4", "5", "6", "7", "8", "9", "55", "21"];
      for (const code of phonesWithFewerDigits) {
        it(`starts with ${code}`, () => {
          const expectedPhone = code + "0987654321";
          const result = normalizePhoneNumber(expectedPhone);
          expect(result).toBe(expectedPhone);
        });
      }
    });

    describe("autofix and has more than 11 digits", () => {
      it(`returns leftmost digits when does not start with 1 and autofix is true`, () => {
        const result = normalizePhoneNumber("0987654321 ext 999", true);
        expect(result).toBe("0987654321");
      });
      it(`removes first digit and returns leftmost digits when starts with 1 and autofix is true`, () => {
        const result = normalizePhoneNumber("1987654321 ext 999", true);
        expect(result).toBe("9876543219");
      });
      it(`returns all digits when autofix is false`, () => {
        const result = normalizePhoneNumber("0987654321 ext 999", false);
        expect(result).toBe("0987654321999");
      });
      it(`autofix is false by default`, () => {
        const result = normalizePhoneNumber("0987654321 ext 999");
        expect(result).toBe("0987654321999");
      });
    });
  });
});
