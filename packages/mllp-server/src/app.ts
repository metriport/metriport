import { Hl7Server } from "@medplum/hl7";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { unpackUuid } from "@metriport/core/util/pack-uuid";
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import * as dotenv from "dotenv";
import * as Sentry from "@sentry/node";
import { initSentry } from "./sentry";
import { Config } from "@metriport/core/util/config";
import { S3Utils } from "@metriport/core/external/aws/s3";

dotenv.config();

initSentry();

const MLLP_DEFAULT_PORT = 2575;
const bucketName = Config.getHl7NotificationBucketName();

const constructKey = ({
  cxId,
  patientId,
  timestamp,
  messageType,
  messageCode,
}: {
  cxId: string;
  patientId: string;
  timestamp: string;
  messageType: string;
  messageCode: string;
}) => {
  return `${cxId}/${patientId}/${timestamp}_${messageType}_${messageCode}.hl7`;
};

const crypto = new Base64Scrambler(Config.getBase64ScramblerSecret());

const unpackPidField = (pid: string) => {
  const [cxString, patientString] = pid.split("_").map(s => crypto.unscramble(s));

  const cxId = unpackUuid(cxString);
  const patientId = unpackUuid(patientString);

  return { cxId, patientId };
};

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const s3Utils = new S3Utils(Config.getAWSRegion());

  const server = new Hl7Server(connection => {
    logger.log("Connection received");

    connection.addEventListener("message", async ({ message }) => {
      const timestamp = new Date().toISOString();
      logger.log(
        `${timestamp}> New Message from ${connection.socket.remoteAddress}:${connection.socket.remotePort}`
      );

      const pid = message.getSegment("PID")?.getComponent(3, 1);
      if (!pid) {
        throw new Error("Patient Identifier missing");
      }

      /**
       * Avoid using message.toString() as it seems buggy and doesn't stringify every segment
       */
      const fullMessage = message.segments.map(s => s.toString()).join("\n");
      const { cxId, patientId } = unpackPidField(pid);

      /**
       * According to docs, the message type and code are in segment 9, but
       * we've seen many sample ADTs with the message type and code in segment 8
       *
       * TODO(lucas|2854|2025-04-03): More advanced handling of different HL7 versions
       */
      const isAdtInPidSegment = (component: number) =>
        message.getSegment("PID")?.getComponent(component, 1).startsWith("ADT");

      let messageType: string | undefined;
      let messageCode: string | undefined;
      if (isAdtInPidSegment(9)) {
        messageType = message.getSegment("PID")?.getComponent(9, 1) ?? "UNK";
        messageCode = message.getSegment("PID")?.getComponent(9, 2) ?? "UNK";
      } else if (isAdtInPidSegment(8)) {
        messageType = message.getSegment("PID")?.getComponent(8, 1) ?? "UNK";
        messageCode = message.getSegment("PID")?.getComponent(8, 2) ?? "UNK";
      }

      await s3Utils.uploadFile({
        bucket: bucketName,
        key: constructKey({
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
