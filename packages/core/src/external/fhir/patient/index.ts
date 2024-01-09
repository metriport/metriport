import {
  Identifier,
  Patient as FHIRPatient,
  ContactPoint,
  Reference,
  DocumentReference,
} from "@medplum/fhirtypes";
import { driversLicenseURIs } from "../../../domain/oid";
import { ContactTypes, Contact } from "../../../domain/contact";
import { Address } from "../../../domain/address";
import { GenderAtBirth, Patient, PersonalIdentifier, splitName } from "../../../domain/patient";
import { getIdFromSubjectId, getIdFromSubjectRef } from "../shared";

export const genderMapping: { [k in GenderAtBirth]: "female" | "male" } = {
  F: "female",
  M: "male",
};

export const toFHIR = (patient: Pick<Patient, "id" | "data">): FHIRPatient => {
  return {
    resourceType: "Patient",
    id: patient.id,
    identifier: patient.data.personalIdentifiers
      ? convertDriversLicenseToIdentifier(patient.data.personalIdentifiers)
      : [],
    name: [
      {
        family: patient.data.lastName,
        given: splitName(patient.data.firstName),
      },
    ],
    telecom:
      patient.data.contact
        ?.map((contact: Contact) => {
          const telecoms: ContactPoint[] = [];
          for (const type in contact) {
            if (isContactType(type) && contact[type]) {
              const contactValue = contact[type];
              if (contactValue) {
                const contactPoint: ContactPoint = {
                  system: type,
                  value: contactValue,
                };
                telecoms.push(contactPoint);
              }
            }
          }
          return telecoms; // Moved return statement outside of the for loop
        })
        .reduce((prev, curr) => prev.concat(curr), []) || [],
    gender: genderMapping[patient.data.genderAtBirth],
    birthDate: patient.data.dob,
    address:
      patient.data.address.map((addr: Address) => {
        return {
          line: addr.addressLine1 ? [addr.addressLine1] : [],
          city: addr.city,
          state: addr.state,
          postalCode: addr.zip,
          country: addr.country || "USA",
        };
      }) || [],
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

export function isContactType(type: string): type is ContactTypes {
  return ["phone", "fax", "email", "pager", "url", "sms", "other"].includes(type);
}
