import { Patient } from "@metriport/shared/domain/patient";
import { FacilityData } from "@metriport/shared/domain/customer";

export type SurescriptsDirectory = "from_surescripts" | "to_surescripts" | "history";

export interface SurescriptsRequestData {
  cxId: string;
  facility: FacilityData;
  patients: Patient[];
}

export interface SurescriptsSynchronizeEvent {
  dryRun?: boolean;
  requestFileName?: string;
  fromSurescripts?: boolean;
  toSurescripts?: boolean;
  listSurescripts?: boolean;
  debug?: typeof console.debug;
}

export interface SurescriptsPatientLoadEvent {
  cxId: string;
  facilityId: string;
}

// Non-binary N is mapped to by O
export type SurescriptsGender = "M" | "F" | "N" | "U";

export interface NameDemographics {
  firstName: string;
  middleName: string;
  lastName: string;
  prefix: string;
  suffix: string;
}
