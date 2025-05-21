import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getAthenaEnv } from "../../athenahealth/shared";
import { getCanvasEnv } from "../../canvas/shared";
import { getElationEnv } from "../../elation/shared";
import { getHealthieEnv } from "../../healthie/shared";
import {
  EhrEnv,
  EhrEnvAndApiKey,
  EhrEnvAndClientCredentials,
  EhrPerPracticeParams,
} from "./client";

type OauthSecretsFunction<T extends EhrEnv> = (
  params: EhrPerPracticeParams
) => EhrEnvAndClientCredentials<T>;
type ApiKeySecretsFunction<T extends EhrEnv> = (params: EhrPerPracticeParams) => EhrEnvAndApiKey<T>;

export type SecretsFunction<T extends EhrEnv> = OauthSecretsFunction<T> | ApiKeySecretsFunction<T>;

const secretsFunctionsBy: Record<EhrSource, SecretsFunction<EhrEnv>> = {
  [EhrSources.canvas]: getCanvasEnv,
  [EhrSources.athena]: getAthenaEnv,
  [EhrSources.elation]: getElationEnv,
  [EhrSources.healthie]: getHealthieEnv,
};

export function getSecretsFunction(ehr: EhrSources): SecretsFunction<EhrEnv> {
  const secretsFunction = secretsFunctionsBy[ehr];
  if (!secretsFunction) {
    throw new BadRequestError("No secrets function found @ Ehr", undefined, { ehr });
  }
  return secretsFunction;
}
