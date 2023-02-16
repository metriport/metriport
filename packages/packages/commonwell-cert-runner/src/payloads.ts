#!/usr/bin/env node
import {
  AddressUseCodes,
  IdentifierUseCodes,
  NameUseCodes,
  Person,
} from "@metriport/commonwell-sdk";
import { Demographics } from "@metriport/commonwell-sdk/lib/models/demographics";
import { X509Certificate } from "crypto";
import * as nanoid from "nanoid";

import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";
import { getCertificateContent, getEnvOrFail } from "./util";

const commonwellOID = getEnvOrFail("COMMONWELL_OID");
const commonwellOrgName = getEnvOrFail("COMMONWELL_ORG_NAME");
const commonwellCertificate = getEnvOrFail("COMMONWELL_CERTIFICATE");
const commonwellCertificateContent = getCertificateContent(commonwellCertificate);

const docPatientFirstName = getEnvOrFail("DOCUMENT_PATIENT_FIRST_NAME");
const docPatientLastName = getEnvOrFail("DOCUMENT_PATIENT_LAST_NAME");
const docPatientDateOfBirth = getEnvOrFail("DOCUMENT_PATIENT_DATE_OF_BIRTH");
const docPatientGender = getEnvOrFail("DOCUMENT_PATIENT_GENDER");
const docPatientZip = getEnvOrFail("DOCUMENT_PATIENT_ZIP");

const ORGANIZATION = "5";
const LOCATION = "4";
const PATIENT = "2";
const idAlphabet = "1234567890";

export function makeId(): string {
  return nanoid.customAlphabet(idAlphabet, 6)();
}
export function makeOrgId(orgId?: string): string {
  const org = orgId ?? makeId();
  return `${commonwellOID}.${ORGANIZATION}.${org}`;
}
export function makeFacilityId(orgId?: string): string {
  const facility = makeId();
  return orgId ? `${orgId}.${LOCATION}.${facility}` : `${makeOrgId()}.${LOCATION}.${facility}`;
}
export function makePatientId({
  orgId,
  facilityId,
}: { orgId?: string; facilityId?: never } | { orgId?: never; facilityId?: string } = {}): string {
  const org = orgId ?? makeOrgId();
  const facility = facilityId ?? makeFacilityId(org);
  const patient = makeId();
  return `${facility}.${PATIENT}.${patient}`;
}

// PERSON
export const caDriversLicenseUri = "urn:oid:2.16.840.1.113883.4.3.6";
export const driversLicenseId = nanoid.nanoid();

export const identifier = {
  use: IdentifierUseCodes.usual,
  key: driversLicenseId,
  system: caDriversLicenseUri,
  period: {
    start: "1996-04-20T00:00:00Z",
  },
};

export const mainDetails = {
  address: [
    {
      use: AddressUseCodes.home,
      zip: "94041",
      state: "CA",
      line: ["335 Pioneer Way"],
      city: "Mountain View",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Paul"],
      family: ["Greyham"],
    },
  ],
  gender: {
    code: "M",
  },
  birthDate: "1980-04-20T00:00:00Z",
  identifier: [identifier],
};

const secondaryDetails = {
  address: [
    {
      use: AddressUseCodes.home,
      zip: "94111",
      state: "CA",
      line: ["755 Sansome Street"],
      city: "San Francisco",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Mary"],
      family: ["Jane"],
    },
  ],
  gender: {
    code: "F",
  },
  birthDate: "2000-04-20T00:00:00Z",
};

export const personStrongId: Person = {
  details: {
    ...mainDetails,
    identifier: [identifier],
  },
};

export const personNoStrongId: Person = {
  details: secondaryDetails,
};

// PATIENT
export const makePatient = ({
  facilityId = makeFacilityId(),
  details = mainDetails,
}: { facilityId?: string; details?: Demographics } = {}) => ({
  identifier: [
    {
      use: "unspecified",
      label: commonwellOrgName,
      system: `urn:oid:${facilityId}`,
      key: makePatientId({ facilityId }),
      assigner: commonwellOrgName,
    },
  ],
  details,
});

export const makeMergePatient = ({ facilityId = makeFacilityId() }: { facilityId?: string } = {}) =>
  makePatient({ facilityId, details: secondaryDetails });

export type PersonData = {
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  zip?: string;
};
type PersonDataOnOrg = PersonData & { facilityId?: string };

export const makeDocPatient = ({
  firstName = docPatientFirstName,
  lastName = docPatientLastName,
  dob = docPatientDateOfBirth,
  gender = docPatientGender,
  zip = docPatientZip,
  facilityId = makeFacilityId(),
}: PersonDataOnOrg = {}) => ({
  identifier: makePatient({ facilityId }).identifier,
  details: {
    address: [
      {
        use: NameUseCodes.usual,
        zip,
        country: "USA",
      },
    ],
    name: [
      {
        use: NameUseCodes.usual,
        family: [lastName],
        given: [firstName],
      },
    ],
    gender: {
      code: gender,
    },
    birthDate: dob,
  },
});
export const makeDocPerson = (init?: PersonDataOnOrg) => {
  const docPatient = makeDocPatient(init);
  return {
    ...docPatient,
    details: {
      ...docPatient.details,
      identifier: [],
    },
  };
};

// ORGANIZATION
const shortName: string = uniqueNamesGenerator({
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
});

export const makeOrganization = (suffixId?: string) => {
  const orgId = makeOrgId(suffixId);
  return {
    organizationId: `urn:oid:${orgId}`,
    homeCommunityId: `urn:oid:${orgId}`,
    name: shortName,
    displayName: shortName,
    memberName: "Metriport",
    type: "Hospital",
    patientIdAssignAuthority: `urn:oid:${orgId}`,
    securityTokenKeyType: "BearerKey",
    isActive: true,
    locations: [
      {
        address1: "1 Main Street",
        address2: "PO Box 123",
        city: "Denver",
        state: "CO",
        postalCode: "80001",
        country: "USA",
        phone: "303-555-1212",
        fax: "303-555-1212",
        email: "here@dummymail.com",
      },
    ],
    technicalContacts: [
      {
        name: "Technician",
        title: "TechnicalContact",
        email: "technicalContact@dummymail.com",
        phone: "303-555-1212",
      },
    ],
  };
};

// CERTIFICATE
const x509 = new X509Certificate(commonwellCertificate);

export const thumbprint = x509.fingerprint;
export const certificate = {
  Certificates: [
    {
      startDate: "2022-12-31T11:46:29Z",
      endDate: "2023-03-31T12:46:28Z",
      expirationDate: "2023-03-31T12:46:28Z",
      thumbprint: thumbprint,
      content: commonwellCertificateContent,
      purpose: "Authentication",
    },
    {
      startDate: "2022-12-31T11:46:29Z",
      endDate: "2023-03-31T12:46:28Z",
      expirationDate: "2023-03-31T12:46:28Z",
      thumbprint: thumbprint,
      content: commonwellCertificateContent,
      purpose: "Signing",
    },
  ],
};
