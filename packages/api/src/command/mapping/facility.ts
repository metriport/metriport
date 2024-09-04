import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { FacilityMappingModel } from "../../models/facility-mapping";
import { FacilityMapping } from "../../domain/facility-mapping";

export type FacilityMappingParams = {
  cxId: string;
  facilityId: string;
  externalId: string;
  source: string;
};

export type FacilityMappingLookUpParam = Omit<FacilityMappingParams, "facilityId">;

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
}: FacilityMappingLookUpParam): Promise<FacilityMapping | undefined> {
  const existing = await FacilityMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function deleteFacilityMapping({
  cxId,
  externalId,
  source,
}: FacilityMappingLookUpParam): Promise<void> {
  const existing = await FacilityMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) {
    throw new NotFoundError("Entry not found", undefined, { cxId, externalId, source });
  }
  await existing.destroy();
}
