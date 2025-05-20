import EClinicalWorksApi, {
  EClinicalWorksEnv,
  isEClinicalWorksEnv,
} from "@metriport/core/external/ehr/eclinicalworks/index";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { EhrPerPracticeParams } from "../shared/utils/client";

function getEClinicalWorksEnv(): {
  environment: EClinicalWorksEnv;
} {
  const environment = Config.getEClinicalWorksEnv();
  if (!environment) throw new MetriportError("EClinicalWorks environment not set");
  if (!isEClinicalWorksEnv(environment)) {
    throw new MetriportError("Invalid EClinicalWorks environment", undefined, { environment });
  }
  return {
    environment,
  };
}

type EClinicalWorksPerPracticeParams = EhrPerPracticeParams & {
  authToken: string;
};

export async function createEClinicalWorksClient(
  perPracticeParams: EClinicalWorksPerPracticeParams
): Promise<EClinicalWorksApi> {
  const { environment } = getEClinicalWorksEnv();
  return await EClinicalWorksApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    authToken: perPracticeParams.authToken,
  });
}
