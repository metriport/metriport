import { isPhoneValid, normalizePhoneNumber } from "../phone";

describe("phone", () => {
  describe("isPhoneValid", () => {
    it("returns true when phone has 10 digits", async () => {
      const res = isPhoneValid("1234567890");
      expect(res).toBeTruthy();
    });

    it("returns false when phone is undefined", async () => {
      const res = isPhoneValid(undefined as unknown as string);
      expect(res).toBeFalsy();
    });

    it("returns false when phone is string", async () => {
      const res = isPhoneValid(null as unknown as string);
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains non-numbers", async () => {
      const res = isPhoneValid("a234567890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains non-number prefix", async () => {
      const res = isPhoneValid("a234567890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains non-number suffix", async () => {
      const res = isPhoneValid("123456789c");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains non-number in the middle", async () => {
      const res = isPhoneValid("1234-67890");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains less than 10 digits", async () => {
      const res = isPhoneValid("123456789");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains more than 10 digits", async () => {
      const res = isPhoneValid("12345678901");
      expect(res).toBeFalsy();
    });

    it("returns false when phone contains more than 10 digits", async () => {
      const res = isPhoneValid("12345678901");
      expect(res).toBeFalsy();
    });
  });

  describe("normalizePhoneNumber", () => {
    const phoneValid = "4150000000";
    const phonesToCheck = [phoneValid, " 4150000000 ", "(415)-000-0000", "14150000000"];
    for (const phone of phonesToCheck) {
      it(`phone: ${phone}`, async () => {
        const result = normalizePhoneNumber(phone);
        expect(result).toBe(phoneValid);
      });
    }

    const phonesWithFewerDigits = ["12345", "123456", "1234567", "12345678", "123456789"];
    for (const phone of phonesWithFewerDigits) {
      it(`returns original value when it gets ${phone} (less than 10 digits)`, async () => {
        const result = normalizePhoneNumber(phone);
        expect(result).toBe(phone);
      });
    }

    describe("strict", () => {
      it(`returns rigthmost digits when strict is false`, async () => {
        const result = normalizePhoneNumber("1231231234 ext 999");
        expect(result).toBe("1231234999");
      });
      it(`returns all digits when strict is false`, async () => {
        const result = normalizePhoneNumber("1231231234 ext 999", true);
        expect(result).toBe("1231231234999");
      });
      it(`sets strict to false by default`, async () => {
        const result = normalizePhoneNumber("1231231234 ext 999");
        expect(result).toBe("1231234999");
      });
    });
  });
});
