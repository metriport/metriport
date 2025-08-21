/* eslint-disable @typescript-eslint/no-empty-function */
import { coerceGender, GenderCodes } from "../demographics";

describe("demographics", () => {
  describe("coerceGender", () => {
    it("returns M when it gets capital M", async () => {
      expect(coerceGender("M")).toBe(GenderCodes.M);
    });
    it("returns M when it gets lowercase m", async () => {
      expect(coerceGender("m")).toBe(GenderCodes.M);
    });
    it("returns M when it gets male", async () => {
      expect(coerceGender("male")).toBe(GenderCodes.M);
      expect(coerceGender("Male")).toBe(GenderCodes.M);
      expect(coerceGender("MALE")).toBe(GenderCodes.M);
    });

    it("returns F when it gets capital F", async () => {
      expect(coerceGender("F")).toBe(GenderCodes.F);
    });
    it("returns F when it gets lowercase f", async () => {
      expect(coerceGender("f")).toBe(GenderCodes.F);
    });
    it("returns F when it gets female", async () => {
      expect(coerceGender("female")).toBe(GenderCodes.F);
      expect(coerceGender("Female")).toBe(GenderCodes.F);
      expect(coerceGender("FEMALE")).toBe(GenderCodes.F);
    });

    it("returns O when it gets capital O", async () => {
      expect(coerceGender("O")).toBe(GenderCodes.O);
    });
    it("returns O when it gets lowercase o", async () => {
      expect(coerceGender("o")).toBe(GenderCodes.O);
    });
    it("returns O when it gets other", async () => {
      expect(coerceGender("other")).toBe(GenderCodes.O);
      expect(coerceGender("Other")).toBe(GenderCodes.O);
      expect(coerceGender("OTHER")).toBe(GenderCodes.O);
    });
    it("returns O when it gets capital UN", async () => {
      expect(coerceGender("UN")).toBe(GenderCodes.O);
    });
    it("returns O when it gets lowercase un", async () => {
      expect(coerceGender("un")).toBe(GenderCodes.O);
    });
    it("returns O when it gets undifferentiated", async () => {
      expect(coerceGender("undifferentiated")).toBe(GenderCodes.O);
      expect(coerceGender("Undifferentiated")).toBe(GenderCodes.O);
      expect(coerceGender("UNDIFFERENTIATED")).toBe(GenderCodes.O);
    });
    it("does not match undifferentiated pattern for other 'un' prefixed strings", async () => {
      expect(() => coerceGender("unrelated")).toThrow("Invalid gender");
      expect(() => coerceGender("university")).toThrow("Invalid gender");
      expect(() => coerceGender("unx")).toThrow("Invalid gender");
    });

    it("returns U when it gets capital U", async () => {
      expect(coerceGender("U")).toBe(GenderCodes.U);
    });
    it("returns U when it gets lowercase u", async () => {
      expect(coerceGender("u")).toBe(GenderCodes.U);
    });
    it("returns U when it gets capital UNK", async () => {
      expect(coerceGender("UNK")).toBe(GenderCodes.U);
    });
    it("returns U when it gets lowercase unk", async () => {
      expect(coerceGender("unk")).toBe(GenderCodes.U);
    });
    it("returns U when it gets unknown", async () => {
      expect(coerceGender("unknown")).toBe(GenderCodes.U);
      expect(coerceGender("Unknown")).toBe(GenderCodes.U);
      expect(coerceGender("UNKNOWN")).toBe(GenderCodes.U);
    });

    it("throws error for non-string input", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => coerceGender(null as any)).toThrow("Invalid gender");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => coerceGender(undefined as any)).toThrow("Invalid gender");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => coerceGender(123 as any)).toThrow("Invalid gender");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => coerceGender({} as any)).toThrow("Invalid gender");
    });

    it("throws error for empty string", async () => {
      expect(() => coerceGender("")).toThrow("Invalid gender");
    });

    it("throws error for invalid gender values", async () => {
      expect(() => coerceGender("invalid")).toThrow("Invalid gender");
      expect(() => coerceGender("x")).toThrow("Invalid gender");
      expect(() => coerceGender("z")).toThrow("Invalid gender");
      expect(() => coerceGender("123")).toThrow("Invalid gender");
      expect(() => coerceGender("malee")).toThrow("Invalid gender");
      expect(() => coerceGender("femalex")).toThrow("Invalid gender");
    });
  });
});
