import { Patient } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { convertDateToString } from "@metriport/shared/common/date";

export function getPatient(detail: ResponseDetail): Patient {
  const name = getPatientName(detail);
  const gender = getPatientGender(detail);
  const birthDate = getPatientBirthDate(detail);

  return {
    resourceType: "Patient",
    id: detail.patientId,
    ...(name ? { name } : undefined),
    ...(gender ? { gender } : undefined),
    ...(birthDate ? { birthDate } : undefined),
  };
}

function getPatientName(detail: ResponseDetail): Patient["name"] {
  return [
    {
      given: [detail.patientFirstName],
      family: detail.patientLastName,
    },
  ];
}

function getPatientGender(detail: ResponseDetail): Patient["gender"] {
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

function getPatientBirthDate(detail: ResponseDetail): Patient["birthDate"] {
  return convertDateToString(detail.patientDOB, { separator: "-" });
}
