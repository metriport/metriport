import { generateAndUploadHl7v2Roster } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { Hl7v2RosterConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { getEnvOrFail } from "./shared/env";

const apiUrl = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");

export async function handler(config: Hl7v2RosterConfig): Promise<void> {
  await generateAndUploadHl7v2Roster({ config, bucketName, apiUrl });
}
