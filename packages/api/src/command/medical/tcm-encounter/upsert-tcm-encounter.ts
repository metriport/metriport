import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { TcmEncounterUpsert } from "../../../routes/medical/schemas/tcm-encounter";

export async function upsertTcmEncounter(params: TcmEncounterUpsert): Promise<TcmEncounterModel> {
  const [encounter, wasCreated] = await TcmEncounterModel.findOrCreate({
    where: {
      id: params.id,
      cxId: params.cxId,
    },
    defaults: params,
  });

  if (!wasCreated) {
    await encounter.update(params);
  }

  return encounter;
}
