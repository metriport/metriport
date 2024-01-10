import {
  DocumentReference,
  Identifier,
  Patient as FHIRPatient,
  Reference,
} from "@medplum/fhirtypes";
import { driversLicenseURIs } from "@metriport/core/domain/oid";
import { ContactTypes } from "../../../domain/medical/contact";
import {
  GenderAtBirth,
  Patient,
  PersonalIdentifier,
  splitName,
} from "../../../domain/medical/patient";
import {
  getIdFromSubjectId,
  getIdFromSubjectRef,
} from "@metriport/core/external/fhir/shared/index";

export const genderMapping: { [k in GenderAtBirth]: "female" | "male" } = {
  F: "female",
  M: "male",
};

export const toFHIR = (patient: Patient): FHIRPatient => {
  return {
    resourceType: "Patient",
    id: patient.id,
    identifier: patient.data.personalIdentifiers
      ? convertDriversLicenseToIdentifier(patient.data.personalIdentifiers)
      : undefined,
    name: [
      {
        family: patient.data.lastName,
        given: splitName(patient.data.firstName),
      },
    ],
    telecom: patient.data.contact
      ? patient.data.contact.flatMap(contact => {
          return contact
            ? Object.entries(contact).map(([key, val]) => {
                return {
                  system: key as ContactTypes,
                  value: val ?? undefined,
                };
              })[0] ?? []
            : [];
        })
      : [],
    gender: genderMapping[patient.data.genderAtBirth],
    birthDate: patient.data.dob,
    address: patient.data.address.map(address => {
      const line: string[] = [];
      if (address.addressLine1) line.push(address.addressLine1);
      if (address.addressLine2) line.push(address.addressLine2);
      return {
        line: line,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        postalCode: address.zip,
        country: address.country ?? undefined,
      };
    }),
  };
};

const convertDriversLicenseToIdentifier = (
  personalIdentifiers: PersonalIdentifier[]
): Identifier[] => {
  return personalIdentifiers.map(identifier => {
    return {
      system: driversLicenseURIs[identifier.state],
      value: identifier.value,
    };
  });
};

export function toFHIRSubject(patientId: string): Reference<FHIRPatient> {
  const subject: Reference<FHIRPatient> = {
    reference: `Patient/${patientId}`,
    type: "Patient",
  };
  return subject;
}

export function getPatientId(doc: DocumentReference): string | undefined {
  return getIdFromSubjectId(doc.subject) ?? getIdFromSubjectRef(doc.subject);
}
