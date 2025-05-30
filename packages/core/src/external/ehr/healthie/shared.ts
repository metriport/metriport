import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import HealthieApi, { isHealthieEnv } from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getSecretsApiKeySchema } from "../shared";

export async function createHealthieClient({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}) {
  const secrets = await getSecrets({
    cxId,
    practiceId,
    ehr: EhrSources.healthie,
    schema: getSecretsApiKeySchema,
  });
  const environment = secrets.environment;
  if (!isHealthieEnv(environment)) {
    throw new BadRequestError("Invalid environment", undefined, {
      ehr: EhrSources.healthie,
      environment,
    });
  }
  return await HealthieApi.create({
    practiceId,
    environment,
    apiKey: secrets.apiKey,
  });
}
