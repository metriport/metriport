import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Message } from "@medplum/core";
import { Hl7Server } from "@medplum/hl7";
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
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
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
        const timestamp = getOrCreateMessageDatetime(message);
        const messageId = getMessageUniqueIdentifier(message);
        log(
          `${timestamp}> New Message (id: ${messageId}) from ${connection.socket.remoteAddress}:${connection.socket.remotePort}`
        );

        const { cxId, patientId } = getCxIdAndPatientIdOrFail(message);

        const msgType = getHl7MessageTypeOrFail(message);
        Sentry.setExtras({
          cxId,
          patientId,
          messageType: msgType.messageType,
          messageCode: msgType.triggerEvent,
        });

<<<<<<< HEAD
=======
        const messageTypeField = message.getSegment("MSH")?.getField(MESSAGE_TYPE_FIELD);
        const messageType = messageTypeField?.getComponent(MESSAGE_CODE_COMPONENT) ?? "UNK";
        const messageCode = messageTypeField?.getComponent(TRIGGER_EVENT_COMPONENT) ?? "UNK";
        Sentry.setExtras({ cxId, patientId, messageType, messageCode });

>>>>>>> e784b9c3e (feat(infra): lift sentry extras setting)
        log("TODO: Send message to queue - see next PR");

        connection.send(message.buildAck());

        s3Utils
          .uploadFile({
            bucket: bucketName,
            key: buildHl7MessageFileKey({
              cxId,
              patientId,
              timestamp,
              messageId,
              messageType: msgType.messageType,
              messageCode: msgType.triggerEvent,
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
