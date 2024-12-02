import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import { ClientKeyMapping, ClientKeyMappingPerSource } from "../../domain/client-key-mapping";
import { ClientKeyMappingModel } from "../../models/client-key-mapping";

export type ClientKeyMappingParams = ClientKeyMappingPerSource;

export type ClientKeyMappingLookUpParams = Omit<
  ClientKeyMappingParams,
  "clientKey" | "clientSecret" | "data"
>;
export type ClientKeyMappingLookupByIdParams = Pick<ClientKeyMappingParams, "cxId"> & {
  id: string;
};

export async function findOrCreateClientKeyMapping({
  cxId,
  clientKey,
  clientSecret,
  data,
  externalId,
  source,
}: ClientKeyMappingParams): Promise<ClientKeyMapping> {
  const existing = await getClientKeyMapping({ cxId, externalId, source });
  if (existing) return existing;
  const created = await ClientKeyMappingModel.create({
    id: uuidv7(),
    cxId,
    clientKey,
    clientSecret,
    data,
    externalId,
    source,
  });
  return created.dataValues;
}

export async function getClientKeyMapping({
  cxId,
  externalId,
  source,
}: ClientKeyMappingLookUpParams): Promise<ClientKeyMapping | undefined> {
  const existing = await ClientKeyMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getClientKeyMappingOrFail({
  cxId,
  externalId,
  source,
}: ClientKeyMappingLookUpParams): Promise<ClientKeyMapping> {
  const mapping = await getClientKeyMapping({
    cxId,
    externalId,
    source,
  });
  if (!mapping) {
    throw new NotFoundError("ClientKeyMapping not found", undefined, { cxId, externalId, source });
  }
  return mapping;
}

export async function getClientKeyMappingsBySource({
  source,
}: {
  source: string;
}): Promise<ClientKeyMapping[]> {
  const mappings = await ClientKeyMappingModel.findAll({
    where: { source },
  });
  return mappings.map(m => m.dataValues);
}

export async function getClientKeyMappingsByCustomer({
  cxId,
  source,
}: {
  cxId: string;
  source?: string;
}): Promise<ClientKeyMapping[]> {
  const mappings = await ClientKeyMappingModel.findAll({
    where: { cxId, ...(source && { source }) },
  });
  return mappings.map(m => m.dataValues);
}

async function getClientKeyMappingModelById({
  cxId,
  id,
}: ClientKeyMappingLookupByIdParams): Promise<ClientKeyMappingModel | undefined> {
  const existing = await ClientKeyMappingModel.findOne({
    where: { cxId, id },
  });
  if (!existing) return undefined;
  return existing;
}

async function getClientKeyMappingModelByIdOrFail({
  cxId,
  id,
}: ClientKeyMappingLookupByIdParams): Promise<ClientKeyMappingModel> {
  const mapping = await getClientKeyMappingModelById({
    cxId,
    id,
  });
  if (!mapping) {
    throw new NotFoundError("ClientKeyMapping not found", undefined, { cxId, id });
  }
  return mapping;
}

export async function setExternalIdOnClientKeyMapping({
  cxId,
  id,
  externalId,
}: ClientKeyMappingLookupByIdParams & { externalId: string }): Promise<ClientKeyMapping> {
  const existing = await getClientKeyMappingModelByIdOrFail({ cxId, id });
  const updated = await existing.update({ externalId });
  return updated.dataValues;
}

export async function deleteClientKeyMapping({
  cxId,
  id,
}: ClientKeyMappingLookupByIdParams): Promise<void> {
  const existing = await getClientKeyMappingModelByIdOrFail({ cxId, id });
  await existing.destroy();
}
