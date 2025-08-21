import {
  fromQuestDate,
  fromQuestEnum,
  fromQuestInteger,
  fromQuestString,
  toQuestDate,
  toQuestEnum,
  toQuestInteger,
  toQuestString,
  toQuestUnused,
} from "../schema/shared";

interface TestObj {
  foo?: string | number | Date;
  bar?: string | number | Date;
}

describe("quest schema shared helpers", () => {
  describe("toQuestEnum", () => {
    it("pads valid enum value to byte length", () => {
      const enumerated = ["A", "B", "C"] as const;
      const toField = toQuestEnum<TestObj>("foo", enumerated);
      const result = toField({ foo: "B" }, 5);
      expect(result).toBe("B    ");
    });

    it("returns empty padded when optional and value is missing", () => {
      const enumerated = ["X", "Y"] as const;
      const toField = toQuestEnum<TestObj>("foo", enumerated, { optional: true });
      const result = toField({}, 3);
      expect(result).toBe("   ");
    });

    it("throws on invalid enum value", () => {
      const enumerated = ["X", "Y"] as const;
      const toField = toQuestEnum<TestObj>("foo", enumerated);
      expect(() => toField({ foo: "Z" }, 2)).toThrow("Invalid value: Z");
    });
  });

  describe("fromQuestEnum", () => {
    it("returns value when in enumerated set", () => {
      const parse = fromQuestEnum(["M", "F"] as const);
      expect(parse("M")).toBe("M");
    });

    it("returns undefined when optional and empty", () => {
      const parse = fromQuestEnum(["M", "F"] as const, { optional: true });
      expect(parse("")).toBeUndefined();
    });

    it("throws when value not in enumerated set", () => {
      const parse = fromQuestEnum(["M", "F"] as const);
      expect(() => parse("U")).toThrow("Invalid value: U");
    });
  });

  describe("toQuestUnused", () => {
    it("returns empty padded string of byte length", () => {
      const toField = toQuestUnused<TestObj>();
      expect(toField({ foo: "anything" }, 4)).toBe("    ");
    });
  });

  describe("toQuestString", () => {
    it("pads a normal string to byte length", () => {
      const toField = toQuestString<TestObj>("foo");
      const result = toField({ foo: "AB" }, 5);
      expect(result).toBe("AB   ");
    });

    it("truncates without padding when truncate option is true", () => {
      const toField = toQuestString<TestObj>("foo", { truncate: true });
      const result = toField({ foo: "TOO-LONG" }, 3);
      expect(result).toBe("TOO");
    });

    it("throws when below minLength and not optional", () => {
      const toField = toQuestString<TestObj>("foo", { minLength: 3 });
      expect(() => toField({ foo: "AB" }, 3)).toThrow("Value is too short: AB");
    });

    it("uses defaultValue when below minLength and optional", () => {
      const toField = toQuestString<TestObj>("foo", {
        optional: true,
        minLength: 3,
        defaultValue: "DEF",
      });
      const result = toField({ foo: "A" }, 5);
      expect(result).toBe("DEF  ");
    });

    it("uses defaultValue when missing and optional", () => {
      const toField = toQuestString<TestObj>("foo", { optional: true, defaultValue: "X" });
      const result = toField({}, 4);
      expect(result).toBe("X   ");
    });

    it("throws when non-string and not optional", () => {
      const toField = toQuestString<TestObj>("foo");
      expect(() => toField({ foo: 123 as unknown as string }, 3)).toThrow("Invalid value: 123");
    });
  });

  describe("fromQuestString", () => {
    it("returns undefined for empty when optional", () => {
      const parse = fromQuestString({ optional: true });
      expect(parse("")).toBeUndefined();
    });

    it("returns the same string otherwise", () => {
      const parse = fromQuestString();
      expect(parse(" hello ")).toBe(" hello ");
    });
  });

  describe("toQuestInteger", () => {
    it("pads integer to byte length", () => {
      const toField = toQuestInteger<TestObj>("foo");
      const result = toField({ foo: 42 }, 5);
      expect(result).toBe("42   ");
    });

    it("returns empty padded when optional and missing", () => {
      const toField = toQuestInteger<TestObj>("foo", { optional: true });
      const result = toField({}, 3);
      expect(result).toBe("   ");
    });

    it("throws when not a number", () => {
      const toField = toQuestInteger<TestObj>("foo");
      expect(() => toField({ foo: "7" as unknown as number }, 2)).toThrow("Invalid value: 7");
    });
  });

  describe("fromQuestInteger", () => {
    it("parses string integer to number", () => {
      const parse = fromQuestInteger();
      expect(parse("00123")).toBe(123);
    });

    it("returns undefined when optional and empty", () => {
      const parse = fromQuestInteger({ optional: true });
      expect(parse("   ")).toBeUndefined();
    });

    it("throws when required and empty", () => {
      const parse = fromQuestInteger();
      expect(() => parse("   ")).toThrow("Missing required field");
    });

    it("throws when invalid integer", () => {
      const parse = fromQuestInteger();
      expect(() => parse("abc")).toThrow("Invalid integer: abc");
    });
  });

  describe("fromQuestDate", () => {
    it("parses YYYYMMDD into a UTC date at midnight", () => {
      const parse = fromQuestDate();
      const date = parse("20240226");
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(1); // February is 1
      expect(date.getUTCDate()).toBe(26);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    it("returns undefined for empty when optional", () => {
      const parse = fromQuestDate({ optional: true });
      expect(parse("")).toBeUndefined();
    });

    it("throws for invalid length", () => {
      const parse = fromQuestDate();
      expect(() => parse("2024-02-26")).toThrow("Invalid date: 2024-02-26");
    });
  });

  describe("toQuestDate", () => {
    it("formats Date to YYYYMMDD using UTC by default", () => {
      const toField = toQuestDate<TestObj>("foo");
      const date = new Date("2024-02-26T12:34:56Z");
      const result = toField({ foo: date });
      expect(result).toBe("20240226");
    });

    it("strips dashes when given an ISO string date", () => {
      const toField = toQuestDate<TestObj>("foo");
      const result = toField({ foo: "2024-02-26" });
      expect(result).toBe("20240226");
    });

    it("returns empty when optional and missing", () => {
      const toField = toQuestDate<TestObj>("foo", { optional: true });
      expect(toField({})).toBe("");
    });

    it("throws when invalid type", () => {
      const toField = toQuestDate<TestObj>("foo");
      expect(() => toField({ foo: 123 as unknown as Date })).toThrow("Invalid value: 123");
    });
  });
});
