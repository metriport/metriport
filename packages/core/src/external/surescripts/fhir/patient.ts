import { Patient } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";
import { convertDateToString } from "@metriport/shared/common/date";

export function getPatient(detail: FlatFileDetail): Patient {
  const name = getPatientName(detail);
  const gender = getPatientGender(detail);
  const birthDate = getPatientBirthDate(detail);

  return {
    resourceType: "Patient",
    id: detail.patientId,
    ...(name ? { name } : null),
    ...(gender ? { gender } : null),
    ...(birthDate ? { birthDate } : null),
  };
}

function getPatientName(detail: FlatFileDetail): Patient["name"] {
  return [
    {
      given: [detail.patientFirstName],
      family: detail.patientLastName,
    },
  ];
}

function getPatientGender(detail: FlatFileDetail): Patient["gender"] {
  switch (detail.patientGender) {
    case "M":
      return "male";
    case "F":
      return "female";
    case "U":
      return "unknown";
    case "N":
      return "other";
    default:
      return "unknown";
  }
}

function getPatientBirthDate(detail: FlatFileDetail): Patient["birthDate"] {
  return convertDateToString(detail.patientDOB, { separator: "-" });
}
