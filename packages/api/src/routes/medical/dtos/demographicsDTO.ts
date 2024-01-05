import { Patient } from "@metriport/core/domain/medical/patient";
import { AddressDTO } from "./addressDTO";
import { ContactDTO } from "./contact-dto";
import { PersonalIdentifierDTO } from "./personal-identifier-dto";

export type GenderDTO = "F" | "M" | "U"; // U = unspecified

export type DemographicsDTO = {
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderDTO;
  personalIdentifiers?: PersonalIdentifierDTO[] | null;
  address: AddressDTO[];
  contact?: ContactDTO[] | null;
};

export function dtoFromModel(patient: Pick<Patient, "data">): DemographicsDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
  };
}
