import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { FacilityMappingModel } from "../../models/facility-mapping";
import { FacilityMapping, FacilityMappingPerSource } from "../../domain/facility-mapping";

export type FacilityMappingParams = FacilityMappingPerSource;

export type FacilityMappingLookUpParams = Omit<FacilityMappingParams, "facilityId">;

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

export async function getFacilityMappingsForCustomer(where: {
  cxId: string;
  source?: string;
}): Promise<FacilityMapping[]> {
  const rows = await FacilityMappingModel.findAll({ where });
  return rows.map(r => r.dataValues);
}

export async function deleteFacilityMapping({
  cxId,
  externalId,
  source,
}: FacilityMappingLookUpParams): Promise<void> {
  const existing = await FacilityMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) {
    throw new NotFoundError("Entry not found", undefined, { cxId, externalId, source });
  }
  await existing.destroy();
}
