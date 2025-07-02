import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Server } from "@medplum/hl7";
import { buildHl7NotificationWebhookSender } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-factory";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
  getOrCreateMessageDatetime,
  getSendingApplication,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { createFileKeyHl7Message } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { capture } from "@metriport/core/util";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { handleParsingError, ParsedHl7Data, parseHl7Message } from "./parsing";
import { asString, bucketName, s3Utils, withErrorHandling } from "./utils";
import { initSentry } from "./sentry";

initSentry();

const MLLP_DEFAULT_PORT = 2575;

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const { log } = logger;

  const server = new Hl7Server(connection => {
    connection.addEventListener(
      "message",
      withErrorHandling(connection, logger, async ({ message: rawMessage }) => {
        let parsedData: ParsedHl7Data;

        try {
          parsedData = await parseHl7Message(rawMessage);
        } catch (parseError) {
          await handleParsingError(rawMessage, logger);
          throw parseError;
        }

        const { message, cxId, patientId } = parsedData;

        const messageId = getMessageUniqueIdentifier(message);
        const sendingApplication = getSendingApplication(message) ?? "Unknown HIE";
        const timestamp = getOrCreateMessageDatetime(message);
        const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(message);

        log(
          `cx: ${cxId}, pt: ${patientId} Received ${triggerEvent} message from ${sendingApplication} at ${timestamp} (messageId: ${messageId})`
        );

        capture.setExtra({
          cxId,
          patientId,
          messageCode,
          triggerEvent,
        });

        await buildHl7NotificationWebhookSender().execute({
          cxId,
          patientId,
          message: asString(message),
          sourceTimestamp: timestamp,
          messageReceivedTimestamp: new Date().toISOString(),
        });

        connection.send(message.buildAck());

        const fileKey = createFileKeyHl7Message({
          cxId,
          patientId,
          timestamp,
          messageId,
          messageCode,
          triggerEvent,
        });

        log(`Init S3 upload to bucket ${bucketName} with key ${fileKey}`);
        s3Utils.uploadFile({
          bucket: bucketName,
          key: fileKey,
          file: Buffer.from(asString(message)),
          contentType: "text/plain",
        });

        analytics({
          distinctId: cxId,
          event: EventTypes.hl7NotificationReceived,
          properties: {
            cxId,
            patientId,
            messageCode,
            triggerEvent,
            platform: "mllp-server",
          },
        });
      })
    );

    connection.addEventListener(
      "error",
      withErrorHandling(connection, logger, error => {
        if (error instanceof Error) {
          logger.log("Connection error:", error);
          capture.error(error);
        } else {
          logger.log("Connection terminated by client");
        }
      })
    );
  });

  return server;
}

async function main() {
  const logger = out("MLLP Server");
  const server = await createHl7Server(logger);
  server.start(MLLP_DEFAULT_PORT);
}

main();
