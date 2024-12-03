import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import {
  SecretsMapping,
  SecretsMappingPerSource,
  SecretsMappingSource,
} from "../../domain/secrets-mapping";
import { EhrSources } from "../../external/ehr/shared";
import { SecretsMappingModel } from "../../models/secrets-mapping";
import { Config } from "../../shared/config";

export type SecretsMappingParams = SecretsMappingPerSource;

export type SecretsMappingLookUpParams = Omit<SecretsMappingParams, "secretArn">;
export type SecretsMappingLookupByIdParams = Pick<SecretsMappingParams, "cxId"> & { id: string };

export async function findOrCreateSecretsMapping({
  cxId,
  secretArn,
  externalId,
  source,
}: SecretsMappingParams): Promise<SecretsMapping> {
  const existing = await getSecretsMapping({ cxId, externalId, source });
  if (existing) return existing;
  const created = await SecretsMappingModel.create({
    id: uuidv7(),
    cxId,
    secretArn,
    externalId,
    source,
  });
  return created.dataValues;
}

export async function getSecretsMapping({
  cxId,
  externalId,
  source,
}: SecretsMappingLookUpParams): Promise<SecretsMapping | undefined> {
  const existing = await SecretsMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getSecretsMappingOrFail({
  cxId,
  externalId,
  source,
}: SecretsMappingLookUpParams): Promise<SecretsMapping> {
  const mapping = await getSecretsMapping({
    cxId,
    externalId,
    source,
  });
  if (!mapping) {
    throw new NotFoundError("SecretsMapping not found", undefined, { cxId, externalId, source });
  }
  return mapping;
}

export async function getSecretsMappingsByCustomer({
  cxId,
  source,
}: {
  cxId: string;
  source?: SecretsMappingSource;
}): Promise<SecretsMapping[]> {
  const mappings = await SecretsMappingModel.findAll({
    where: { cxId, ...(source && { source }) },
  });
  return mappings.map(m => m.dataValues);
}

async function getSecretsMappingModelById({
  cxId,
  id,
}: SecretsMappingLookupByIdParams): Promise<SecretsMappingModel | undefined> {
  const existing = await SecretsMappingModel.findOne({
    where: { cxId, id },
  });
  if (!existing) return undefined;
  return existing;
}

async function getSecretsMappingModelByIdOrFail({
  cxId,
  id,
}: SecretsMappingLookupByIdParams): Promise<SecretsMappingModel> {
  const mapping = await getSecretsMappingModelById({
    cxId,
    id,
  });
  if (!mapping) {
    throw new NotFoundError("SecretsMapping not found", undefined, { cxId, id });
  }
  return mapping;
}

export async function setExternalIdOnSecretsMapping({
  cxId,
  id,
  externalId,
}: SecretsMappingLookupByIdParams & { externalId: string }): Promise<SecretsMapping> {
  const existing = await getSecretsMappingModelByIdOrFail({ cxId, id });
  const updated = await existing.update({ externalId });
  return updated.dataValues;
}

export async function deleteSecretsMapping({
  cxId,
  id,
}: SecretsMappingLookupByIdParams): Promise<void> {
  const existing = await getSecretsMappingModelByIdOrFail({ cxId, id });
  await existing.destroy();
}

export function getDefaultSecretArnForSource({
  source,
}: {
  source: SecretsMappingSource;
}): string | undefined {
  if (source === EhrSources.elation) return Config.getElationClientKeyAndSecretMapArn();
  return undefined;
}
