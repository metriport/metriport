import { Identifier, Patient as FHIRPatient, ContactPoint } from "@medplum/fhirtypes";
import { driversLicenseURIs } from "../../../domain/oid";
import { ContactTypes, Contact } from "../../../domain/patient/contact";
import { Address } from "../../../domain/patient/address";
import {
  GenderAtBirth,
  Patient,
  PersonalIdentifier,
  splitName,
} from "../../../domain/patient/patient";

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

export function isContactType(type: string): type is ContactTypes {
  return ["phone", "fax", "email", "pager", "url", "sms", "other"].includes(type);
}
