/* eslint-disable @typescript-eslint/ban-ts-comment */
import { normalizeAddressLines } from "../normalize-address";

describe("normalizeAddressLines", () => {
  it("should normalize number to a string", () => {
    const lines = [123];

    // @ts-ignore
    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual(["123"]);
  });

  it("should filter out empty strings", () => {
    const lines = [""];

    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual([]);
  });

  it("should filter out null", () => {
    const lines = [null];

    // @ts-ignore
    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual([]);
  });

  it("should filter out undefined", () => {
    const lines = [undefined];

    // @ts-ignore
    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual([]);
  });

  it("should not filter out 0 or 1", () => {
    const lines = [0, 1];

    // @ts-ignore
    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual(["0", "1"]);
  });

  it("should normalize drive", () => {
    const lines = ["Drive"];

    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual(["dr"]);
  });

  it("should normalize street", () => {
    const lines = ["STREET"];

    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual(["st"]);
  });

  it("should normalize avenue", () => {
    const lines = ["avenue"];

    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual(["ave"]);
  });

  it("should normalize road", () => {
    const lines = ["RoAd"];

    const norm = normalizeAddressLines(lines);
    expect(norm).toEqual(["rd"]);
  });

  it("should return empty array if no line provided", () => {
    const norm = normalizeAddressLines(undefined);
    expect(norm).toEqual([]);
  });
});
