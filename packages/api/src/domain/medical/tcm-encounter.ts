export type TcmEncounterLatestEvent = "Admitted" | "Transferred" | "Discharged";

export interface TcmEncounter {
  id: string;
  cxId: string;
  patientId: string;
  facilityName: string;
  latestEvent: TcmEncounterLatestEvent;
  class: string;
  admitTime: Date | null;
  dischargeTime: Date | null;
  clinicalInformation: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
