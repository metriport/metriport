import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Message } from "@medplum/core";
import { Hl7Server } from "@medplum/hl7";
import { buildHl7NotificationWebhookSender } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-factory";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
  getOrCreateMessageDatetime,
  getSendingApplication,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import {
  createFileKeyHl7Message,
  getCxIdAndPatientIdOrFail,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { utcifyHl7Message } from "@metriport/core/external/hl7-notification/datetime";
import { capture } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { basicToExtendedIso8601 } from "@metriport/shared/common/date";
import { initSentry } from "./sentry";
import { withErrorHandling } from "./utils";

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const bucketName = Config.getHl7IncomingMessageBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());
const hieTimezoneDictionary = Config.getHieTimezoneDictionary();
/**
 * Avoid using message.toString() as its not stringifying every segment
 */
function asString(message: Hl7Message) {
  return message.segments.map(s => s.toString()).join("\n");
}

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const { log } = logger;

  const server = new Hl7Server(connection => {
    connection.addEventListener(
      "message",
      withErrorHandling(async ({ message: rawMessage }) => {
        // TODO: We don't want to fail on a failed lookup - most of our HIEs have not been timezone-ified yet.
        const sendingApplication = getSendingApplication(rawMessage) ?? "Unknown HIE";
        const hieTimezone = hieTimezoneDictionary[sendingApplication] ?? "UTC";
        const message = utcifyHl7Message(rawMessage, hieTimezone);

        const timestamp = basicToExtendedIso8601(getOrCreateMessageDatetime(message));
        const messageId = getMessageUniqueIdentifier(message);

        log(
          `${timestamp}> New Message (id: ${messageId}) from ${connection.socket.remoteAddress}:${connection.socket.remotePort}`
        );

        const { cxId, patientId } = getCxIdAndPatientIdOrFail(message);
        const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(message);

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

        log("Init S3 upload");
        s3Utils.uploadFile({
          bucket: bucketName,
          key: createFileKeyHl7Message({
            cxId,
            patientId,
            timestamp,
            messageId,
            messageCode,
            triggerEvent,
          }),
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
      }, logger)
    );

    connection.addEventListener(
      "error",
      withErrorHandling(error => {
        if (error instanceof Error) {
          logger.log("Connection error:", error);
          capture.error(error);
        } else {
          logger.log("Connection terminated by client");
        }
      }, logger)
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
