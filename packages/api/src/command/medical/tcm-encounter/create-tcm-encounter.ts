import { v4 as uuidv4 } from "uuid";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { TcmEncounterCreate } from "../../../routes/medical/schemas/tcm-encounter";

export async function createTcmEncounter(data: TcmEncounterCreate): Promise<TcmEncounterModel> {
  const encounter = await TcmEncounterModel.create({
    ...data,
    id: data.id || uuidv4(),
  });
  return encounter;
}
