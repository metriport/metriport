import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { CxMappingModel } from "../../models/cx-mapping";
import { CxMapping, CxSources } from "../../domain/cx-mapping";

export type CxMappingParams = {
  cxId: string;
  externalId: string;
  source: CxSources;
};

export type CxMappingLookUpParam = Omit<CxMappingParams, "cxId">;

export async function findOrCreateCxMapping({
  cxId,
  externalId,
  source,
}: CxMappingParams): Promise<CxMapping> {
  const existing = await getCxMapping({ externalId, source });
  if (existing) return existing;
  const created = await CxMappingModel.create({ id: uuidv7(), cxId, externalId, source });
  return created.dataValues;
}

export async function getCxMapping({
  externalId,
  source,
}: CxMappingLookUpParam): Promise<CxMapping | undefined> {
  const existing = await CxMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getCxMappings({ source }: { source: CxSources }): Promise<CxMapping[]> {
  const mappings = await CxMappingModel.findAll({
    where: { source },
  });
  return mappings.map(m => m.dataValues);
}

export async function getCxMappingOrFail({
  externalId,
  source,
}: CxMappingLookUpParam): Promise<CxMapping> {
  const mapping = await getCxMapping({
    externalId,
    source,
  });
  if (!mapping) {
    throw new NotFoundError("CxMapping not found", undefined, { externalId, source });
  }
  return mapping;
}

export async function getCxMappingsForCustomer(where: {
  cxId: string;
  source?: string;
}): Promise<CxMapping[]> {
  const rows = await CxMappingModel.findAll({ where });
  return rows.map(r => r.dataValues);
}

export async function deleteCxMapping({ externalId, source }: CxMappingLookUpParam): Promise<void> {
  const existing = await CxMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) {
    throw new NotFoundError("Entry not found", undefined, { externalId, source });
  }
  await existing.destroy();
}
