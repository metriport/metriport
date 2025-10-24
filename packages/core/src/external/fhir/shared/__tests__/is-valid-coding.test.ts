import { knownSystemUrls } from "@metriport/shared/medical";
import { isValidCoding } from "../../codeable-concept";

describe("isValidCoding", () => {
  it("should return true for coding with only a valid display", () => {
    const result = isValidCoding({ display: "Some display" });
    expect(result).toBe(true);
  });

  it("should return false for coding with useless display", () => {
    const result = isValidCoding({ display: "Unknown" });
    expect(result).toBe(false);
  });

  it("should return true for coding with a known system even if display is missing", () => {
    expect(knownSystemUrls.length).toBeGreaterThan(0);
    expect(knownSystemUrls[0]).toBeDefined();

    const result = isValidCoding({
      system: knownSystemUrls[0] as string,
      code: "123",
    });

    expect(result).toBe(true);
  });

  it("should return false for an uninformative coding without known system", () => {
    const result = isValidCoding({
      system: "http://some-other-system.org",
      code: "456",
      display: "Unknown",
    });
    expect(result).toBe(false);
  });

  it("should return true for an informative coding without known system", () => {
    const result = isValidCoding({
      system: "http://some-other-system.org",
      code: "456",
      display: "Some valid descriptor",
    });
    expect(result).toBe(true);
  });

  it("should return false for valid coding without known system", () => {
    const result = isValidCoding({
      system: "http://some-other-system.org",
      code: "456",
    });
    expect(result).toBe(false);
  });

  it("should return false for unknown coding", () => {
    const result = isValidCoding({
      system: "http://unknown-system.org",
      code: "UNK",
    });
    expect(result).toBe(false);
  });

  it("should return false for empty coding", () => {
    const result = isValidCoding({});
    expect(result).toBe(false);
  });
});
