import { geocodeAddress } from "./census-geocoder";
import { USState } from "@metriport/shared";

async function main() {
  const address = {
    addressLine1: "601 4th St",
    addressLine2: "Apt 101",
    city: "San Francisco",
    state: USState.CA,
    zip: "94129",
  };
  const result = await geocodeAddress(address);
  console.log(JSON.stringify(result, null, 2));
}

main();
