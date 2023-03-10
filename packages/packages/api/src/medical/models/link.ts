import { Patient } from "./patient";

export enum ExternalMedicalPartners {
  COMMONWELL = "COMMONWELL",
}

export type PatientLinks = {
  potentialLinks: Link[];
  currentLinks: Link[];
};

export interface Link {
  id?: string | null;
  entityId: string;
  potential: boolean;
  source: ExternalMedicalPartners;
  patient: Patient;
}
