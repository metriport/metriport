export type SurescriptsDirectory = "from_surescripts" | "to_surescripts" | "history";

export interface SurescriptsSynchronizeEvent {
  dryRun?: boolean;
  fromSurescripts?: boolean;
  toSurescripts?: boolean;
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
