import { XCA_DQ_STRING, XCA_DR_STRING, XCPD_STRING } from "@metriport/carequality-sdk/common/util";
import { Address } from "@metriport/carequality-sdk/models/address";
import { Contained } from "@metriport/carequality-sdk/models/contained";
import { Organization } from "@metriport/carequality-sdk/models/organization";
import { normalizeOid } from "@metriport/shared";
import { CQDirectoryEntryData } from "../../../domain/medical/cq-directory";

export type XCUrls = {
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
};

export function parseCQDirectoryEntries(orgsInput: Organization[]): CQDirectoryEntryData[] {
  const orgs = orgsInput.flatMap(org => {
    const orgOid = org?.identifier?.value?.value;
    if (!orgOid) return [];

    const url = getUrls(org?.contained);
    if (!url?.urlXCPD) return [];
    let oid = org?.identifier?.value?.value;
    try {
      oid = normalizeOid(org?.identifier?.value?.value);
    } catch (err) {
      console.log(`Organization ${org.name?.value} has invalid OID: ${oid}`);
      return [];
    }
    const coordinates = getCoordinates(org?.address);

    const state = getState(org.address);
    const orgData: CQDirectoryEntryData = {
      oid,
      name: org.name?.value ?? undefined,
      urlXCPD: url.urlXCPD,
      urlDQ: url.urlDQ,
      urlDR: url.urlDR,
      lat: coordinates?.lat ?? undefined,
      lon: coordinates?.lon ?? undefined,
      data: {
        ...org,
      },
      state,
    };
    return orgData;
  });
  return orgs;
}

function getUrls(contained: Contained): XCUrls | undefined {
  const endpointMap: Record<string, string> = {};

  contained?.forEach(c => {
    const ext = c?.Endpoint.extension.extension.find(ext => ext.url === "Transaction");
    const type = ext?.valueString?.value;

    if (type && c?.Endpoint?.address?.value) {
      endpointMap[type] = c.Endpoint.address.value;
    }
  });

  const urlXCPD = endpointMap[XCPD_STRING];

  if (!urlXCPD) return;

  const urls: XCUrls = {
    urlXCPD,
  };

  if (endpointMap[XCA_DQ_STRING]) {
    urls.urlDQ = endpointMap[XCA_DQ_STRING];
  }
  if (endpointMap[XCA_DR_STRING]) {
    urls.urlDR = endpointMap[XCA_DR_STRING];
  }

  return urls;
}

function getCoordinates(address: Address[] | undefined): { lat: string; lon: string } | undefined {
  if (!address) return;
  const coordinates = address.flatMap(a => {
    if (a.extension?.url === "OrgPosition") {
      const position = a.extension?.valueCodeableConcept?.coding?.value?.position;
      if (!position) return [];
      return {
        lat: position.latitude.value,
        lon: position.longitude.value,
      };
    }
  })[0];

  return coordinates;
}

function getState(address: Address[] | undefined): string | undefined {
  if (!address) return;
  if (address.length > 0 && address[0].state) return address[0].state.value ?? undefined;
  return;
}
