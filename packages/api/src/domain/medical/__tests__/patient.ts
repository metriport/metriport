import { faker } from "@faker-js/faker";
import { USState } from "@metriport/core/domain/geographic-locations";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../shared/date";
import { makeBaseDomain } from "../../__tests__/base-domain";
import { Patient, PatientData, PersonalIdentifier } from "@metriport/core/domain/patient";
import { makeAddressStrict } from "./location-address";

export const makePersonalIdentifier = (): PersonalIdentifier => {
  return {
    type: "driversLicense",
    value: faker.string.uuid(),
    state: faker.helpers.arrayElement(Object.values(USState)),
  };
};
export const makePatientData = (data: Partial<PatientData> = {}): PatientData => {
  return {
    firstName: data.firstName ?? faker.person.firstName(),
    lastName: data.lastName ?? faker.person.lastName(),
    dob: data.dob ?? dayjs(faker.date.past()).format(ISO_DATE),
    genderAtBirth: data.genderAtBirth ?? faker.helpers.arrayElement(["F", "M"]),
    personalIdentifiers: data.personalIdentifiers ?? [makePersonalIdentifier()],
    address: data.address ?? [makeAddressStrict()],
    documentQueryProgress: data.documentQueryProgress,
    patientDiscovery: data.patientDiscovery,
    consolidatedQuery: data.consolidatedQuery,
    cxDocumentRequestMetadata: data.cxDocumentRequestMetadata,
    cxConsolidatedRequestMetadata: data.cxConsolidatedRequestMetadata,
  };
};
export const makePatient = (params: Partial<Patient> = {}): Patient => {
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? faker.string.uuid(),
    facilityIds: params.facilityIds ?? [faker.string.uuid()],
    data: makePatientData(params.data),
  };
};
