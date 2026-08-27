import { errorToString, MetriportError } from "@metriport/shared";
import { EhrEnvAndClientCredentials, EhrPerPracticeParams } from "../environment";
import { PracticeFusionEnv, isPracticeFusionEnv } from ".";
import { Config } from "../../../util/config";

export type PracticeFusionEnvCredentials = EhrEnvAndClientCredentials<PracticeFusionEnv>;

export function getPracticeFusionEnv({
  cxId,
  practiceId,
}: EhrPerPracticeParams): PracticeFusionEnvCredentials {
  const clientKeySecretMap = Config.getPracticeFusionClientKeySecretMap();
  if (!clientKeySecretMap) throw new Error("PracticeFusion clientKeySecretMap not set");
  let clientKeySecretMapJson: Record<string, string>;
  try {
    clientKeySecretMapJson = JSON.parse(clientKeySecretMap);
  } catch (error) {
    throw new MetriportError("PracticeFusion clientKeySecretMap is invalid JSON", undefined, {
      error: errorToString(error),
    });
  }

  const environment = Config.getPracticeFusionEnv();
  if (!environment) throw new MetriportError("PracticeFusion environment not set");
  if (!isPracticeFusionEnv(environment)) {
    throw new MetriportError("Invalid PracticeFusion environment", undefined, { environment });
  }

  let env: PracticeFusionEnv = environment;
  const practiceEnvironment = clientKeySecretMapJson[`${cxId}_${practiceId}_env`];
  if (isPracticeFusionStagingEnv(env) && practiceEnvironment) {
    if (!isPracticeFusionEnv(practiceEnvironment)) {
      throw new MetriportError("Invalid practiceEnvironment", undefined, { practiceEnvironment });
    }
    env = practiceEnvironment;
  }

  const clientKey = clientKeySecretMapJson[`${env}_key`];
  const clientSecret = clientKeySecretMapJson[`${env}_secret`];

  if (!clientKey || !clientSecret) {
    throw new MetriportError("PracticeFusion secrets not set");
  }

  return {
    environment: env,
    clientKey,
    clientSecret,
  };
}

function isPracticeFusionStagingEnv(environment: PracticeFusionEnv) {
  return environment === "qa-api";
}
