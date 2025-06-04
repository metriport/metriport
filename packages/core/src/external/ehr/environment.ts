import { JwtTokenInfo } from "@metriport/shared/domain/jwt-token";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import AthenaHealthApi, { AthenaEnv } from "./athenahealth";
import CanvasApi, { CanvasEnv } from "./canvas";
import { EClinicalWorksEnv } from "./eclinicalworks";
import ElationApi, { ElationEnv } from "./elation";
import { HealthieEnv } from "./healthie";

export type EhrEnv = AthenaEnv | ElationEnv | CanvasEnv | HealthieEnv | EClinicalWorksEnv;

const EhrSourcesWithClientCredentials = [
  EhrSources.canvas,
  EhrSources.athena,
  EhrSources.elation,
] as const;
export type EhrSourceWithClientCredentials = (typeof EhrSourcesWithClientCredentials)[number];
export function isEhrSourceWithClientCredentials(
  ehr: string
): ehr is EhrSourceWithClientCredentials {
  return EhrSourcesWithClientCredentials.includes(ehr as EhrSourceWithClientCredentials);
}
export type EhrEnvAndClientCredentials<Env extends EhrEnv> = {
  environment: Env;
  clientKey: string;
  clientSecret: string;
};
export type EhrClientWithClientCredentials = AthenaHealthApi | ElationApi | CanvasApi;
export type EhrClientWithClientCredentialsParams<Env extends EhrEnv> = {
  twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  practiceId: string;
} & EhrEnvAndClientCredentials<Env>;

export type EhrEnvAndApiKey<Env extends EhrEnv> = {
  environment: Env;
  apiKey: string;
};

export type EhrPerPracticeParams = { cxId: string; practiceId: string };
