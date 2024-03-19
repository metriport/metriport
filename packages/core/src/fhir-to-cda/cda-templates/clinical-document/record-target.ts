import { Patient } from "@medplum/fhirtypes";
import {
  buildTelecom,
  buildAddress,
  withNullFlavor,
  withNullFlavorObject,
  buildCodeCE,
  buildInstanceIdentifiersFromIdentifier,
} from "../commons";
import { CDARecordTarget } from "../types";

function buildPatient(patient: Patient) {
  return {
    name: patient.name?.map(name => ({
      ...withNullFlavorObject(name.use, "@_use"),
      given: withNullFlavor(name.given?.join(" ")),
      family: withNullFlavor(name.family),
      validTime: {
        low: { "@_nullFlavor": "UNK" },
        high: { "@_nullFlavor": "UNK" },
      },
    })),
    administrativeGenderCode: buildCodeCE({
      code: patient.gender,
      codeSystem: "2.16.840.1.113883.5.1",
      codeSystemName: "AdministrativeGender",
    }),
    birthTime: withNullFlavorObject(patient.birthDate, "@_value"),
    deceasedInd: withNullFlavorObject(patient.deceasedBoolean?.toString(), "@_value"),
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

export function buildRecordTargetFromFhirPatient(patient: Patient): CDARecordTarget {
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
