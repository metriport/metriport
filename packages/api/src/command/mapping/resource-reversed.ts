import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import {
  ResourceMappingReversed,
  ResourceMappingReversedPerSource,
} from "../../domain/resource-mapping-reversed";
import { ResourceMappingReversedModel } from "../../models/resource-mapping-reversed";

export type ResourceMappingReversedParams = ResourceMappingReversedPerSource;

export type ResourceMappingReversedLookUpParams = Omit<
  ResourceMappingReversedParams,
  "source" | "externalId" | "isMapped"
>;

export async function createOrUpdateResourceMappingReversed({
  cxId,
  patientId,
  patientMappingExternalId,
  resourceId,
  externalId,
  isMapped,
  source,
}: ResourceMappingReversedParams): Promise<ResourceMappingReversed> {
  const existing = await getResourceMappingModelReversed({
    cxId,
    patientId,
    patientMappingExternalId,
    resourceId,
  });
  if (existing) {
    if (externalId) existing.externalId = externalId;
    existing.isMapped = isMapped;
    existing.updatedAt = new Date();
    existing.changed("isMapped", true);
    const updated = await existing.save();
    return updated.dataValues;
  }
  const created = await ResourceMappingReversedModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    patientMappingExternalId,
    resourceId,
    externalId,
    isMapped,
    source,
  });
  return created.dataValues;
}

export async function getResourceMappingReversed({
  cxId,
  patientId,
  patientMappingExternalId,
  resourceId,
}: ResourceMappingReversedLookUpParams): Promise<ResourceMappingReversed | undefined> {
  const existing = await ResourceMappingReversedModel.findOne({
    where: { cxId, patientId, patientMappingExternalId, resourceId },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getResourceMappingReversedOrFail({
  cxId,
  patientId,
  patientMappingExternalId,
  resourceId,
}: ResourceMappingReversedLookUpParams): Promise<ResourceMappingReversed> {
  const mapping = await getResourceMappingReversed({
    cxId,
    patientId,
    patientMappingExternalId,
    resourceId,
  });
  if (!mapping) {
    throw new NotFoundError("ResourceMappingReversed not found", undefined, { cxId, resourceId });
  }
  return mapping;
}

export async function getResourceMappingModelReversed({
  cxId,
  patientId,
  patientMappingExternalId,
  resourceId,
}: ResourceMappingReversedLookUpParams): Promise<ResourceMappingReversedModel | undefined> {
  const existing = await ResourceMappingReversedModel.findOne({
    where: { cxId, patientId, patientMappingExternalId, resourceId },
  });
  if (!existing) return undefined;
  return existing;
}

export async function getResourceMappingModelReversedOrFail({
  cxId,
  patientId,
  patientMappingExternalId,
  resourceId,
}: ResourceMappingReversedLookUpParams): Promise<ResourceMappingReversedModel> {
  const mapping = await getResourceMappingModelReversed({
    cxId,
    patientId,
    patientMappingExternalId,
    resourceId,
  });
  if (!mapping) {
    throw new NotFoundError("ResourceMappingReversed not found", undefined, { cxId, resourceId });
  }
  return mapping;
}

export type ResourceMappingReversedMapped = {
  resourceId: string;
  externalId?: string;
  isMapped: boolean;
  updatedAt: Date;
};

export async function getMappedResourceIdsByPatientMappingExternalId({
  cxId,
  patientId,
  patientMappingExternalId,
}: {
  cxId: string;
  patientId: string;
  patientMappingExternalId: string;
}): Promise<ResourceMappingReversedMapped[]> {
  const mappings = await ResourceMappingReversedModel.findAll({
    where: { cxId, patientId, patientMappingExternalId },
  });
  return mappings.map(mapping => ({
    resourceId: mapping.dataValues.resourceId,
    externalId: mapping.dataValues.externalId,
    isMapped: mapping.dataValues.isMapped,
    updatedAt: mapping.dataValues.updatedAt,
  }));
}

export async function deleteAllResourceMappingReverseds({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<void> {
  await ResourceMappingReversedModel.destroy({
    where: { cxId, patientId },
  });
}
