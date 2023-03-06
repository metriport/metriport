import { Organization } from "../models/medical/organization";
import { Config } from "./config";

export const OID_ID_START = 100;
export const OID_PREFIX = "urn:oid:";
export const OID_URL_ENCODED_PREFIX = `%5E%5E%5Eurn%3aoid%3a`;

export enum OIDNode {
  documents = 1,
  patients = 2,
  personnel = 3,
  locations = 4,
  organizations = 5,
  devices = 6,
  encounters = 7,
  orders = 8,
  sections = 9,
  entries_statements = 10,
  templates = 11,
  local_vocab = 12,
  other = 13,
}

export function oid(id: string): string {
  return `${OID_PREFIX}${id}`;
}

// TODO  #369 Add remaining
export enum USState {
  CA = "CA",
}

// TODO  #369 update this
export const driversLicenseURIs: { [k in USState]: string } = {
  CA: `${OID_PREFIX}2.16.840.1.113883.4.3.6`,
};

export const createOrgId = async () => {
  const curMaxNumber = (await Organization.max("organizationNumber")) as number;
  const orgNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;

  return {
    orgId: `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}`,
    orgNumber,
  };
};
