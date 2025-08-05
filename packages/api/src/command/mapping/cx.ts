import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError, NotFoundError } from "@metriport/shared";
import {
  removeClientSource,
  removeWebhookSource,
} from "@metriport/shared/interface/external/ehr/source";
import {
  CxMapping,
  CxMappingPerSource,
  CxMappingSecondaryMappings,
  CxMappingSource,
  isCxMappingSource,
  secondaryMappingsSchemaMap,
} from "../../domain/cx-mapping";
import {
  isEhrClientJwtTokenSource,
  isEhrDashJwtTokenSource,
  isEhrWebhookJwtTokenSource,
} from "../../external/ehr/shared/utils/jwt-token";
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
  const existing = await getCxMappingModel({ externalId, source });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getCxMappingOrFail({
  externalId,
  source,
}: CxMappingLookUpParams): Promise<CxMapping> {
  const mapping = await getCxMappingModelOrFail({
    externalId,
    source,
  });
  return mapping.dataValues;
}

export async function getCxMappingModel({
  externalId,
  source,
}: CxMappingLookUpParams): Promise<CxMappingModel | undefined> {
  const existing = await CxMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) return undefined;
  return existing;
}

export async function getCxMappingModelOrFail({
  externalId,
  source,
}: CxMappingLookUpParams): Promise<CxMappingModel> {
  const mapping = await getCxMappingModel({
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

export async function getSecondaryMappingsOrFail({
  source,
  externalId,
}: CxMappingLookUpParams): Promise<CxMappingSecondaryMappings> {
  const mapping = await getCxMappingOrFail({ source, externalId });
  return mapping.secondaryMappings;
}

export async function setExternalIdOnCxMappingById({
  cxId,
  id,
  externalId,
}: CxMappingLookupByIdParams & { externalId: string }): Promise<CxMapping> {
  const existing = await getCxMappingModelByIdOrFail({ cxId, id });
  const updated = await existing.update({ externalId });
  return updated.dataValues;
}

export async function setSecondaryMappingsOnCxMappingById({
  cxId,
  id,
  secondaryMappings,
}: CxMappingLookupByIdParams & {
  secondaryMappings: CxMappingSecondaryMappings;
}): Promise<CxMapping> {
  const existing = await getCxMappingModelByIdOrFail({ cxId, id });
  const schema = secondaryMappingsSchemaMap[existing.source];
  if (!schema) {
    throw new MetriportError("Schema to validate new secondary mappings not found", undefined, {
      source: existing.source,
    });
  }
  const validatedSecondaryMappings = schema.parse(secondaryMappings);
  const updated = await existing.update({ secondaryMappings: validatedSecondaryMappings });
  return updated.dataValues;
}

export async function deleteCxMapping({ cxId, id }: CxMappingLookupByIdParams): Promise<void> {
  const existing = await getCxMappingModelByIdOrFail({ cxId, id });
  await existing.destroy();
}

export function getCxMappingSourceFromJwtTokenSource(source: string): CxMappingSource {
  const additionalDetails = { source };
  if (isEhrDashJwtTokenSource(source)) {
    if (isCxMappingSource(source)) return source;
    throw new MetriportError("Invalid dash source", undefined, additionalDetails);
  }
  if (isEhrClientJwtTokenSource(source)) {
    const sourceWithoutClient = removeClientSource(source);
    if (isCxMappingSource(sourceWithoutClient)) return sourceWithoutClient;
    throw new MetriportError("Invalid client source", undefined, additionalDetails);
  }
  if (isEhrWebhookJwtTokenSource(source)) {
    const sourceWithoutWebhook = removeWebhookSource(source);
    if (isCxMappingSource(sourceWithoutWebhook)) return sourceWithoutWebhook;
    throw new MetriportError("Invalid webhook source", undefined, additionalDetails);
  }
  throw new MetriportError("Invalid source", undefined, additionalDetails);
}
