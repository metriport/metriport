import {
  ORG_POSITION,
  TRANSACTION_URL,
  XCA_DQ_STRING,
  XCA_DR_STRING,
  XCPD_STRING,
} from "@metriport/carequality-sdk/common/util";
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
    if (!org) {
      return [];
    }
    const normalizedOid = getOid(org);
    if (!normalizedOid) return [];

    const url = getUrls(org.contained);
    if (!url?.urlXCPD) return [];

    const coordinates = getCoordinates(org.address);
    const state = getState(org.address);

    const orgData: CQDirectoryEntryData = {
      oid: normalizedOid,
      name: org.name?.value ?? undefined,
      urlXCPD: url.urlXCPD,
      urlDQ: url.urlDQ,
      urlDR: url.urlDR,
      lat: coordinates?.lat ? parseFloat(coordinates?.lat) : undefined,
      lon: coordinates?.lon ? parseFloat(coordinates?.lon) : undefined,
      state,
      data: org,
    };
    return orgData;
  });
  return orgs;
}

function getUrls(contained: Contained): XCUrls | undefined {
  const endpointMap: Record<string, string> = {};

  contained?.forEach(c => {
    const ext = c?.Endpoint.extension.extension.find(ext => ext.url === TRANSACTION_URL);
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
    if (a.extension?.url === ORG_POSITION) {
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

function getState(addresses: Address[] | undefined): string | undefined {
  if (!addresses) return;
  if (addresses.length > 0 && addresses[0].state) return addresses[0].state.value ?? undefined;
  return;
}

function getOid(org: Organization): string | undefined {
  const oid = org?.identifier?.value?.value;
  if (!oid) return;
  try {
    return normalizeOid(oid);
  } catch (err) {
    console.log(`Organization ${org?.name?.value} has invalid OID: ${oid}`);
  }
}
