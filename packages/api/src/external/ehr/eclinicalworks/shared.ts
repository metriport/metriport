import { getEClinicalWorksEnv } from "@metriport/core/external/ehr/eclinicalworks/environment";
import EClinicalWorksApi from "@metriport/core/external/ehr/eclinicalworks/index";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";

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
