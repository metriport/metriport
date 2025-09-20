import { NotFoundError } from "@metriport/shared";
import { Suspect } from "../../../domain/suspect";
import { SuspectModel } from "../../../models/suspect";

export type GetSuspectParams = {
  cxId: string;
  patientId: string;
  group: string;
};

export async function getSuspect({
  cxId,
  patientId,
  group,
}: GetSuspectParams): Promise<Suspect | undefined> {
  const existing = await SuspectModel.findOne({ where: { cxId, patientId, group } });
  if (existing) return existing.dataValues;
  return undefined;
}

export async function getSuspectOrFail({
  cxId,
  patientId,
  group,
}: GetSuspectParams): Promise<Suspect> {
  const suspect = await getSuspect({ cxId, patientId, group });
  if (!suspect) {
    throw new NotFoundError("Suspect not found", undefined, { cxId, patientId, group });
  }
  return suspect;
}

export async function getLatestSuspectsBySuspectGroup({
  cxId,
  patientId,
}: Omit<GetSuspectParams, "group">): Promise<Suspect[]> {
  const suspects = await SuspectModel.findAll({
    where: { cxId, patientId },
    order: [
      ["group", "ASC"],
      ["lastRun", "DESC"],
    ],
  });

  if (!suspects.length) return [];

  // TODO: ENG-1093
  const latestByGroup = suspects.reduce((acc, suspect) => {
    const group = suspect.group;
    if (!acc[group]) {
      acc[group] = suspect.dataValues;
    }
    return acc;
  }, {} as Record<string, Suspect>);

  return Object.values(latestByGroup);
}
