import { faker } from "@faker-js/faker";
import { USState } from "@metriport/core/domain/geographic-locations";
import { Patient, PatientData, PersonalIdentifier } from "@metriport/core/domain/patient";
import dayjs from "dayjs";
import { PatientCreateCmd } from "../../../command/medical/patient/create-patient";
import { ISO_DATE } from "../../../shared/date";
import { makeBaseDomain } from "../../__tests__/base-domain";
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
    documentQueryProgress: data.documentQueryProgress,
    patientDiscovery: data.patientDiscovery,
    consolidatedQueries: data.consolidatedQueries,
    cxDocumentRequestMetadata: data.cxDocumentRequestMetadata,
    cxConsolidatedRequestMetadata: data.cxConsolidatedRequestMetadata,
    externalData: data.externalData,
  };
}

export function makePatient(params: Partial<Patient> = {}): Patient {
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? faker.string.uuid(),
    facilityIds: params.facilityIds ?? [faker.string.uuid()],
    data: makePatientData(params.data),
  };
}

export function makePatientCreate(params: Partial<PatientCreateCmd> = {}): PatientCreateCmd {
  return {
    ...makeBaseDomain(),
    cxId: params.cxId ?? faker.string.uuid(),
    facilityId: params.facilityId ?? faker.string.uuid(),
    ...makePatientData(params),
  };
}
