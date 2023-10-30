import { Address } from "../domain/medical/address";
import * as AWS from "aws-sdk";
import * as postal from "node-postal";

const placesIndexName = "explore.place.HERE";
// const placesIndexName = Config.getPlacesIndexName();

export const normalizeAddresses = async (address: Address[]): Promise<Address[]> => {
  const normalizedAddresses = [];
  for (const addr of address) {
    const freeFormAddress = `${addr.addressLine1} ${addr.addressLine2} ${addr.city} ${addr.state} ${addr.zip} ${addr.country}`;
    const suggestedAddress = await getSuggestedAddress(freeFormAddress);
    const unitNumber = getUnitNumber(freeFormAddress);
    const normalizedAddress = rebuildAddress(suggestedAddress, unitNumber);
    if (normalizedAddress) normalizedAddresses.push(normalizedAddress);
  }
  return normalizedAddresses;
};

async function getSuggestedAddress(address: string): Promise<string> {
  const location = new AWS.Location({ apiVersion: "2020-11-19" });
  const params = {
    IndexName: placesIndexName,
    Text: address,
    FilterCountries: ["USA"],
    MaxResults: 1,
  };
  const resp = await location.searchPlaceIndexForSuggestions(params).promise();
  const topResult = resp.Results[0].Text;
  return topResult;
}

function getUnitNumber(address: string): string | undefined {
  // node-postal logic to break down the string address into its components
  const resp = postal.parser.parse_address(address);
  console.log(resp);
  const unit = resp
    .filter((line: { component: string }) => line.component === "unit")
    .map((item: { value: string }) => item.value);
  return unit;
}

function rebuildAddress(
  suggestedAddress: string,
  unitNumber: string | undefined
): Address | undefined {
  console.log("Suggested Address string:", suggestedAddress);
  try {
    const addressParts = suggestedAddress.split(",");
    const addressLine1 = addressParts[0].trim();
    const addressLine2 = unitNumber;
    const city = addressParts[1].trim();
    const stateZip = addressParts[2].trim().split(" ");
    const state = stateZip[0].trim();
    const zip = stateZip[1].trim();
    const country = "USA";

    return {
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country,
    };
  } catch (error) {
    console.log("Error:", error);
    return;
  }
}
