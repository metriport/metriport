import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Message } from "@medplum/core";
import { Hl7Server } from "@medplum/hl7";
import { buildHl7NotificationWebhookSender } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-factory";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
  getOrCreateMessageDatetime,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import {
  buildHl7MessageFileKey,
  getCxIdAndPatientIdOrFail,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { capture } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { initSentry } from "./sentry";
import { withErrorHandling } from "./utils";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const bucketName = Config.getHl7IncomingMessageBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());

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
      withErrorHandling(async ({ message }) => {
        const timestamp = getOrCreateMessageDatetime(message);
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
          messageReceivedTimestamp: timestamp,
        });

        connection.send(message.buildAck());

        log("Init S3 upload");
        s3Utils.uploadFile({
          bucket: bucketName,
          key: buildHl7MessageFileKey({
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
