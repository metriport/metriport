import { geocodeAddress, geocodeOneLineAddress } from "./geocoder";
import { USState } from "@metriport/shared";

async function main() {
  await testAddress();
  await testOneLineAddress();
}

async function testAddress() {
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

async function testOneLineAddress() {
  const oneLineAddress = "601 4th St, San Francisco, CA 94129";
  const oneLineResult = await geocodeOneLineAddress(oneLineAddress);
  console.log(JSON.stringify(oneLineResult, null, 2));
}

main();
