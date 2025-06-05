import { JwtTokenInfo } from "@metriport/shared/domain/jwt-token";
import AthenaHealthApi, { AthenaEnv } from "./athenahealth";
import CanvasApi, { CanvasEnv } from "./canvas";
import { EClinicalWorksEnv } from "./eclinicalworks";
import ElationApi, { ElationEnv } from "./elation";
import { HealthieEnv } from "./healthie";

export type EhrEnv = AthenaEnv | ElationEnv | CanvasEnv | HealthieEnv | EClinicalWorksEnv;
export type EhrEnvAndClientCredentials<Env extends EhrEnv> = {
  environment: Env;
  clientKey: string;
  clientSecret: string;
};

export type EhrEnvAndApiKey<Env extends EhrEnv> = {
  environment: Env;
  apiKey: string;
};

export type EhrClientTwoLeggedAuth = AthenaHealthApi | ElationApi | CanvasApi;
export type EhrClientTwoLeggedAuthParams<Env extends EhrEnv> = {
  twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  practiceId: string;
} & EhrEnvAndClientCredentials<Env>;

export type EhrPerPracticeParams = { cxId: string; practiceId: string };
