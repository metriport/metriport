import { BadRequestError } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { QuestUploadRosterHandlerDirect } from "@metriport/core/external/quest/command/upload-roster/upload-roster-direct";
import { questRosterRequestSchema, QuestRosterRequest } from "@metriport/core/external/quest/types";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: unknown) => {
  capture.setExtra({ context: lambdaName });
  const rosterRequest = parseRosterRequestFromEvent(event);

  const log = prefixedLog("quest.upload-roster");
  log("Starting upload of Quest roster");
  const handler = new QuestUploadRosterHandlerDirect();
  await handler.generateAndUploadLatestQuestRoster(rosterRequest);
  log("Upload of Quest roster completed");
});

/**
 * Parse the Lambda event, or throw a BadRequestError if the event is invalid.
 */
function parseRosterRequestFromEvent(event: unknown): QuestRosterRequest {
  const parsedEvent = questRosterRequestSchema.safeParse(event);
  if (!parsedEvent.success) {
    throw new BadRequestError("Invalid request", undefined, {
      event: JSON.stringify(event),
      error: parsedEvent.error.toString(),
    });
  }
  return parsedEvent.data;
}
