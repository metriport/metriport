import { makeOid } from "./oid";

describe("makeOid", () => {
  it("should generate a valid OID with default parameters", () => {
    const oid = makeOid();
    expect(oid).toMatch(/^\d+(\.\d+){5}$/);
    expect(oid.split(".")).toHaveLength(6);
  });

  it("should generate OID with custom number of levels", () => {
    const oid = makeOid({ amountOfLevels: 20 });
    expect(oid.split(".")).toHaveLength(20);
  });

  it("should generate OID starting from a base OID", () => {
    const baseOid = "1.2.840.113883";
    const oid = makeOid({ startFrom: baseOid, amountOfLevels: 6 });
    expect(oid).toMatch(new RegExp(`^${baseOid.replace(/\./g, "\\.")}\\.\\d+\\.\\d+$`));
    expect(oid.split(".")).toHaveLength(6);
  });

  it("should generate OID with custom range", () => {
    const range = { min: 100, max: 999 };
    const oid = makeOid({ range, startFrom: "101.102", amountOfLevels: 20 });
    const levels = oid.split(".").map(Number);
    levels.forEach(level => {
      expect(level).toBeGreaterThanOrEqual(range.min);
      expect(level).toBeLessThanOrEqual(range.max);
    });
  });

  it("should throw error when startFrom has more levels than amountOfLevels", () => {
    expect(() => {
      makeOid({ startFrom: "1.2.3.4.5.6.7", amountOfLevels: 5 });
    }).toThrow("startFrom OID has 7 levels, but amountOfLevels is 5");
  });

  it("should work with all custom parameters", () => {
    const oid = makeOid({
      amountOfLevels: 5,
      startFrom: "1.2.840",
      range: { min: 90, max: 99 },
    });

    expect(oid.split(".")).toHaveLength(5);
    expect(oid).toMatch(/^1\.2\.840\.\d+\.\d+$/);
    const levels = oid.split(".").map(Number);
    levels.slice(3).forEach(level => {
      expect(level).toBeGreaterThanOrEqual(90);
      expect(level).toBeLessThanOrEqual(99);
    });
  });
});
