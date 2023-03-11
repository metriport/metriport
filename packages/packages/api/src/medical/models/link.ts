import { Patient } from "./patient";

export enum MedicalDataSource {
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
  source: MedicalDataSource;
  patient: Patient;
}
