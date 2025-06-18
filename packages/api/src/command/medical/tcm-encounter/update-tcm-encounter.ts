import { TcmEncounter } from "../../../domain/medical/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";

type TcmEncounterUpdateData = Partial<Omit<TcmEncounter, "id">>;

export type UpdateTcmEncounterCmd = BaseUpdateCmdWithCustomer & {
  data: TcmEncounterUpdateData;
};

export type UpdateTcmEncounterResult = {
  encounter: TcmEncounterModel | null;
  status: number;
  message?: string;
};

export async function updateTcmEncounter({
  id,
  cxId,
  data,
}: UpdateTcmEncounterCmd): Promise<UpdateTcmEncounterResult> {
  const encounter = await TcmEncounterModel.findByPk(id);
  if (!encounter) {
    return {
      encounter: null,
      status: 404,
      message: `TCM encounter with ID ${id} not found`,
    };
  }

  await TcmEncounterModel.update(data, {
    where: {
      id,
      cxId,
    },
  });

  const updatedEncounter = await TcmEncounterModel.findByPk(id);
  if (!updatedEncounter) {
    throw new Error("Failed to fetch updated encounter");
  }

  return {
    encounter: updatedEncounter,
    status: 200,
  };
}
