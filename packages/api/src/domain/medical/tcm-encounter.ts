import { BaseDomain } from "@metriport/core/domain/base-domain";

export type TcmEncounterEventType = "Admitted" | "Transferred" | "Discharged";

export interface TcmEncounter extends BaseDomain {
  cxId: string;
  patientId: string;
  facilityName: string;
  latestEvent: TcmEncounterEventType;
  class: string;
  admitTime: Date | null;
  dischargeTime: Date | null;
  clinicalInformation: Record<string, unknown>;
  freetextNote: string | null;
}
