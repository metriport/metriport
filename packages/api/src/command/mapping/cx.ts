import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { CxMappingModel } from "../../models/cx-mapping";

export type CxMappingParams = {
  cxId: string;
  externalId: string;
  source: string;
};

export type CxMappingLookUpParam = Omit<CxMappingParams, "cxId">;

export async function createCxMapping({
  cxId,
  externalId,
  source,
}: CxMappingParams): Promise<void> {
  const existing = await CxMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (existing) return;
  await CxMappingModel.create({ id: uuidv7(), cxId, externalId, source });
  return;
}

export async function getCxMappingId({
  externalId,
  source,
}: CxMappingLookUpParam): Promise<string | undefined> {
  const existing = await CxMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) return undefined;
  return existing.cxId;
}

export async function deleteCxMapping({
  cxId,
  externalId,
  source,
}: CxMappingParams): Promise<void> {
  const existing = await CxMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) throw new NotFoundError("Entry not found", undefined, { cxId });
  await existing.destroy();
}
