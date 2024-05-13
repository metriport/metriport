import { Patient } from "@medplum/fhirtypes";
import {
  buildTelecom,
  buildAddress,
  withoutNullFlavorObject,
  withoutNullFlavorString,
  buildCodeCE,
  buildInstanceIdentifiersFromIdentifier,
  formatDateToCDATimestamp,
} from "../commons";
import { CdaRecordTarget, CdaPatientRole } from "../../cda-types/shared-types";
import { useAttribute, valueAttribute } from "../constants";

function buildPatient(patient: Patient): CdaPatientRole {
  return {
    name: patient.name?.map(name => ({
      ...withoutNullFlavorObject(name.use, useAttribute),
      given: withoutNullFlavorString(name.given?.join(" ")),
      family: name.family,
      validTime: {
        low: withoutNullFlavorObject(undefined, valueAttribute),
        high: withoutNullFlavorObject(undefined, valueAttribute),
      },
    })),
    administrativeGenderCode: buildCodeCE({
      code: patient.gender,
      codeSystem: "2.16.840.1.113883.5.1",
      codeSystemName: "AdministrativeGender",
    }),
    birthTime: withoutNullFlavorObject(formatDateToCDATimestamp(patient.birthDate), valueAttribute),
    deceasedInd: withoutNullFlavorObject(patient.deceasedBoolean?.toString(), valueAttribute),
    maritalStatusCode: buildCodeCE({
      code: patient.maritalStatus?.coding?.[0]?.code,
      codeSystem: "2.16.840.1.113883.5.2",
      codeSystemName: "MaritalStatusCode",
      displayName: patient.maritalStatus?.coding?.[0]?.display,
    }),
    languageCommunication: {
      languageCode: buildCodeCE({
        code: patient.communication?.[0]?.language?.coding?.[0]?.code,
      }),
    },
  };
}

export function buildRecordTargetFromFhirPatient(patient: Patient): CdaRecordTarget {
  const recordTarget = {
    patientRole: {
      id: buildInstanceIdentifiersFromIdentifier(patient.identifier),
      addr: buildAddress(patient.address),
      telecom: buildTelecom(patient.telecom),
      patient: buildPatient(patient),
    },
  };
  return recordTarget;
}
