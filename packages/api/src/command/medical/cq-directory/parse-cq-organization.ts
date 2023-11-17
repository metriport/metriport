import { Contained } from "@metriport/carequality-sdk/models/contained";
import { Address } from "@metriport/carequality-sdk/models/address";

export type XCUrls = {
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
};

export function getUrls(contained: Contained): XCUrls | undefined {
  const endpointMap: Record<string, string> = {};

  contained?.forEach(endpoint => {
    const ext = endpoint?.Endpoint.extension.extension.find(ext => ext.url === "Transaction");
    const type = ext?.valueString?.value;

    if (type && endpoint && endpoint.Endpoint.address && endpoint.Endpoint.address.value) {
      endpointMap[type] = endpoint.Endpoint.address.value;
    }
  });

  const urlXCPD = endpointMap["XCPD ITI-55"];

  if (!urlXCPD) return;

  const urls: XCUrls = {
    urlXCPD,
  };

  if (endpointMap["XCA ITI-38"]) {
    urls.urlDQ = endpointMap["XCA ITI-38"];
  }
  if (endpointMap["XCA ITI-39"]) {
    urls.urlDR = endpointMap["XCA ITI-39"];
  }

  return urls;
}

export function getCoordinates(
  address: Address[] | undefined
): { latitude: string; longitude: string } | undefined {
  if (!address) return;
  const coordinates = address.flatMap(a => {
    if (a.extension?.url === "OrgPosition") {
      const position = a.extension?.valueCodeableConcept?.coding?.value?.position;
      if (!position) return [];
      return {
        latitude: position.latitude.value,
        longitude: position.longitude.value,
      };
    }
  })[0];

  return coordinates;
}

export function getState(address: Address[] | undefined): string | undefined {
  if (!address) return;
  if (address.length > 0 && address[0].state) return address[0].state.value ?? undefined;
  return;
}
