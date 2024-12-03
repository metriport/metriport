import { BaseDomain } from "@metriport/core/domain/base-domain";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "../external/ehr/shared";

export type SecretsMappingSource = EhrSources.elation;
export function isSecretsMappingSource(source: string): source is SecretsMappingSource {
  return source === EhrSources.elation;
}
export function getSecretsMappingSource(source: string): SecretsMappingSource {
  if (isSecretsMappingSource(source)) return source;
  throw new BadRequestError(`Source ${source} is valid secrets mapping source.`);
}

export type SecretsMappingPerSource = {
  externalId: string;
  cxId: string;
  secretArn: string;
  source: SecretsMappingSource;
};

export interface SecretsMapping extends BaseDomain, SecretsMappingPerSource {}
