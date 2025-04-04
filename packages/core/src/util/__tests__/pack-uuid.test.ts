import { packUuid, unpackUuid } from "../pack-uuid";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("pack-uuid", () => {
  it("successfully packs a uuid", async () => {
    const uuid = "f41a1d57-8632-457e-b776-0e9dbb473607";
    const expected = "9BodV4YyRX63dg6du0c2Bw==";

    expect(packUuid(uuid)).toEqual(expected);
  });

  it("successfully unpacks a uuid", async () => {
    const packed = "9BodV4YyRX63dg6du0c2Bw==";
    const expected = "f41a1d57-8632-457e-b776-0e9dbb473607";
    expect(unpackUuid(packed)).toEqual(expected);
  });

  it("throws an error when the input is not a valid uuid", async () => {
    const uuid = "f41a1d57-8632---b776-0e9dbb473607";
    expect(() => packUuid(uuid)).toThrow();
  });
});
