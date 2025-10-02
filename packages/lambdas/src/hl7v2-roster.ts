import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { initTimer } from "@metriport/shared/common/timer";
import { out } from "@metriport/core/util/log";
import { Config } from "@metriport/core/util/config";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";

const apiUrl = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("HL7V2_ROSTER_BUCKET_NAME");

export const handler = capture.wrapHandler(async (config: HieConfig): Promise<void> => {
  const { log } = out(`HL7v2 Roster. config: ${config.name}`);
  const timer = initTimer();

  capture.setExtra({
    config: config.name,
    states: config.states,
    subscriptions: config.subscriptions,
    context: "hl7-roster.execute",
  });

  log(`Setting hl7 scrambler seed`);
  const secretArn = Config.getHl7Base64ScramblerSeedArn();
  const hl7Base64ScramblerSeed = await getSecretValueOrFail(secretArn, Config.getAWSRegion());
  process.env["HL7_BASE64_SCRAMBLER_SEED"] = hl7Base64ScramblerSeed;
  if (config.name === "MyTestHIE") {
    log("MyTestHIE is a test hie with no sftp connection. Skipping roster upload.");
    return;
  }

  log(`Starting roster generation for config: ${config.name}`);
  await new Hl7v2RosterGenerator(apiUrl, bucketName).execute(config);
  log(`Roster generation completed in ${timer.getElapsedTime()}ms`);
  log(`Done. Total duration: ${timer.getElapsedTime()}ms`);
});
