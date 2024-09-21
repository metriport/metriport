import { faker } from "@faker-js/faker";
import { USState } from "@metriport/shared";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { Patient, PatientData, PersonalIdentifier } from "../patient";
import { makeBaseDomain } from "./base-domain";
import { makeAddressStrict } from "./location-address";

export function makePersonalIdentifier(): PersonalIdentifier {
  return {
    type: "driversLicense",
    value: faker.string.uuid(),
    state: faker.helpers.arrayElement(Object.values(USState)),
  };
}

export function makePatientData(data: Partial<PatientData> = {}): PatientData {
  return {
    firstName: data.firstName ?? faker.person.firstName(),
    lastName: data.lastName ?? faker.person.lastName(),
    dob: data.dob ?? dayjs(faker.date.past()).format(ISO_DATE),
    genderAtBirth: data.genderAtBirth ?? faker.helpers.arrayElement(["F", "M"]),
    personalIdentifiers: data.personalIdentifiers ?? [makePersonalIdentifier()],
    address: data.address ?? [makeAddressStrict()],
    consolidatedLinkDemographics: data.consolidatedLinkDemographics,
    documentQueryProgress: data.documentQueryProgress,
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
