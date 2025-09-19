import { NotFoundError } from "@metriport/shared";
import { Suspect } from "../../../domain/suspect";
import { SuspectModel } from "../../../models/suspect";

export type GetSuspectParams = {
  cxId: string;
  patientId: string;
  suspectGroup: string;
};

export async function getSuspect({
  cxId,
  patientId,
  suspectGroup,
}: GetSuspectParams): Promise<Suspect | undefined> {
  const existing = await SuspectModel.findOne({ where: { cxId, patientId, suspectGroup } });
  if (existing) return existing.dataValues;
  return undefined;
}

export async function getSuspectOrFail({
  cxId,
  patientId,
  suspectGroup,
}: GetSuspectParams): Promise<Suspect> {
  const suspect = await getSuspect({ cxId, patientId, suspectGroup });
  if (!suspect) {
    throw new NotFoundError("Suspect not found", undefined, { cxId, patientId, suspectGroup });
  }
  return suspect;
}

export async function getLatestSuspectsBySuspectGroup({
  cxId,
  patientId,
}: Omit<GetSuspectParams, "suspectGroup">): Promise<Suspect[]> {
  const suspects = await SuspectModel.findAll({
    where: { cxId, patientId },
    order: [
      ["suspectGroup", "ASC"],
      ["lastRun", "DESC"],
    ],
  });

  if (!suspects.length) return [];

  const latestByGroup = suspects.reduce((acc, suspect) => {
    const group = suspect.suspectGroup;
    if (!acc[group]) {
      acc[group] = suspect.dataValues;
    }
    return acc;
  }, {} as Record<string, Suspect>);

  return Object.values(latestByGroup);
}
