#!/usr/bin/env node
import {
  AddressUseCodes,
  IdentifierUseCodes,
  NameUseCodes,
  Person,
} from "@metriport/commonwell-sdk";
import * as nanoid from "nanoid";
import { X509Certificate } from "crypto";

import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { getEnvOrFail } from "./util";

const commonwellOID = getEnvOrFail("COMMONWELL_OID");
const commonwellCertificateContent = getEnvOrFail("COMMONWELL_CERTIFICATE_CONTENT");
const commonwellCertificate = getEnvOrFail("COMMONWELL_CERTIFICATE");
const commonwellOrgName = getEnvOrFail("COMMONWELL_ORG_NAME");

export const metriportSystem = `urn:oid:${commonwellOID}`;

const docPatientFirstName = getEnvOrFail("DOCUMENT_PATIENT_FIRST_NAME");
const docPatientLastName = getEnvOrFail("DOCUMENT_PATIENT_LAST_NAME");
const docPatientDateOfBirth = getEnvOrFail("DOCUMENT_PATIENT_DATE_OF_BIRTH");
const docPatientGender = getEnvOrFail("DOCUMENT_PATIENT_GENDER");
const docPatientZip = getEnvOrFail("DOCUMENT_PATIENT_ZIP");

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
export const patient = {
  identifier: [
    {
      use: "unspecified",
      label: commonwellOrgName,
      system: metriportSystem,
      key: nanoid.nanoid(),
      assigner: commonwellOrgName,
    },
  ],
  details: mainDetails,
};

export const mergePatient = {
  identifier: [
    {
      use: "unspecified",
      label: commonwellOrgName,
      system: metriportSystem,
      key: nanoid.nanoid(),
      assigner: commonwellOrgName,
    },
  ],
  details: secondaryDetails,
};

const docPatientKey = nanoid.nanoid();

export const docIdentifier = {
  // use: "unspecified",
  use: IdentifierUseCodes.usual,
  label: commonwellOrgName,
  system: metriportSystem,
  key: docPatientKey,
};
export const docMainPayload = {
  identifier: [docIdentifier],
  details: {
    address: [
      {
        use: NameUseCodes.usual,
        zip: docPatientZip,
        country: "USA",
      },
    ],
    name: [
      {
        use: NameUseCodes.usual,
        family: [docPatientLastName],
        given: [docPatientFirstName],
      },
    ],
    gender: {
      code: docPatientGender,
    },
    birthDate: docPatientDateOfBirth,
  },
};
export const docPerson = {
  ...docMainPayload,
  details: {
    ...docMainPayload.details,
    identifier: [],
  },
};
export const docPatient = docMainPayload;

// ORGANIZATION
const appendOrgId = nanoid.customAlphabet("1234567890", 18)();
const shortName: string = uniqueNamesGenerator({
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
});

export const organization = {
  organizationId: `urn:oid:${commonwellOID}.${appendOrgId}`,
  homeCommunityId: `urn:oid:${commonwellOID}.${appendOrgId}`,
  name: shortName,
  displayName: shortName,
  memberName: "Metriport",
  type: "Hospital",
  patientIdAssignAuthority: `urn:oid:${commonwellOID}.${appendOrgId}`,
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
  ],
};
