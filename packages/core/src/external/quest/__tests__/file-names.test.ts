import { MetriportError } from "@metriport/shared";
import { parseResponseFileName } from "../file/file-names";

describe("parseResponseFileName", () => {
  it("parses an 8-digit date", () => {
    expect(parseResponseFileName("Metriport_20250101.txt")).toEqual({ dateId: "20250101" });
  });

  it("parses a 12-digit timestamp", () => {
    expect(parseResponseFileName("Metriport_2025010120250201.txt")).toEqual({
      dateId: "2025010120250201",
    });
  });

  it("throws on missing prefix", () => {
    expect(() => parseResponseFileName("Portal_20250101.txt")).toThrow(MetriportError);
  });

  it("throws on wrong extension", () => {
    expect(() => parseResponseFileName("Metriport_20250101.csv")).toThrow(MetriportError);
  });

  it("throws on non-numeric ID", () => {
    expect(() => parseResponseFileName("Metriport_20A50101.txt")).toThrow(MetriportError);
  });

  it("throws on incorrect ID length", () => {
    expect(() => parseResponseFileName("Metriport_2025011.txt")).toThrow(MetriportError);
    expect(() => parseResponseFileName("Metriport_2025010123.txt")).toThrow(MetriportError);
  });

  it("throws on extra characters", () => {
    expect(() => parseResponseFileName("XMetriport_20250101.txtY")).toThrow(MetriportError);
  });
});
