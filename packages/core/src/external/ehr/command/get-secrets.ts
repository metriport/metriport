import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getAthenaEnv } from "../athenahealth/environment";
import { getCanvasEnv } from "../canvas/environment";
import { getElationEnv } from "../elation/environment";
import {
  EhrEnv,
  EhrEnvAndApiKey,
  EhrEnvAndClientCredentials,
  EhrPerPracticeParams,
} from "../environment";
import { getHealthieEnv } from "../healthie/environment";

/**
 * Get the secrets for the EHR
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice id of the EHR integration.
 */
export function getSecrets({
  ehr,
  cxId,
  practiceId,
}: EhrPerPracticeParams & { ehr: EhrSourcesWithDynamicSecrets }):
  | EhrEnvAndClientCredentials<EhrEnv>
  | EhrEnvAndApiKey<EhrEnv> {
  const handler = getSecretsHandler(ehr);
  return handler({ cxId, practiceId });
}

type OauthSecretsMethod<T extends EhrEnv> = (
  params: EhrPerPracticeParams
) => EhrEnvAndClientCredentials<T>;
type ApiKeySecretsMethod<T extends EhrEnv> = (params: EhrPerPracticeParams) => EhrEnvAndApiKey<T>;

type GetSecrets<T extends EhrEnv> = OauthSecretsMethod<T> | ApiKeySecretsMethod<T>;

type EhrSourcesWithDynamicSecrets = Exclude<EhrSource, EhrSources.eclinicalworks>;

export function isEhrSourceWithDynamicSecrets(ehr: EhrSource): ehr is EhrSourcesWithDynamicSecrets {
  return (
    ehr === EhrSources.canvas ||
    ehr === EhrSources.athena ||
    ehr === EhrSources.elation ||
    ehr === EhrSources.healthie
  );
}

type SecretsMethodMap = Record<EhrSourcesWithDynamicSecrets, GetSecrets<EhrEnv> | undefined>;

const secretsMethodsBy: SecretsMethodMap = {
  [EhrSources.canvas]: getCanvasEnv,
  [EhrSources.athena]: getAthenaEnv,
  [EhrSources.elation]: getElationEnv,
  [EhrSources.healthie]: getHealthieEnv,
};

function getSecretsHandler(ehr: EhrSourcesWithDynamicSecrets): GetSecrets<EhrEnv> {
  const handler = secretsMethodsBy[ehr];
  if (!handler) {
    throw new BadRequestError("No secrets handler found", undefined, { ehr });
  }
  return handler;
}
