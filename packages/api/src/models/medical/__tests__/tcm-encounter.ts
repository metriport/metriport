import { makeTcmEncounter } from "../../../domain/medical/__tests__/tcm-encounter";
import { TcmEncounterModel } from "../tcm-encounter";

export function makeTcmEncounterModel(params: Partial<TcmEncounterModel> = {}): TcmEncounterModel {
  const encounter = makeTcmEncounter(params) as unknown as TcmEncounterModel;
  encounter.dataValues = encounter;
  encounter.save = jest.fn();
  encounter.update = jest.fn();
  encounter.destroy = jest.fn();
  return encounter;
}
