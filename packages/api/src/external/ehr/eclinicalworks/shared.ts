import EclinicalworksApi, {
  EclinicalworksEnv,
  isEclinicalworksEnv,
} from "@metriport/core/external/ehr/eclinicalworks/index";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { EhrPerPracticeParams } from "../shared/utils/client";

function getEclinicalworksEnv(): {
  environment: EclinicalworksEnv;
} {
  const environment = Config.getEclinicalworksEnv();
  if (!environment) throw new MetriportError("EClinicalWorks environment not set");
  if (!isEclinicalworksEnv(environment)) {
    throw new MetriportError("Invalid EClinicalWorks environment", undefined, { environment });
  }
  return {
    environment,
  };
}

export async function createEclinicalworksClient(
  perPracticeParams: EhrPerPracticeParams & {
    authToken: string;
    fhirUrl: string;
  }
): Promise<EclinicalworksApi> {
  const { environment } = getEclinicalworksEnv();
  return await EclinicalworksApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    authToken: perPracticeParams.authToken,
    fhirUrl: perPracticeParams.fhirUrl,
  });
}
