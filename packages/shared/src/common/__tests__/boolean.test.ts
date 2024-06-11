import { faker } from "@faker-js/faker";
import { isTrue } from "../boolean";

describe("isTrue", () => {
  it("returns false when it gets null value", async () => {
    expect(isTrue(null)).toEqual(false);
  });

  it("returns false when it gets undefined value", async () => {
    expect(isTrue(undefined)).toEqual(false);
  });

  it("returns false when it gets object", async () => {
    expect(isTrue({})).toEqual(false);
  });

  it("returns false when it gets empty string", async () => {
    expect(isTrue("")).toEqual(false);
  });

  it("returns false when it gets string diff than 'true'", async () => {
    expect(isTrue(faker.string.alpha())).toEqual(false);
  });

  it("returns true when it gets string 'true' in fixed caps", async () => {
    expect(isTrue("true")).toEqual(true);
  });

  it("returns true when it gets string 'true' in various caps", async () => {
    expect(isTrue("tRuE")).toEqual(true);
  });

  it("returns true when it gets string 'true' with prefix", async () => {
    expect(isTrue(" true")).toEqual(true);
  });

  it("returns true when it gets string 'true' with suffix", async () => {
    expect(isTrue("true ")).toEqual(true);
  });

  it("returns true when it gets boolean 'true'", async () => {
    expect(isTrue(true)).toEqual(true);
  });

  it("returns false when it gets boolean 'false'", async () => {
    expect(isTrue(false)).toEqual(false);
  });

  it("returns true when it gets object Boolean 'true'", async () => {
    expect(isTrue(Boolean(true))).toEqual(true);
  });

  it("returns false when it gets object Boolean 'false'", async () => {
    expect(isTrue(Boolean(false))).toEqual(false);
  });
});
