import { Patient } from "@medplum/fhirtypes";
import { CdaPatientRole, CdaRecordTarget } from "../../cda-types/shared-types";
import {
  buildAddress,
  buildCodeCe,
  buildInstanceIdentifiersFromIdentifier,
  buildTelecom,
  formatDateToCdaTimestamp,
  withoutNullFlavorObject,
  withoutNullFlavorString,
} from "../commons";
import { _useAttribute, _valueAttribute } from "../constants";

function buildPatient(patient: Patient): CdaPatientRole {
  return {
    name: patient.name?.map(name => {
      const nameUse = mapNameUse(name.use);
      return {
        ...withoutNullFlavorObject(nameUse, _useAttribute),
        given: withoutNullFlavorString(name.given?.join(" ")),
        family: name.family,
        validTime: {
          low: withoutNullFlavorObject(undefined, _valueAttribute),
          high: withoutNullFlavorObject(undefined, _valueAttribute),
        },
      };
    }),
    administrativeGenderCode: buildCodeCe({
      code: patient.gender,
      codeSystem: "2.16.840.1.113883.5.1",
      codeSystemName: "AdministrativeGender",
    }),
    birthTime: withoutNullFlavorObject(
      formatDateToCdaTimestamp(patient.birthDate),
      _valueAttribute
    ),
    deceasedInd: withoutNullFlavorObject(patient.deceasedBoolean?.toString(), _valueAttribute),
    maritalStatusCode: buildCodeCe({
      code: patient.maritalStatus?.coding?.[0]?.code,
      codeSystem: "2.16.840.1.113883.5.2",
      codeSystemName: "MaritalStatusCode",
      displayName: patient.maritalStatus?.coding?.[0]?.display,
    }),
    languageCommunication: {
      languageCode: buildCodeCe({
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

function mapNameUse(use: string | undefined) {
  if (!use) return undefined;
  // From EntityNameUse of the CDA R2 IG
  switch (use.toLowerCase()) {
    case "artist" || "stage":
      return "A";
    case "alphabetic":
      return "ABC";
    case "assigned":
      return "ASGN";
    case "license":
      return "C";
    case "indigenous" || "tribal":
      return "I";
    case "ideographic":
      return "IDE";
    case "usual" || "legal":
      return "L";
    case "pseudonim":
      return "P";
    case "phonetic":
      return "PHON";
    case "religious":
      return "R";
  }
  return use;
}
