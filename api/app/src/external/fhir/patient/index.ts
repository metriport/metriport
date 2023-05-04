import { Patient as FHIRPatient, Identifier } from "@medplum/fhirtypes";
import { Patient } from "../../../models/medical/patient";
import { GenderAtBirth } from "../../../models/medical/patient";
import { PersonalIdentifier } from "../../../models/medical/patient";
import { driversLicenseURIs } from "../../../shared/oid";
import { ResourceType } from "../shared";
import { ContactTypes } from "../../../models/medical/contact";

export const genderMapping: { [k in GenderAtBirth]: "female" | "male" } = {
  F: "female",
  M: "male",
};

export const toFHIR = (patient: Patient): FHIRPatient => {
  return {
    resourceType: ResourceType.Patient,
    id: patient.id,
    identifier: convertDriversLicenseToIdentifier(patient.data.personalIdentifiers),
    name: [
      {
        family: patient.data.lastName[0],
        given: patient.data.firstName,
      },
    ],
    telecom: patient.data.contact
      ? patient.data.contact.map(contact => {
          return Object.entries(contact).map(([key, val]) => {
            return {
              system: key as ContactTypes,
              value: val ?? undefined,
            };
          })[0];
        })
      : undefined,
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
        postalCode: address.zip ?? undefined,
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
