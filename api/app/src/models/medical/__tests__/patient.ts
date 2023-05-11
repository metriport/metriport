import {
  rand,
  randFirstName,
  randLastName,
  randNumber,
  randPastDate,
  randUuid,
} from "@ngneat/falso";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../shared/date";
import { USState } from "../../../shared/geographic-locations";
import { makeBaseModel } from "../../__tests__/base-model";
import { Patient, PatientData, PersonalIdentifier } from "../patient";
import { makeAddressStrict } from "./location-address";

export const makePersonalIdentifier = (): PersonalIdentifier => {
  return {
    type: "driversLicense",
    value: randUuid(),
    state: rand(Object.values(USState)),
  };
};
export const makePatientData = (data?: Partial<PatientData>): PatientData => {
  return {
    firstName: data?.firstName ?? randFirstName(),
    lastName: data?.lastName ?? randLastName(),
    dob: data?.dob ?? dayjs(randPastDate()).format(ISO_DATE),
    genderAtBirth: data?.genderAtBirth ?? rand(["F", "M"]),
    personalIdentifiers: data?.personalIdentifiers ?? [makePersonalIdentifier()],
    address: data?.address ?? [makeAddressStrict()],
  };
};
export const makePatient = (data?: Partial<Patient>): Patient => {
  return {
    ...makeBaseModel(),
    ...(data?.id ? { id: data.id } : {}),
    cxId: data?.cxId ?? randUuid(),
    patientNumber: data?.patientNumber ?? randNumber(),
    facilityIds: data?.facilityIds ?? [randUuid()],
    data: makePatientData(data?.data),
  };
};
