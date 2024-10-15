import { validateNPI } from "../validate-npi";
import { makeNPI } from "./validate-npi";

describe("validate-npi", () => {
  describe("returns true when it gets valid NPI number", () => {
    for (let i = 0; i < 10; i++) {
      const npi = makeNPI();
      it(npi, async () => {
        expect(validateNPI(npi)).toBeTruthy();
      });
    }
  });

  it("returns false when it gets empty string", async () => {
    expect(validateNPI("")).toBeFalsy();
  });

  it("returns false when it gets undefined", async () => {
    expect(validateNPI(undefined as unknown as string)).toBeFalsy();
  });

  it("returns false when it gets invalid 10 digit string", async () => {
    expect(validateNPI(String(1_123_123_123))).toBeFalsy();
  });
});
