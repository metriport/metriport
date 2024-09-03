import { Coding } from "@medplum/fhirtypes";
import { isUnknownCoding, unknownCoding } from "../shared";

describe("isUnknownCoding", () => {
  it("correctly identifies unknown coding", () => {
    const coding: Coding = unknownCoding;
    const res = isUnknownCoding(coding);
    expect(res).toBe(true);
  });

  it("correctly identifies a known code as such", () => {
    const coding = { code: "A1B2C3" };
    const res = isUnknownCoding(coding);
    expect(res).toBe(false);
  });

  it("correctly identifies unknown display as unknown", () => {
    const coding = { display: "unknown" };
    const res = isUnknownCoding(coding);
    expect(res).toBe(true);
  });

  it("correctly identifies a known display as such", () => {
    const coding = { display: "SomethingImportant" };
    const res = isUnknownCoding(coding);
    expect(res).toBe(false);
  });

  it("correctly identifies a known text as such", () => {
    const coding = {};
    const res = isUnknownCoding(coding, "SomethingImportant");
    expect(res).toBe(false);
  });
});
