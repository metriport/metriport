import { Hl7Server } from "@medplum/hl7";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import * as dotenv from "dotenv";
import * as Sentry from "@sentry/node";
import { initSentry } from "./sentry";
import { S3Utils } from "@metriport/core/src/external/aws/s3";
import { Config } from "@metriport/core/src/util/config";

dotenv.config();

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const s3Utils = new S3Utils(Config.getAWSRegion());

function generateS3KeyPrefix(message: Hl7Message) {
  const messageType = message.get("MSH.9.1");
  const triggerEvent = message.get("MSH.9.2");

  const sendingFacility = message.get("MSH.4.1");

  const timestampRaw = message.get("MSH.7.1");
  const timestampDate = timestampRaw.substring(0, 8); // YYYYMMDD
  const timestampHour = timestampRaw.substring(8, 12); // HHMM

  const controlId = message.get("MSH.10");

  return `${messageType}/${triggerEvent}/${sendingFacility}/${timestampDate}_${timestampHour}_${controlId}.hl7`;
}

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const server = new Hl7Server(connection => {
    logger.log("Connection received");

    connection.addEventListener("message", async ({ message }) => {
      logger.log(
        `## New Message from ${connection.socket.remoteAddress}:${connection.socket.remotePort} ##`
      );
      // TODO(lucas|2758|2025-03-05): Enqueue message for pickup
      await s3Utils.uploadFile({
        bucket: "metriport-hl7v2-messages",
        key: generateS3KeyPrefix(message),
        file: Buffer.from(message.toString()),
      });
      connection.send(message.buildAck());
    });

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
