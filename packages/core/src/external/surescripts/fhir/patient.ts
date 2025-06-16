import { BadRequestError } from "@metriport/shared";
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

export function mergePatient(patient: Patient, otherPatient?: Patient): Patient {
  if (!otherPatient) return patient;
  if (otherPatient.id !== patient.id) {
    throw new BadRequestError("Patient IDs do not match");
  }
  return Object.assign({}, patient, otherPatient);
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
