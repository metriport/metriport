import { Patient } from "./patient";

export enum LinkSource {
  commonWell = "CommonWell",
  careQuality = "CareQuality",
  eHealthExchange = "eHealthExchange",
}
export type PatientLinks = {
  potentialLinks: Link[];
  currentLinks: Link[];
};

export interface Link {
  id?: string | null;
  entityId: string;
  potential: boolean;
  source: LinkSource;
  patient: Patient;
}
