import { Base64Scrambler } from "../base64-scrambler";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("base64-scrambler", () => {
  const secret = "example-secret";

  it("successfully scrambles a b64 string", async () => {
    const crypto = new Base64Scrambler(secret);
    const initial = "9BodV4YyRX63dg6du0c2Bw==";
    const expected = "P2xVMmkld3TOVrTVyHIg25==";

    expect(crypto.scramble(initial)).toEqual(expected);
  });

  it("successfully unscrambles a scrambled b64 string", async () => {
    const crypto = new Base64Scrambler(secret);
    const initial = "P2xVMmkld3TOVrTVyHIg25==";
    const expected = "9BodV4YyRX63dg6du0c2Bw==";

    expect(crypto.unscramble(initial)).toEqual(expected);
  });

  it("throws an error when scrambling non b64 strings", async () => {
    const crypto = new Base64Scrambler(secret);
    const nonB64String = ";;;;YyRX63dg6du0c2Bw==";
    const emptyString = "";

    expect(() => crypto.scramble(nonB64String)).toThrow();
    expect(() => crypto.scramble(emptyString)).toThrow();
  });

  it("throws an error when unscrambling non b64 strings", async () => {
    const crypto = new Base64Scrambler(secret);
    const nonB64String = ";;;;YyRX63dg6du0c2Bw==";
    const emptyString = "";

    expect(() => crypto.unscramble(nonB64String)).toThrow();
    expect(() => crypto.unscramble(emptyString)).toThrow();
  });
});
