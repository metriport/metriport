import { getAthenaEnv } from "@metriport/core/external/ehr/athenahealth/environment";
import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/ehr/athenahealth/index";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import { MetriportError } from "@metriport/shared";
import { athenaClientSource } from "@metriport/shared/interface/external/ehr/athenahealth/jwt-token";
import { createEhrClientWithClientCredentials } from "../shared/utils/client";

export async function createAthenaClientWithTokenIdAndEnvironment(
  perPracticeParams: EhrPerPracticeParams
): Promise<{ client: AthenaHealthApi; tokenId: string; environment: AthenaEnv }> {
  return await createEhrClientWithClientCredentials<AthenaEnv, AthenaHealthApi>({
    ...perPracticeParams,
    source: athenaClientSource,
    getEnv: { params: undefined, getEnv: getAthenaEnv },
    getClient: AthenaHealthApi.create,
  });
}

export async function createAthenaClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<AthenaHealthApi> {
  const { client } = await createAthenaClientWithTokenIdAndEnvironment(perPracticeParams);
  return client;
}

export enum LookupModes {
  FromSubscription = "from-subscription",
  FromSubscriptionBackfill = "from-subscription-backfill",
  Appointments = "appointments",
}
export const lookupModes = [...Object.values(LookupModes)] as const;
export type LookupMode = (typeof lookupModes)[number];
export function isLookupMode(value: string): value is LookupMode {
  return lookupModes.includes(value as LookupMode);
}

export function getAthenaPracticeIdFromPatientId(athenaPatientId: string) {
  const [patientPrefix, patientId] = athenaPatientId.split(".");
  if (!patientPrefix || !patientId) {
    throw new MetriportError("Invalid patient ID", undefined, { athenaPatientId });
  }
  if (!patientPrefix.startsWith("a-")) {
    throw new MetriportError("Invalid patient ID", undefined, { athenaPatientId });
  }
  return `a-1.${patientPrefix.replace("a-", "Practice-")}`;
}
