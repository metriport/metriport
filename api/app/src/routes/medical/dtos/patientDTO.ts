import { getLinkStatusAcrossHIEs } from "../../../external/patient-external";
import { LinkStatusAcrossHIEs } from "../../../external/patient-link";
import { Patient } from "../../../models/medical/patient";
import { DemographicsDTO } from "./demographicsDTO";

export type PatientDTO = {
  id: string;
  facilityIds: string[];
  links: LinkStatusAcrossHIEs;
} & DemographicsDTO;

export function dtoFromModel(patient: Pick<Patient, "id" | "facilityIds" | "data">): PatientDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  const links = getLinkStatusAcrossHIEs(patient.data.externalData);
  return {
    id: patient.id,
    facilityIds: patient.facilityIds,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
    links,
  };
}
