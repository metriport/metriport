import { getEnvVarOrFail } from "@metriport/shared";
import { Config } from "../../../../../../../util/config";
import { GetJobsHandler } from "./get-jobs";
import { GetJobsCloud } from "./get-jobs-cloud";
import { GetJobsDirect } from "./get-jobs-direct";

export function buildGetJobsHandler(): GetJobsHandler {
  if (Config.isDev()) {
    const dbCreds = getEnvVarOrFail("DB_CREDS");
    return new GetJobsDirect(dbCreds);
  }
  const getPatientJobsLambdaName = Config.getPatientJobsLambdaName();
  return new GetJobsCloud(getPatientJobsLambdaName);
}
