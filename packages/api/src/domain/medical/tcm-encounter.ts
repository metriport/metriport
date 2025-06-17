import { BaseDomain } from "@metriport/core/domain/base-domain";

export type TcmEncounterLatestEvent = "Admitted" | "Transferred" | "Discharged";

export interface TcmEncounter extends BaseDomain {
  cxId: string;
  patientId: string;
  facilityName: string;
  latestEvent: TcmEncounterLatestEvent;
  class: string;
  admitTime: Date | null;
  dischargeTime: Date | null;
  clinicalInformation: Record<string, unknown>;
}
