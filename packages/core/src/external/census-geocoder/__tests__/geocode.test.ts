import { USState } from "@metriport/shared";
import { geocodeAddress } from "../census-geocoder";

describe("US Census Geocoder", () => {
  it("should geocode an address", async () => {
    const address = {
      addressLine1: "601 4th St",
      addressLine2: "Apt 101",
      city: "San Francisco",
      state: USState.CA,
      zip: "94129",
    };
    const result = await geocodeAddress(address);
    console.log(result);
    expect(result).toBeDefined();
  });
});
