import {
  Patient as FHIRPatient,
  ContactPoint,
  Reference,
  DocumentReference,
} from "@medplum/fhirtypes";
import { driversLicenseURIs, identifierSytemByType } from "../../../domain/oid";
import { ContactTypes, Contact } from "../../../domain/contact";
import { Address } from "../../../domain/address";
import { Patient, splitName, genderAtBirthMapping } from "../../../domain/patient";
import { getIdFromSubjectId, getIdFromSubjectRef } from "../shared";

export type PatientIdAndData = Pick<Patient, "id" | "data">;
export type FhirPersonalId = { value: string; system: string };

export function toFHIR(patient: PatientIdAndData): FHIRPatient {
  return {
    resourceType: "Patient",
    id: patient.id,
    identifier: getFhirPersonalIdsFromPatient(patient),
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
    gender: genderAtBirthMapping[patient.data.genderAtBirth],
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
}

export function getFhirPersonalIdsFromPatient(patient: PatientIdAndData): FhirPersonalId[] {
  return (patient.data.personalIdentifiers ?? []).map(id => {
    if (id.type === "driversLicense")
      return { value: id.value, system: driversLicenseURIs[id.state] };
    return { value: id.value, system: identifierSytemByType[id.type] };
  });
}

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
