import { TcmEncounterModel } from "@metriport/shared/domain/tcm-encounter";
import { TcmEncounterUpsert } from "@metriport/shared/domain/tcm-encounter";

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
