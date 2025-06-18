import { v4 as uuidv4 } from "uuid";
import { TcmEncounterLatestEvent } from "../../../domain/medical/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";

export type CreateTcmEncounter = {
  cxId: string;
  patientId: string;
  facilityName: string;
  latestEvent: TcmEncounterLatestEvent;
  class: string;
  admitTime?: Date | undefined;
  dischargeTime?: Date | null | undefined;
  clinicalInformation: Record<string, unknown>;
};

export async function createTcmEncounter(data: CreateTcmEncounter): Promise<TcmEncounterModel> {
  const now = new Date();
  const encounter = await TcmEncounterModel.create({
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    eTag: uuidv4(),
  });
  return encounter;
}
