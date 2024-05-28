import { faker } from "@faker-js/faker";
import { nanoid } from "nanoid";
import { getCxIdFromApiKey } from "../auth";

describe("getCxIdFromApiKey", () => {
  const makeEncodedKey = (cxId?: string | undefined) => {
    const input = cxId !== undefined ? `${nanoid()}:${cxId}` : nanoid();
    return Buffer.from(input).toString("base64");
  };

  it("throws when no encoded API key is provided", async () => {
    expect(() => getCxIdFromApiKey(undefined)).toThrow();
  });

  it(`throws when it gets empty encoded string`, async () => {
    expect(() => getCxIdFromApiKey("")).toThrow();
  });

  it(`throws when it gets invalid encoded string`, async () => {
    expect(() => getCxIdFromApiKey("N1Hqevi6FA")).toThrow();
  });

  it("throws when API key doesnt include separator and cxId", async () => {
    const encodedKey = makeEncodedKey();
    expect(() => getCxIdFromApiKey(encodedKey)).toThrow();
  });

  it("throws when API key doesnt include cxId", async () => {
    const encodedKey = makeEncodedKey("");
    expect(() => getCxIdFromApiKey(encodedKey)).toThrow();
  });

  it("cxId when its encoded correctly", async () => {
    const expectedCxId = faker.string.uuid();
    const encodedKey = makeEncodedKey(expectedCxId);
    const cxId = getCxIdFromApiKey(encodedKey);
    expect(cxId).toEqual(expectedCxId);
  });
});
