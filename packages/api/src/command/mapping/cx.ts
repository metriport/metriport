import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import { CxMapping, CxMappingPerSource, CxMappingSource } from "../../domain/cx-mapping";
import { CxMappingModel } from "../../models/cx-mapping";

export type CxMappingParams = CxMappingPerSource;

export type CxMappingLookUpParams = Omit<CxMappingParams, "cxId" | "secondaryMappings">;
export type CxMappingLookupByIdParams = Pick<CxMappingParams, "cxId"> & { id: string };

export async function findOrCreateCxMapping({
  cxId,
  externalId,
  secondaryMappings,
  source,
}: CxMappingParams): Promise<CxMapping> {
  const existing = await getCxMapping({ externalId, source });
  if (existing) return existing;
  const created = await CxMappingModel.create({
    id: uuidv7(),
    cxId,
    externalId,
    source,
    secondaryMappings,
  });
  return created.dataValues;
}

export async function getCxMapping({
  externalId,
  source,
}: CxMappingLookUpParams): Promise<CxMapping | undefined> {
  const existing = await CxMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getCxMappingOrFail({
  externalId,
  source,
}: CxMappingLookUpParams): Promise<CxMapping> {
  const mapping = await getCxMapping({
    externalId,
    source,
  });
  if (!mapping) {
    throw new NotFoundError("CxMapping not found", undefined, { externalId, source });
  }
  return mapping;
}

export async function getCxMappingsBySource({
  source,
}: {
  source: CxMappingSource;
}): Promise<CxMapping[]> {
  const mappings = await CxMappingModel.findAll({ where: { source } });
  return mappings.map(m => m.dataValues);
}

export async function getCxMappingsByCustomer({
  cxId,
  source,
}: {
  cxId: string;
  source?: CxMappingSource;
}): Promise<CxMapping[]> {
  const mappings = await CxMappingModel.findAll({
    where: { cxId, ...(source && { source }) },
  });
  return mappings.map(m => m.dataValues);
}

async function getCxMappingModelById({
  cxId,
  id,
}: CxMappingLookupByIdParams): Promise<CxMappingModel | undefined> {
  const existing = await CxMappingModel.findOne({
    where: { cxId, id },
  });
  if (!existing) return undefined;
  return existing;
}

async function getCxMappingModelByIdOrFail({
  cxId,
  id,
}: CxMappingLookupByIdParams): Promise<CxMappingModel> {
  const mapping = await getCxMappingModelById({
    cxId,
    id,
  });
  if (!mapping) {
    throw new NotFoundError("CxMapping not found", undefined, { cxId, id });
  }
  return mapping;
}

export async function setExternalIdOnCxMapping({
  cxId,
  id,
  externalId,
}: CxMappingLookupByIdParams & { externalId: string }): Promise<CxMapping> {
  const existing = await getCxMappingModelByIdOrFail({ cxId, id });
  const updated = await existing.update({ externalId });
  return updated.dataValues;
}

export async function deleteCxMapping({ cxId, id }: CxMappingLookupByIdParams): Promise<void> {
  const existing = await getCxMappingModelByIdOrFail({ cxId, id });
  await existing.destroy();
}
