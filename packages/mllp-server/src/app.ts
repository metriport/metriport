import { Hl7Server } from "@medplum/hl7";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/node";
import * as dotenv from "dotenv";
import { initSentry } from "./sentry";
import { constructS3Key, unpackPidField } from "./utils";

dotenv.config();

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const bucketName = Config.getHl7NotificationBucketName();

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const { log } = logger;
  const s3Utils = new S3Utils(Config.getAWSRegion());

  const server = new Hl7Server(connection => {
    logger.log("Connection received");

    connection.addEventListener("message", async ({ message }) => {
      const timestamp = new Date().toISOString();
      log(
        `${timestamp}> New Message from ${connection.socket.remoteAddress}:${connection.socket.remotePort}`
      );

      const pid = message.getSegment("PID")?.getComponent(3, 1);
      if (!pid) {
        throw new Error("Patient Identifier missing");
      }

      /**
       * Avoid using message.toString() as its not stringifying every segment
       */
      const fullMessage = message.segments.map(s => s.toString()).join("\n");
      const { cxId, patientId } = unpackPidField(pid);

      const messageType = message.getSegment("MSH")?.getComponent(9, 1) ?? "UNK";
      const messageCode = message.getSegment("MSH")?.getComponent(9, 2) ?? "UNK";

      await s3Utils.uploadFile({
        bucket: bucketName,
        key: constructS3Key({
          cxId,
          patientId,
          timestamp,
          messageType: messageType ?? "unknown",
          messageCode: messageCode ?? "unknown",
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
