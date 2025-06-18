import { NotFoundError } from "@metriport/shared";
import { TcmEncounter } from "../../../domain/medical/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";

type TcmEncounterUpdatePayload = Partial<Omit<TcmEncounter, "id" | "cxId" | "patientId">>;

export type UpdateTcmEncounter = BaseUpdateCmdWithCustomer & TcmEncounterUpdatePayload;

export type UpdateTcmEncounterResult = {
  encounter: TcmEncounterModel;
};

export async function updateTcmEncounter(
  params: UpdateTcmEncounter
): Promise<UpdateTcmEncounterResult> {
  const { id, cxId, ...data } = params;
  const encounter = await TcmEncounterModel.findByPk(params.id);
  if (!encounter) {
    throw new NotFoundError(`TCM encounter not found`, undefined, { id });
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
  };
}
