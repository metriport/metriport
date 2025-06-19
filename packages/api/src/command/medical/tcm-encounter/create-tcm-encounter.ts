import { v4 as uuidv4 } from "uuid";
import { TcmEncounterEventType } from "../../../domain/medical/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";

export type CreateTcmEncounter = {
  id?: string;
  cxId: string;
  patientId: string;
  facilityName: string;
  latestEvent: TcmEncounterEventType;
  class: string;
  admitTime?: Date | undefined;
  dischargeTime?: Date | null | undefined;
  clinicalInformation: Record<string, unknown>;
};

export async function createTcmEncounter(data: CreateTcmEncounter): Promise<TcmEncounterModel> {
  const encounter = await TcmEncounterModel.create({
    ...data,
    id: data.id || uuidv4(),
  });
  return encounter;
}
