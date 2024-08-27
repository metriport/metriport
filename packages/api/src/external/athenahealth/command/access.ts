import NotFoundError from "../../../errors/not-found";
import { Ehr } from "../../../domain/ehr-access";
import { EhrAccessModel } from "../../../models/ehr-acess";

export type EhrAccessParams = {
  cxId: string;
  ehrId: string;
  ehrName: Ehr;
};

export async function allowEhrAccess({ cxId, ehrId, ehrName }: EhrAccessParams): Promise<void> {
  const existing = await EhrAccessModel.findOne({
    where: { cxId, ehrId, ehrName },
  });
  if (existing) return;
  await EhrAccessModel.create({ cxId, ehrId, ehrName });
  return;
}

export async function hasEhrAccess({
  ehrId,
  ehrName,
}: Omit<EhrAccessParams, "cxId">): Promise<string | undefined> {
  const existing = await EhrAccessModel.findOne({
    where: { ehrId, ehrName },
  });
  if (!existing) return undefined;
  return existing.cxId;
}

export async function revokeEhrAccess({ cxId, ehrId, ehrName }: EhrAccessParams): Promise<void> {
  const existing = await EhrAccessModel.findOne({
    where: { cxId, ehrId, ehrName },
  });
  if (!existing) throw new NotFoundError("Entry not found", undefined, { cxId });
  await existing.destroy();
}
