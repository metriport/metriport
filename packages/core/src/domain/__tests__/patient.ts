import { faker } from "@faker-js/faker";
import { USState } from "@metriport/shared";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { Contact } from "../contact";
import { Patient, PatientData, PersonalIdentifier } from "../patient";
import { makeBaseDomain } from "./base-domain";
import { generateDriversLicenseForState } from "./drivers-license";
import { makeAddressStrict } from "./location-address";

/** @deprecated use the specific type of personal identifier */
export function makePersonalIdentifier(): PersonalIdentifier {
  return makePersonalIdentifierDriversLicense();
}
export function makePersonalIdentifierDriversLicense(): PersonalIdentifier {
  const state = faker.helpers.arrayElement(Object.values(USState));
  return {
    type: "driversLicense",
    value: generateDriversLicenseForState(state),
    state,
  };
}

export function makePersonalIdentifierSsn(): PersonalIdentifier {
  return {
    type: "ssn",
    value: faker.helpers.replaceSymbols("#########"),
  };
}

export function makeContact(): Contact {
  return {
    email: faker.internet.email(),
    phone: faker.helpers.replaceSymbols("##########"),
  };
}

export function makePatientData(data: Partial<PatientData> = {}): PatientData {
  return {
    firstName: data.firstName ?? faker.person.firstName(),
    lastName: data.lastName ?? faker.person.lastName(),
    dob: data.dob ?? dayjs(faker.date.past()).format(ISO_DATE),
    genderAtBirth: data.genderAtBirth ?? faker.helpers.arrayElement(["F", "M"]),
    personalIdentifiers: data.personalIdentifiers ?? [makePersonalIdentifier()],
    contact: [makeContact()],
    address: data.address ?? [makeAddressStrict()],
    consolidatedLinkDemographics: data.consolidatedLinkDemographics,
    consolidatedQueries: data.consolidatedQueries,
    cxDocumentRequestMetadata: data.cxDocumentRequestMetadata,
    cxConsolidatedRequestMetadata: data.cxConsolidatedRequestMetadata,
    externalData: data.externalData,
  };
}

export function makePatient(
  params: Partial<Omit<Patient, "data"> & { data: Partial<PatientData> }> = {}
): Patient {
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? faker.string.uuid(),
    facilityIds: params.facilityIds ?? [faker.string.uuid()],
    data: makePatientData(params.data),
  };
}
