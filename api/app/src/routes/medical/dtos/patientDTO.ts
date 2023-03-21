import { getLinkStatusAcrossHIEs } from "../../../external/patient-external";
import { LinkStatusAcrossHIEs } from "../../../external/patient-link";
import { Patient } from "../../../models/medical/patient";
import { toBaseDTO } from "./baseDTO";
import { DemographicsDTO } from "./demographicsDTO";

export type PatientDTO = {
  facilityIds: string[];
  links: LinkStatusAcrossHIEs;
} & DemographicsDTO;

export function dtoFromModel(patient: Patient): PatientDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  const links = getLinkStatusAcrossHIEs(patient.data.externalData);
  return {
    ...toBaseDTO(patient),
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
