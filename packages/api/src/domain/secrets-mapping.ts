import { BaseDomain } from "@metriport/core/domain/base-domain";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "../external/ehr/shared";

export type SecretsSources = EhrSources.elation;
export function isSecretsMappingSource(source: string): source is SecretsSources {
  return source === EhrSources.elation;
}
export function getSecretsMappingSource(source: string): SecretsSources {
  if (!isSecretsMappingSource(source)) throw new BadRequestError(`Source ${source} is not mapped.`);
  return source;
}

export type SecretsMappingPerSource = {
  externalId: string;
  cxId: string;
  secretArn: string;
  source: SecretsSources;
};

export interface SecretsMapping extends BaseDomain, SecretsMappingPerSource {}
