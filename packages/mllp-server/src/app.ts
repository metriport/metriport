import { Hl7Server } from "@medplum/hl7";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/node";
import * as dotenv from "dotenv";
import { initSentry } from "./sentry";
import { buildS3Key, unpackPidField } from "./utils";

dotenv.config();

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const bucketName = Config.getHl7NotificationBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());

const MESSAGE_TYPE_FIELD = 9;
const MESSAGE_CODE_COMPONENT = 1;
const TRIGGER_EVENT_COMPONENT = 1;

const IDENTIFIER_FIELD = 3;
const IDENTIFIER_COMPONENT = 1;

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const { log } = logger;

  const server = new Hl7Server(connection => {
    logger.log("Connection received");

    connection.addEventListener("message", async ({ message }) => {
      const timestamp = new Date().toISOString();
      log(
        `${timestamp}> New Message from ${connection.socket.remoteAddress}:${connection.socket.remotePort}`
      );

      const fullMessage = message.segments.map(s => s.toString()).join("\n");

      /**
       * Avoid using message.toString() as its not stringifying every segment
       */
      const pid = message.getSegment("PID")?.getComponent(IDENTIFIER_FIELD, IDENTIFIER_COMPONENT);
      let { cxId, patientId } = { cxId: `UNK-${pid}`, patientId: "UNK" };
      if (pid) {
        ({ cxId, patientId } = unpackPidField(pid));
      }

      const messageTypeField = message.getSegment("MSH")?.getField(MESSAGE_TYPE_FIELD);
      const messageType = messageTypeField?.getComponent(MESSAGE_CODE_COMPONENT) ?? "UNK";
      const messageCode = messageTypeField?.getComponent(TRIGGER_EVENT_COMPONENT) ?? "UNK";

      await s3Utils.uploadFile({
        bucket: bucketName,
        key: buildS3Key({
          cxId,
          patientId,
          timestamp,
          messageType,
          messageCode,
        }),
        file: Buffer.from(fullMessage),
        contentType: "application/json",
      });
      connection.send(message.buildAck());
    });

    // TODO(lucas|2758|2025-03-05): Enqueue message for pickup

    connection.addEventListener("error", error => {
      if (error instanceof Error) {
        logger.log("Connection error:", error);
        Sentry.captureException(error);
      } else {
        logger.log("Connection terminated by client");
      }
    });

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
