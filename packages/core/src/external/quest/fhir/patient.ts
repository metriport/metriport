import {
  Patient,
  HumanName,
  Identifier,
  Address,
  ContactPoint,
  Reference,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

export function getPatient(detail: ResponseDetail): Patient {
  const name = getPatientName(detail);
  const identifier = getPatientIdentifier(detail);
  const address = getPatientAddress(detail);
  const telecom = getPatientTelecom(detail);
  const gender = getPatientGender(detail);
  const birthDate = getPatientBirthDate(detail);

  return {
    resourceType: "Patient",
    ...(name ? { name } : {}),
    ...(identifier ? { identifier } : {}),
    ...(address ? { address } : {}),
    ...(telecom ? { telecom } : {}),
    ...(gender ? { gender } : {}),
    ...(birthDate ? { birthDate } : {}),
  };
}

export function getPatientReference(patient: Patient): Reference<Patient> {
  return {
    reference: `Patient/${patient.id}`,
  };
}

function getPatientName(detail: ResponseDetail): HumanName[] | undefined {
  if (!detail.patientLastName) return undefined;
  const given: string[] | undefined = detail.patientFirstName
    ? [detail.patientFirstName]
    : undefined;
  const family: string = detail.patientLastName;
  if (given && detail.patientMiddleName) {
    given.push(detail.patientMiddleName);
  }

  return [
    {
      ...(given ? { given } : {}),
      family,
    },
  ];
}

function getPatientAddress(detail: ResponseDetail): Address[] | undefined {
  if (!detail.addressLine1 || !detail.city || !detail.state || !detail.zipCode) return undefined;
  return [
    {
      line: [detail.addressLine1, detail.addressLine2].filter(Boolean) as string[],
      city: detail.city,
      state: detail.state,
      postalCode: detail.zipCode,
      country: "US",
    },
  ];
}

function getPatientTelecom(detail: ResponseDetail): ContactPoint[] | undefined {
  if (!detail.phoneNumber) return undefined;
  return [
    {
      system: "phone",
      value: detail.phoneNumber,
    },
  ];
}

function getPatientIdentifier(detail: ResponseDetail): Identifier[] | undefined {
  const identifiers: Identifier[] = [
    {
      system: "https://metriport.com/patient-id",
      value: detail.patientId,
    },
  ];

  if (detail.socialSecurityNumber) {
    identifiers.push({
      system: "http://hl7.org/fhir/sid/us-ssn",
      value: detail.socialSecurityNumber,
    });
  }

  return identifiers;
}

function getPatientGender(detail: ResponseDetail): Patient["gender"] | undefined {
  if (!detail.gender) return undefined;
  switch (detail.gender) {
    case "M":
      return "male";
    case "F":
      return "female";
    default:
      return "unknown";
  }
}

function getPatientBirthDate(detail: ResponseDetail): string | undefined {
  if (!detail.dateOfBirth) return undefined;
  return detail.dateOfBirth;
}
