import { rand, randFirstName, randLastName, randPastDate, randUuid } from "@ngneat/falso";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../shared/date";
import { USState } from "@metriport/core/domain/geographic-locations";
import { makeBaseDomain } from "../../__tests__/base-domain";
import { Patient, PatientData, PersonalIdentifier } from "../patient";
import { makeAddressStrict } from "./location-address";

export const makePersonalIdentifier = (): PersonalIdentifier => {
  return {
    type: "driversLicense",
    value: randUuid(),
    state: rand(Object.values(USState)),
  };
};
export const makePatientData = (data: Partial<PatientData> = {}): PatientData => {
  return {
    firstName: data.firstName ?? randFirstName(),
    lastName: data.lastName ?? randLastName(),
    dob: data.dob ?? dayjs(randPastDate()).format(ISO_DATE),
    genderAtBirth: data.genderAtBirth ?? rand(["F", "M"]),
    personalIdentifiers: data.personalIdentifiers ?? [makePersonalIdentifier()],
    address: data.address ?? [makeAddressStrict()],
    documentQueryProgress: data.documentQueryProgress,
  };
};
export const makePatient = (params: Partial<Patient> = {}): Patient => {
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? randUuid(),
    facilityIds: params.facilityIds ?? [randUuid()],
    data: makePatientData(params.data),
  };
};
