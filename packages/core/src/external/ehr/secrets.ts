import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { z } from "zod";

const ehrSourcesWithDynamicSecrets = [
  EhrSources.canvas,
  EhrSources.athena,
  EhrSources.elation,
  EhrSources.healthie,
] as const;
export type EhrSourceWithDynamicSecrets = (typeof ehrSourcesWithDynamicSecrets)[number];
export function isEhrSourceWithDynamicSecrets(ehr: string): ehr is EhrSourceWithDynamicSecrets {
  return ehrSourcesWithDynamicSecrets.includes(ehr as EhrSourceWithDynamicSecrets);
}

export const getSecretsOauthSchema = z.object({
  environment: z.string(),
  clientKey: z.string(),
  clientSecret: z.string(),
});
export type GetSecretsOauthResult = z.infer<typeof getSecretsOauthSchema>;

export const getSecretsApiKeySchema = z.object({
  environment: z.string(),
  apiKey: z.string(),
});
export type GetSecretsApiKeyResult = z.infer<typeof getSecretsApiKeySchema>;
