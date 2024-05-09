import { USState } from "./geographic-locations";
import { generalPersonalIdentifiers } from "../domain/patient";

export const OID_ID_START = 100;
export const OID_PREFIX = "urn:oid:";

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

export function addOidPrefix(oid: string): string {
  return `${OID_PREFIX}${oid}`;
}

export const driversLicenseURIs: { [k in USState]: string } = {
  AK: `${OID_PREFIX}2.16.840.1.113883.4.3.2`,
  AL: `${OID_PREFIX}2.16.840.1.113883.4.3.1`,
  AR: `${OID_PREFIX}2.16.840.1.113883.4.3.5`,
  AZ: `${OID_PREFIX}2.16.840.1.113883.4.3.4`,
  CA: `${OID_PREFIX}2.16.840.1.113883.4.3.6`,
  CO: `${OID_PREFIX}2.16.840.1.113883.4.3.8`,
  CT: `${OID_PREFIX}2.16.840.1.113883.4.3.9`,
  DC: `${OID_PREFIX}2.16.840.1.113883.4.3.11`,
  DE: `${OID_PREFIX}2.16.840.1.113883.4.3.10`,
  FL: `${OID_PREFIX}2.16.840.1.113883.4.3.12`,
  GA: `${OID_PREFIX}2.16.840.1.113883.4.3.13`,
  HI: `${OID_PREFIX}2.16.840.1.113883.4.3.15`,
  IN: `${OID_PREFIX}2.16.840.1.113883.4.3.18`,
  IA: `${OID_PREFIX}2.16.840.1.113883.4.3.19`,
  ID: `${OID_PREFIX}2.16.840.1.113883.4.3.16`,
  IL: `${OID_PREFIX}2.16.840.1.113883.4.3.17`,
  KS: `${OID_PREFIX}2.16.840.1.113883.4.3.20`,
  KY: `${OID_PREFIX}2.16.840.1.113883.4.3.21`,
  LA: `${OID_PREFIX}2.16.840.1.113883.4.3.22`,
  MA: `${OID_PREFIX}2.16.840.1.113883.4.3.25`,
  MD: `${OID_PREFIX}2.16.840.1.113883.4.3.24`,
  ME: `${OID_PREFIX}2.16.840.1.113883.4.3.23`,
  MI: `${OID_PREFIX}2.16.840.1.113883.4.3.26`,
  MN: `${OID_PREFIX}2.16.840.1.113883.4.3.27`,
  MO: `${OID_PREFIX}2.16.840.1.113883.4.3.29`,
  MS: `${OID_PREFIX}2.16.840.1.113883.4.3.28`,
  MT: `${OID_PREFIX}2.16.840.1.113883.4.3.30`,
  NY: `${OID_PREFIX}2.16.840.1.113883.4.3.36`,
  NC: `${OID_PREFIX}2.16.840.1.113883.4.3.37`,
  ND: `${OID_PREFIX}2.16.840.1.113883.4.3.38`,
  NE: `${OID_PREFIX}2.16.840.1.113883.4.3.31`,
  NH: `${OID_PREFIX}2.16.840.1.113883.4.3.33`,
  NJ: `${OID_PREFIX}2.16.840.1.113883.4.3.34`,
  NM: `${OID_PREFIX}2.16.840.1.113883.4.3.35`,
  NV: `${OID_PREFIX}2.16.840.1.113883.4.3.32`,
  OH: `${OID_PREFIX}2.16.840.1.113883.4.3.39`,
  OK: `${OID_PREFIX}2.16.840.1.113883.4.3.40`,
  OR: `${OID_PREFIX}2.16.840.1.113883.4.3.41`,
  PA: `${OID_PREFIX}2.16.840.1.113883.4.3.42`,
  RI: `${OID_PREFIX}2.16.840.1.113883.4.3.44`,
  SC: `${OID_PREFIX}2.16.840.1.113883.4.3.45`,
  SD: `${OID_PREFIX}2.16.840.1.113883.4.3.46`,
  TN: `${OID_PREFIX}2.16.840.1.113883.4.3.47`,
  TX: `${OID_PREFIX}2.16.840.1.113883.4.3.48`,
  UT: `${OID_PREFIX}2.16.840.1.113883.4.3.49`,
  VA: `${OID_PREFIX}2.16.840.1.113883.4.3.51`,
  VT: `${OID_PREFIX}2.16.840.1.113883.4.3.50`,
  WA: `${OID_PREFIX}2.16.840.1.113883.4.3.53`,
  WI: `${OID_PREFIX}2.16.840.1.113883.4.3.55`,
  WV: `${OID_PREFIX}2.16.840.1.113883.4.3.54`,
  WY: `${OID_PREFIX}2.16.840.1.113883.4.3.56`,
};

export const ssnURI = `${OID_PREFIX}2.16.840.1.113883.4.1`;

export const medicareURI = `${OID_PREFIX}2.16.840.1.113883.4.572`;

// There is one OID for each country: https://terminology.hl7.org/artifacts.html
export const passportURI = `${OID_PREFIX}2.16.840.1.113883.4.330`;

export const identifierSytemByType: Record<(typeof generalPersonalIdentifiers)[number], string> = {
  ssn: ssnURI,
};
