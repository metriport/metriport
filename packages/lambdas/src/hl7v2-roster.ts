import {
  Hl7v2RosterGenerator,
  RosterGenerateProps,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { getEnvOrFail } from "./shared/env";

const apiUrl = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");
const hieConfigs = getEnvOrFail("HIE_CONFIGS");

export async function handler(props: RosterGenerateProps): Promise<void> {
  console.log("the hieConfigs are", JSON.stringify(hieConfigs, null, 2));
  await new Hl7v2RosterGenerator(apiUrl, bucketName).execute(props);
}
