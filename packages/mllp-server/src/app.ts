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
import {
  getPccSourceHieNameByLocalPort,
  isPccConnection,
  SUPPORTED_MLLP_SERVER_PORTS,
} from "@metriport/core/domain/hl7-notification/utils";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getHieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { capture } from "@metriport/core/util";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { initSentry } from "./sentry";
import {
  asString,
  bucketName,
  createRawHl7MessageFileKey,
  getCleanIpAddress,
  getHieConfig,
  isImpersonationTestMessage,
  s3Utils,
  translateMessage,
  withErrorHandling,
} from "./utils";

initSentry();

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const { log } = logger;

  const server = new Hl7Server(connection => {
    connection.addEventListener(
      "message",
      withErrorHandling(connection, logger, async ({ message: rawMessage }) => {
        const remoteIp = getCleanIpAddress(connection.socket.remoteAddress);
        const remotePort = connection.socket.remotePort;
        const localPort = connection.socket.localPort;
        if (!localPort) {
          throw new Error("Local port is undefined");
        }

        log(`New message over connection ${remoteIp}:${remotePort}`);
        const rawFileKey = createRawHl7MessageFileKey(remoteIp);

        const uploadResult = await uploadFileSafely(
          s3Utils,
          bucketName,
          rawFileKey,
          asString(rawMessage)
        );
        if (!uploadResult.success) {
          capture.error(uploadResult.error);
        }

        const hieConfigDictionary = getHieConfigDictionary();
        const { hieName: rawHieName, impersonationTimezone } = getHieConfig(
          hieConfigDictionary,
          remoteIp,
          rawMessage
        );

        // For PCC connections, port determines the HIE
        // port takes precedence over ZIT segment, ZIT is intended for testing this is the easiest way to test port PCC precendence.
        // For non-PCC connections, ZIT segment can override IP-based detection
        const isImpersonation = isImpersonationTestMessage(rawMessage);
        const hieName = isPccConnection(rawHieName)
          ? getPccSourceHieNameByLocalPort(localPort)
          : rawHieName;

        log(
          `HIE detection: rawHieName=${rawHieName}, localPort=${localPort}, isImpersonation=${isImpersonation}, isPccConnection=${isPccConnection(
            rawHieName
          )}, finalHieName=${hieName}`
        );

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
          impersonationTimezone,
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
          logger.log("Connection terminated by remote");
        }
      })
    );
  });

  return server;
}

type UploadResult = { success: true } | { success: false; error: unknown };

async function uploadFileSafely(
  s3Utils: S3Utils,
  bucket: string,
  key: string,
  content: string
): Promise<UploadResult> {
  try {
    await s3Utils.uploadFile({
      bucket,
      key,
      file: Buffer.from(content),
      contentType: "text/plain",
    });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

async function main() {
  const logger = out("MLLP Server");
  try {
    for (const port of SUPPORTED_MLLP_SERVER_PORTS) {
      const server = await createHl7Server(logger);
      server.start(port);
      logger.log(`MLLP server started on port ${port}`);
    }
  } catch (error) {
    logger.log("Error starting MLLP server", error);
    capture.error(error);
    process.exit(1);
  }
}

main();
