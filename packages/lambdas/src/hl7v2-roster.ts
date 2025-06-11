import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { uploadThroughSftp } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-uploader";
import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { initTimer } from "@metriport/shared/common/timer";
import { out } from "@metriport/core/util/log";

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

  log(`Starting roster generation for config: ${config.name}`);
  const rosterCsv = await new Hl7v2RosterGenerator(apiUrl, bucketName).execute(config);
  log(`Roster generation completed in ${timer.getElapsedTime()}ms`);

  if (rosterCsv) {
    const uploadTimer = initTimer();
    log(`Starting SFTP upload for config: ${config.name}`);
    await uploadThroughSftp(config, rosterCsv);
    log(`SFTP upload completed in ${uploadTimer.getElapsedTime()}ms`);
  }

  log(`Done. Total duration: ${timer.getElapsedTime()}ms`);
});
