import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import HealthieApi, { isHealthieEnv } from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { GetSecretsApiKeyResult, getSecretsApiKeySchema } from "../shared";

export async function createHealthieClient({
  environment,
  cxId,
  practiceId,
}: {
  environment: string;
  cxId: string;
  practiceId: string;
}) {
  if (!isHealthieEnv(environment)) {
    throw new BadRequestError("Invalid environment", undefined, {
      ehr: EhrSources.healthie,
      environment,
    });
  }
  return await HealthieApi.create({
    practiceId,
    environment,
    getSecrets: async () =>
      getSecrets<GetSecretsApiKeyResult>({
        ehr: EhrSources.healthie,
        cxId,
        practiceId,
        schema: getSecretsApiKeySchema,
      }),
  });
}
