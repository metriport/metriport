import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Server } from "@medplum/hl7";
import { Hl7Message } from "@medplum/core";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/node";
import { initSentry } from "./sentry";
import { buildS3Key, unpackPidField, withErrorHandling } from "./utils";

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const bucketName = Config.getHl7NotificationBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());

const MESSAGE_TYPE_FIELD = 9;
const MESSAGE_CODE_COMPONENT = 1;
const TRIGGER_EVENT_COMPONENT = 1;

const IDENTIFIER_FIELD = 3;
const IDENTIFIER_COMPONENT = 1;

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
        const timestamp = new Date().toISOString();
        log(
          `${timestamp}> New Message from ${connection.socket.remoteAddress}:${connection.socket.remotePort}`
        );

        const pid = message.getSegment("PID")?.getComponent(IDENTIFIER_FIELD, IDENTIFIER_COMPONENT);
        const { cxId, patientId } = unpackPidField(pid);

        const messageTypeField = message.getSegment("MSH")?.getField(MESSAGE_TYPE_FIELD);
        const messageType = messageTypeField?.getComponent(MESSAGE_CODE_COMPONENT) ?? "UNK";
        const messageCode = messageTypeField?.getComponent(TRIGGER_EVENT_COMPONENT) ?? "UNK";
        Sentry.setExtras({ cxId, patientId, messageType, messageCode });

        // TODO(lucas|2758|2025-03-05): Enqueue message for pickup

        connection.send(message.buildAck());

        s3Utils
          .uploadFile({
            bucket: bucketName,
            key: buildS3Key({
              cxId,
              patientId,
              timestamp,
              messageType,
              messageCode,
            }),
            file: Buffer.from(asString(message)),
            contentType: "application/json",
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
