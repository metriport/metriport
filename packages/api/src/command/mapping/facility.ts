import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import {
  FacilityMapping,
  FacilityMappingPerSource,
  FacilityMappingSource,
} from "../../domain/facility-mapping";
import { FacilityMappingModel } from "../../models/facility-mapping";

export type FacilityMappingParams = FacilityMappingPerSource;

export type FacilityMappingLookUpParams = Omit<FacilityMappingParams, "facilityId">;
export type FacilityMappingLookupByIdParams = Pick<FacilityMappingParams, "cxId"> & { id: string };

export async function findOrCreateFacilityMapping({
  cxId,
  facilityId,
  externalId,
  source,
}: FacilityMappingParams): Promise<FacilityMapping> {
  const existing = await getFacilityMapping({ cxId, externalId, source });
  if (existing) return existing;
  const created = await FacilityMappingModel.create({
    id: uuidv7(),
    cxId,
    facilityId,
    externalId,
    source,
  });
  return created.dataValues;
}

export async function getFacilityMapping({
  cxId,
  externalId,
  source,
}: FacilityMappingLookUpParams): Promise<FacilityMapping | undefined> {
  const existing = await FacilityMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getFacilityMappingOrFail({
  cxId,
  externalId,
  source,
}: FacilityMappingLookUpParams): Promise<FacilityMapping> {
  const mapping = await getFacilityMapping({
    cxId,
    externalId,
    source,
  });
  if (!mapping) {
    throw new NotFoundError("FacilityMapping not found", undefined, { cxId, externalId, source });
  }
  return mapping;
}

export async function getFacilityMappingsByCustomer({
  cxId,
  source,
}: {
  cxId: string;
  source?: FacilityMappingSource;
}): Promise<FacilityMapping[]> {
  const mappings = await FacilityMappingModel.findAll({
    where: { cxId, ...(source && { source }) },
  });
  return mappings.map(m => m.dataValues);
}

async function getFacilityMappingModelById({
  cxId,
  id,
}: FacilityMappingLookupByIdParams): Promise<FacilityMappingModel | undefined> {
  const existing = await FacilityMappingModel.findOne({
    where: { cxId, id },
  });
  if (!existing) return undefined;
  return existing;
}

async function getFacilityMappingModelByIdOrFail({
  cxId,
  id,
}: FacilityMappingLookupByIdParams): Promise<FacilityMappingModel> {
  const mapping = await getFacilityMappingModelById({
    cxId,
    id,
  });
  if (!mapping) {
    throw new NotFoundError("FacilityMapping not found", undefined, { cxId, id });
  }
  return mapping;
}

export async function setExternalIdOnFacilityMapping({
  cxId,
  id,
  externalId,
}: FacilityMappingLookupByIdParams & { externalId: string }): Promise<FacilityMapping> {
  const existing = await getFacilityMappingModelByIdOrFail({ cxId, id });
  const updated = await existing.update({ externalId });
  return updated.dataValues;
}

export async function deleteFacilityMapping({
  cxId,
  id,
}: FacilityMappingLookupByIdParams): Promise<void> {
  const existing = await getFacilityMappingModelByIdOrFail({ cxId, id });
  await existing.destroy();
}
