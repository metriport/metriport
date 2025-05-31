import TouchWorksApi, {
  TouchWorksEnv,
  isTouchWorksEnv,
} from "@metriport/core/external/ehr/touchworks/index";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { EhrPerPracticeParams } from "../shared/utils/client";

function getTouchWorksEnv(): {
  environment: TouchWorksEnv;
} {
  const environment = Config.getTouchWorksEnv();
  if (!environment) throw new MetriportError("TouchWorks environment not set");
  if (!isTouchWorksEnv(environment)) {
    throw new MetriportError("Invalid TouchWorks environment", undefined, { environment });
  }
  return {
    environment,
  };
}

type TouchWorksPerPracticeParams = EhrPerPracticeParams & {
  authToken: string;
};

export async function createTouchWorksClient(
  perPracticeParams: TouchWorksPerPracticeParams
): Promise<TouchWorksApi> {
  const { environment } = getTouchWorksEnv();
  return await TouchWorksApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    authToken: perPracticeParams.authToken,
  });
}
