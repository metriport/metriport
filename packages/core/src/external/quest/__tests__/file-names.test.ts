import { MetriportError } from "@metriport/shared";
import { buildRosterFileName, parseResponseFileName } from "../file/file-names";

describe("parseResponseFileName", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds a roster file name", () => {
    expect(buildRosterFileName()).toBe("Metriport_roster_20250101.txt");
  });

  it("parses an 8-digit date", () => {
    expect(parseResponseFileName("Metriport_20250101.txt")).toEqual({ dateId: "20250101" });
  });

  it("parses a 12-digit date interval", () => {
    expect(parseResponseFileName("Metriport_202501010201.txt")).toEqual({
      dateId: "202501010201",
    });
  });

  it("throws on missing prefix", () => {
    expect(() => parseResponseFileName("Portal_202501010201.txt")).toThrow(MetriportError);
  });

  it("throws on wrong extension", () => {
    expect(() => parseResponseFileName("Metriport_202501010201.csv")).toThrow(MetriportError);
  });

  it("throws on non-numeric ID", () => {
    expect(() => parseResponseFileName("Metriport_20A501010201.txt")).toThrow(MetriportError);
  });

  it("throws on incorrect ID length", () => {
    expect(() => parseResponseFileName("Metriport_2025011.txt")).toThrow(MetriportError);
    expect(() => parseResponseFileName("Metriport_2025010123.txt")).toThrow(MetriportError);
  });

  it("throws on extra characters", () => {
    expect(() => parseResponseFileName("XMetriport_20250101.txtY")).toThrow(MetriportError);
  });
});
