import EclinicalworksApi, {
  EclinicalworksEnv,
  isEclinicalworksEnv,
} from "@metriport/core/external/ehr/eclinicalworks/index";
import { MetriportError } from "@metriport/shared";
import { EhrPerPracticeParams } from "../shared";

function getEclinicalworksEnv(): {
  environment: EclinicalworksEnv;
} {
  const environment = "staging-fhir";
  if (!environment) throw new MetriportError("Eclinicalworks environment not set");
  if (!isEclinicalworksEnv(environment)) {
    throw new MetriportError("Invalid Eclinicalworks environment", undefined, { environment });
  }
  return {
    environment,
  };
}

export async function createEclinicalworksClient(
  perPracticeParams: EhrPerPracticeParams & {
    authToken: string;
    aud: string;
  }
): Promise<EclinicalworksApi> {
  const { environment } = getEclinicalworksEnv();
  return await EclinicalworksApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    authToken: perPracticeParams.authToken,
    aud: perPracticeParams.aud,
  });
}
