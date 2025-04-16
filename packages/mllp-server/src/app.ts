import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Message } from "@medplum/core";
import { Hl7Server } from "@medplum/hl7";
import {
  getHl7MessageTypeIdentifierOrFail,
  getMessageDatetime,
  getMessageUniqueIdentifier,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import {
  buildHl7MessageFileKey,
  formatDateToHl7,
  getPatientIdsOrFail,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import * as Sentry from "@sentry/node";
import { initSentry } from "./sentry";
import { withErrorHandling } from "./utils";

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const bucketName = Config.getHl7NotificationBucketName();
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
        const timestamp = getMessageDatetime(message) ?? formatDateToHl7(new Date());
        const messageId = getMessageUniqueIdentifier(message) ?? uuidv7();
        log(
          `${timestamp}> New Message (id: ${messageId}) from ${connection.socket.remoteAddress}:${connection.socket.remotePort}`
        );

        const { cxId, patientId } = getPatientIdsOrFail(message);

        const msgIdentifier = getHl7MessageTypeIdentifierOrFail(message);
        Sentry.setExtras({
          cxId,
          patientId,
          messageType: msgIdentifier.messageType,
          messageCode: msgIdentifier.triggerEvent,
        });

        // TODO(lucas|2758|2025-03-05): Enqueue message for pickup

        connection.send(message.buildAck());

        s3Utils
          .uploadFile({
            bucket: bucketName,
            key: buildHl7MessageFileKey({
              cxId,
              patientId,
              timestamp,
              messageId,
              messageType: msgIdentifier.messageType,
              messageCode: msgIdentifier.triggerEvent,
            }),
            file: Buffer.from(asString(message)),
            contentType: "text/plain",
          })
          .catch(e => {
            logger.log(`S3 upload failed: ${e}`);
            Sentry.captureException(e);
          });
      }, logger)
    );

    connection.addEventListener(
      "error",
      withErrorHandling(error => {
        if (error instanceof Error) {
          logger.log("Connection error:", error);
          Sentry.captureException(error);
        } else {
          logger.log("Connection terminated by client");
        }
      }, logger)
    );

    connection.addEventListener("close", () => {
      logger.log("Connection closed");
    });
  });

  return server;
}

async function main() {
  const logger = out("MLLP Server");
  const server = await createHl7Server(logger);
  server.start(MLLP_DEFAULT_PORT);
}

main();
