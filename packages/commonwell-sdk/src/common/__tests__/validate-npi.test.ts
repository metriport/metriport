/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { validateNPI } from "../validate-npi";

const validNPIs: string[] = [
  "2974324529", // random
  "1407080450",
  "1053415810",
  "1730961061",
  "1427836782",
  "1447933353",
  "1013414374",
  "1831886555",
  "1649966466",
  "1285017277",
  "1093408148",
  "1104925569",
];

describe("validateNPI", () => {
  it("returns false when undefined", async () => {
    const res = validateNPI(undefined as unknown as string);
    expect(res).toBeFalsy();
  });

  it("returns false when empty string", async () => {
    const npi = "";
    const res = validateNPI(npi);
    expect(res).toBeFalsy();
  });

  it("returns false when alpha string", async () => {
    const npi = faker.lorem.word();
    const res = validateNPI(npi);
    expect(res).toBeFalsy();
  });

  describe("returns true for valid NPI", () => {
    for (const npi of validNPIs) {
      it(` - npi ${npi}`, async () => {
        const res = validateNPI(npi);
        expect(res).toBeTruthy();
      });
    }
  });
});
