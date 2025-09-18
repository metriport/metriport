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
import { getHieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { capture } from "@metriport/core/util";
import type { Logger } from "@metriport/core/util/log";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { initSentry } from "./sentry";
import { asString, getCleanIpAddress, lookupHieTzEntryForIp, withErrorHandling } from "./utils";

initSentry();

import { SUPPORTED_MLLP_SERVER_PORTS } from "@metriport/core/command/hl7-notification/constants";

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const { log } = logger;

  const server = new Hl7Server(connection => {
    connection.addEventListener(
      "message",
      withErrorHandling(connection, logger, async ({ message: rawMessage }) => {
        const clientIp = getCleanIpAddress(connection.socket.remoteAddress);
        const clientPort = connection.socket.remotePort;

        log(`New message over connection ${clientIp}:${clientPort}`);

        const { cxId, patientId } = getCxIdAndPatientIdOrFail(rawMessage);

        const messageId = getMessageUniqueIdentifier(rawMessage);
        const sendingApplication = getSendingApplication(rawMessage) ?? "Unknown HIE";
        const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(rawMessage);
        const messageReceivedTimestamp = buildDayjs(Date.now()).toISOString();
        log(
          `cx: ${cxId}, pt: ${patientId} Received ${triggerEvent} message from ${sendingApplication} at ${messageReceivedTimestamp} (messageId: ${messageId})`
        );
        const hieConfigDictionary = getHieConfigDictionary();
        const { hieName } = lookupHieTzEntryForIp(hieConfigDictionary, clientIp);

        capture.setExtra({
          cxId,
          patientId,
          messageCode,
          triggerEvent,
        });

        await buildHl7NotificationWebhookSender().execute({
          cxId,
          patientId,
          message: asString(rawMessage),
          messageReceivedTimestamp,
          hieName,
        });

        connection.send(rawMessage.buildAck());
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
    SUPPORTED_MLLP_SERVER_PORTS.forEach(port => {
      server.start(port);
    });
  } catch (error) {
    logger.log("Error starting MLLP server", error);
    capture.error(error);
    process.exit(1);
  }
}

main();
