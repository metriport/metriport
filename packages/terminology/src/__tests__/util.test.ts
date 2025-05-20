import { normalizeNdcCode } from "../util";

describe("normalizeNdcCode", () => {
  describe("with hyphenated NDC codes", () => {
    it("should normalize a valid 11-digit NDC code with hyphens", () => {
      expect(normalizeNdcCode("12345-6789-01")).toBe("12345678901");
    });

    it("should normalize a valid 11-digit NDC code with leading zeros", () => {
      expect(normalizeNdcCode("012345-6789-01")).toBe("12345678901");
    });

    it("should normalize a valid 11-digit NDC code with single-digit package", () => {
      expect(normalizeNdcCode("12345-6789-1")).toBe("12345678901");
    });

    it("should normalize a 12-digit NDC code in 6-4-2 format", () => {
      expect(normalizeNdcCode("000406-0522-05")).toBe("00406052205");
    });

    it("should normalize a 10-digit NDC code in 5-3-2 format", () => {
      expect(normalizeNdcCode("0591-0933-01")).toBe("00591093301");
    });

    it("should normalize a 10-digit NDC code in 4-4-2 format", () => {
      expect(normalizeNdcCode("0548-6853-38")).toBe("00548685338");
    });

    it("should normalize a 10-digit NDC code in 5-4-1 format", () => {
      expect(normalizeNdcCode("60951-700-8")).toBe("60951070008");
    });

    it("should normalize an NDC code with asterisk", () => {
      expect(normalizeNdcCode("054868-5338-*3")).toBe("54868533803");
    });

    it("should allow truncated NDC when isTruncatedAllowed is true", () => {
      expect(normalizeNdcCode("12345-6789", true)).toBe("123456789");
    });

    it("should throw error for invalid labeler length", () => {
      expect(() => normalizeNdcCode("123-6789-01")).toThrow("Invalid labeler length");
    });

    it("should throw error for invalid product length", () => {
      expect(() => normalizeNdcCode("12345-67-01")).toThrow("Invalid product length");
    });

    it("should throw error for missing labeler", () => {
      expect(() => normalizeNdcCode("-6789-01")).toThrow("Invalid NDC code");
    });

    it("should throw error for missing product", () => {
      expect(() => normalizeNdcCode("12345--01")).toThrow("Invalid NDC code");
    });

    it("should throw error for truncated NDC when isTruncatedAllowed is false", () => {
      expect(() => normalizeNdcCode("12345-6789")).toThrow("Truncated NDC code");
    });
  });

  describe("with non-hyphenated NDC codes", () => {
    it("should return valid 11-digit NDC code as is", () => {
      expect(normalizeNdcCode("12345678901")).toBe("12345678901");
    });

    it("should replace 11-digit NDC code replacing the asterisk with a zero", () => {
      expect(normalizeNdcCode("123456789*1")).toBe("12345678901");
    });

    it("should normalize a 12-digit NDC code without hyphens", () => {
      expect(normalizeNdcCode("000406052201")).toBe("00406052201");
    });

    it("should add leading zero to 10-digit NDC code", () => {
      expect(normalizeNdcCode("1234567890")).toBe("01234567890");
    });

    it("should throw error for invalid NDC code length", () => {
      expect(() => normalizeNdcCode("123456789")).toThrow("Invalid NDC code");
    });
  });
});
