#!/usr/bin/env node
import {
  AddressUseCodes,
  CertificatePurpose,
  Demographics,
  Identifier,
  NameUseCodes,
  Organization,
  Patient,
  Person,
} from "@metriport/commonwell-sdk";
import { X509Certificate } from "crypto";
import dayjs from "dayjs";
import * as nanoid from "nanoid";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";
import {
  clientId,
  clientSecret,
  docAuthUrl,
  docPatientDateOfBirth,
  docPatientFirstName,
  docPatientGender,
  docPatientLastName,
  docPatientZip,
  docUrl,
  memberCertificateString,
  memberName,
  memberOID,
  orgCertificateString,
} from "./env";
import { getCertificateContent } from "./util";

const ORGANIZATION = "5";
const LOCATION = "4";
const PATIENT = "2";
const idAlphabet = "123456789";

export const CW_ID_PREFIX = "urn:oid:";

export function makeId(): string {
  return nanoid.customAlphabet(idAlphabet, 6)();
}
export function makeOrgId(orgId?: string): string {
  const org = orgId ?? makeId();
  return `${memberOID}.${ORGANIZATION}.${org}`;
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
export const caDriversLicenseUri = `${CW_ID_PREFIX}2.16.840.1.113883.4.3.6`;
export const driversLicenseId = nanoid.nanoid();

export const identifier: Identifier = {
  use: "usual",
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
export function makePatient({
  facilityId = makeFacilityId(),
  details = mainDetails,
}: { facilityId?: string; details?: Demographics } = {}): Patient {
  return {
    identifier: [
      {
        use: "old", // official?
        label: memberName,
        system: `${CW_ID_PREFIX}${facilityId}`,
        key: makePatientId({ facilityId }),
        assigner: memberName,
      },
    ],
    details,
  };
}

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

export function makeOrganization(suffixId?: string): Organization {
  const orgId = makeOrgId(suffixId);
  return {
    organizationId: `${orgId}`,
    homeCommunityId: `${orgId}`,
    name: shortName,
    displayName: shortName,
    memberName: "Metriport",
    type: "Hospital",
    searchRadius: 50,
    // patientIdAssignAuthority: `${CW_ID_PREFIX}${orgId}`,
    patientIdAssignAuthority: `${orgId}`,
    securityTokenKeyType: "",
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
}

export function makeDocContribOrganization(suffixId?: string): Organization {
  const orgId = makeOrgId(suffixId);
  return {
    organizationId: `${CW_ID_PREFIX}${orgId}`,
    homeCommunityId: `${CW_ID_PREFIX}${orgId}`,
    name: `Provider${suffixId}`,
    displayName: `Provider${suffixId}`,
    memberName: "Metriport",
    type: "Hospital",
    patientIdAssignAuthority: `${CW_ID_PREFIX}${orgId}`,
    securityTokenKeyType: null,
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
    searchRadius: 50,
    technicalContacts: [
      {
        name: "Technician",
        title: "TechnicalContact",
        email: "technicalContact@dummymail.com",
        phone: "303-555-1212",
      },
    ],
    gateways: [
      {
        serviceType: "XCA_Query",
        gatewayType: "R4",
        endpointLocation: docUrl,
      },
    ],
    authorizationInformation: {
      authorizationServerEndpoint: docAuthUrl,
      clientId: clientId,
      clientSecret: clientSecret,
      documentReferenceScope: "fhir/document",
      binaryScope: "fhir/document",
    },
  };
}

function getCertificateAndFingerprint(certString: string) {
  const x509 = new X509Certificate(certString);
  const validFrom = dayjs(x509.validFrom).toString();
  const validTo = dayjs(x509.validTo).toString();
  const certificateContent = getCertificateContent(certString);

  const fingerprint = x509.fingerprint;

  const certificate = {
    Certificates: [
      {
        startDate: validFrom,
        endDate: validTo,
        expirationDate: validTo,
        thumbprint: fingerprint,
        content: certificateContent,
        purpose: CertificatePurpose.Authentication,
      },
      {
        startDate: validFrom,
        endDate: validTo,
        expirationDate: validTo,
        thumbprint: fingerprint,
        content: certificateContent,
        purpose: CertificatePurpose.Signing,
      },
    ],
  };
  return { certificate, fingerprint };
}

const memberCertData = getCertificateAndFingerprint(memberCertificateString);
export const memberCertificateFingerprint = memberCertData.fingerprint;
export const memberCertificate = memberCertData.certificate;

const orgCertData = getCertificateAndFingerprint(orgCertificateString);
export const orgCertificateFingerprint = orgCertData.fingerprint;
export const orgCertificate = orgCertData.certificate;
