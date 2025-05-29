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

type OauthSecretsMethod<T extends EhrEnv> = (
  params: EhrPerPracticeParams
) => EhrEnvAndClientCredentials<T>;
type ApiKeySecretsMethod<T extends EhrEnv> = (params: EhrPerPracticeParams) => EhrEnvAndApiKey<T>;

type GetSecrets<T extends EhrEnv> = OauthSecretsMethod<T> | ApiKeySecretsMethod<T>;

export type SecretsMethodMap = Record<EhrSource, GetSecrets<EhrEnv> | undefined>;

const secretsMethodsBy: SecretsMethodMap = {
  [EhrSources.canvas]: getCanvasEnv,
  [EhrSources.athena]: getAthenaEnv,
  [EhrSources.elation]: getElationEnv,
  [EhrSources.healthie]: getHealthieEnv,
  [EhrSources.eclinicalworks]: undefined,
};

export function getSecretsHandler(ehr: EhrSources): GetSecrets<EhrEnv> {
  const handler = secretsMethodsBy[ehr];
  if (!handler) {
    throw new BadRequestError("No secrets handler found", undefined, { ehr });
  }
  return handler;
}
