import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Server } from "@medplum/hl7";
import { buildHl7NotificationWebhookSender } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-factory";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
  getSendingApplication,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { getCxIdAndPatientIdOrFail } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getHieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { capture } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { initSentry } from "./sentry";
import {
  asString,
  createRawHl7MessageFileKey,
  getCleanIpAddress,
  lookupHieTzEntryForIp,
  translateMessage,
  withErrorHandling,
} from "./utils";

initSentry();

const MLLP_DEFAULT_PORT = 2575;

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const { log } = logger;

  const server = new Hl7Server(connection => {
    connection.addEventListener(
      "message",
      withErrorHandling(connection, logger, async ({ message: rawMessage }) => {
        const clientIp = getCleanIpAddress(connection.socket.remoteAddress);

        const bucketName = Config.getHl7RawMessageBucketName();
        const s3Utils = new S3Utils(Config.getAWSRegion());
        const rawFileKey = createRawHl7MessageFileKey(clientIp);

        await s3Utils.uploadFile({
          bucket: bucketName,
          key: rawFileKey,
          file: Buffer.from(asString(rawMessage)),
          contentType: "text/plain",
        });

        const clientPort = connection.socket.remotePort;

        log(`New message over connection ${clientIp}:${clientPort}`);
        const hieConfigDictionary = getHieConfigDictionary();
        const { hieName } = lookupHieTzEntryForIp(hieConfigDictionary, clientIp);

        const newMessage = translateMessage(rawMessage, hieName);
        const { cxId, patientId } = getCxIdAndPatientIdOrFail(newMessage);

        const messageId = getMessageUniqueIdentifier(newMessage);
        const sendingApplication = getSendingApplication(newMessage) ?? "Unknown HIE";
        const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(newMessage);
        const messageReceivedTimestamp = buildDayjs(Date.now()).toISOString();
        log(
          `cx: ${cxId}, pt: ${patientId} Received ${triggerEvent} message from ${sendingApplication} at ${messageReceivedTimestamp} (messageId: ${messageId})`
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
          message: asString(newMessage),
          messageReceivedTimestamp,
          hieName,
        });

        connection.send(newMessage.buildAck());
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
  try {
    const server = await createHl7Server(logger);
    server.start(MLLP_DEFAULT_PORT);
  } catch (error) {
    logger.log("Error starting MLLP server", error);
    capture.error(error);
    process.exit(1);
  }
}

main();
