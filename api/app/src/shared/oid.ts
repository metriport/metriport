import { Organization } from "../models/medical/organization";
import { Config } from "./config";

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

export const OID_ID_START = 100;

export const createOrgId = async () => {
  const curMaxNumber = (await Organization.max("organizationNumber")) as number;
  const orgNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;

  return {
    orgId: `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}`,
    orgNumber,
  };
};
