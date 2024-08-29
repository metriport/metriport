import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { CxMappingModel } from "../../models/cx-mapping";

export type CxMappingParams = {
  cxId: string;
  externalId: string;
  source: string;
};

export type CxMappingLookUpParam = Omit<CxMappingParams, "cxId">;

export async function findOrCreateCxMapping({
  cxId,
  externalId,
  source,
}: CxMappingParams): Promise<CxMappingModel> {
  const existing = await getCxMapping({ externalId, source });
  if (existing) return existing;
  return await CxMappingModel.create({ id: uuidv7(), cxId, externalId, source });
}

export async function getCxMapping({
  externalId,
  source,
}: CxMappingLookUpParam): Promise<CxMappingModel | undefined> {
  const existing = await CxMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) return undefined;
  return existing;
}

export async function deleteCxMapping({ externalId, source }: CxMappingLookUpParam): Promise<void> {
  const existing = await getCxMapping({ externalId, source });
  if (!existing) {
    throw new NotFoundError("Entry not found", undefined, { externalId, source });
  }
  await existing.destroy();
}
