import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
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
import { EhrSourceWithDynamicSecrets } from "../secrets";

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
}: EhrPerPracticeParams & { ehr: EhrSourceWithDynamicSecrets }):
  | EhrEnvAndClientCredentials<EhrEnv>
  | EhrEnvAndApiKey<EhrEnv> {
  const handler = getSecretsHandler(ehr);
  return handler({ cxId, practiceId });
}

type OauthSecretsFn<T extends EhrEnv> = (
  params: EhrPerPracticeParams
) => EhrEnvAndClientCredentials<T>;
type ApiKeySecretsFn<T extends EhrEnv> = (params: EhrPerPracticeParams) => EhrEnvAndApiKey<T>;

type GetSecretsFn<T extends EhrEnv> = OauthSecretsFn<T> | ApiKeySecretsFn<T>;

type GetSecretsFnMap = Record<EhrSourceWithDynamicSecrets, GetSecretsFn<EhrEnv> | undefined>;

const secretsMethodsBy: GetSecretsFnMap = {
  [EhrSources.canvas]: getCanvasEnv,
  [EhrSources.athena]: getAthenaEnv,
  [EhrSources.elation]: getElationEnv,
  [EhrSources.healthie]: getHealthieEnv,
};

function getSecretsHandler(ehr: EhrSourceWithDynamicSecrets): GetSecretsFn<EhrEnv> {
  const handler = secretsMethodsBy[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to get secrets", undefined, { ehr });
  }
  return handler;
}
