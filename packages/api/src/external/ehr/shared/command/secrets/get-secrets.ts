import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import {
  EhrEnv,
  EhrEnvAndApiKey,
  EhrEnvAndClientCredentials,
  EhrPerPracticeParams,
} from "../../utils/client";
import { getSecretsFunction } from "../../utils/secrets";

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
}: EhrPerPracticeParams & { ehr: EhrSource }):
  | EhrEnvAndClientCredentials<EhrEnv>
  | EhrEnvAndApiKey<EhrEnv> {
  const getSecrets = getSecretsFunction(ehr);
  return getSecrets({ cxId, practiceId });
}
