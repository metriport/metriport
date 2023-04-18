import { Patient as FHIRPatient, Identifier } from "@medplum/fhirtypes";
import { Patient } from "../../../models/medical/patient";
import { GenderAtBirth } from "../../../models/medical/patient";
import { PersonalIdentifier } from "../../../models/medical/patient";
import { driversLicenseURIs } from "../../../shared/oid";
import { ResourceType } from "../shared";

export const genderMapping: { [k in GenderAtBirth]: "female" | "male" } = {
  F: "female",
  M: "male",
};

export const contactMapping: { [k: string]: "phone" | "email" } = {
  phone: "phone",
  email: "email",
};

export const toFHIR = (patient: Patient): FHIRPatient => {
  return {
    resourceType: ResourceType.Patient,
    id: patient.id,
    identifier: convertDriversLicenseToIdentifier(patient.data.personalIdentifiers),
    name: [
      {
        family: patient.data.lastName,
        given: [patient.data.firstName],
      },
    ],
    telecom: patient.data.contact
      ? Object.entries(patient.data.contact).map(([key, val]) => {
          return {
            system: contactMapping[key],
            value: val,
          };
        })
      : undefined,
    gender: genderMapping[patient.data.genderAtBirth],
    birthDate: patient.data.dob,
    address: [
      {
        line: [patient.data.address.addressLine1],
        city: patient.data.address.city,
        state: patient.data.address.state,
        postalCode: patient.data.address.zip,
        country: patient.data.address.country,
      },
    ],
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
