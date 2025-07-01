import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Message } from "@medplum/core";
import { Hl7Connection } from "@medplum/hl7";
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import { Config } from "@metriport/core/util/config";
import { Logger } from "@metriport/core/util/log";
import { unpackUuid } from "@metriport/core/util/pack-uuid";
import * as Sentry from "@sentry/node";
import { getSendingApplication } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import {
  getCxIdAndPatientIdOrFail,
  createUnpackPidFailureFileKey,
  getOptionalValueFromMessage,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { utcifyHl7Message } from "@metriport/core/external/hl7-notification/datetime";
import { buildDayjs, ISO_DATE_TIME } from "@metriport/shared/common/date";
import { hieTimezoneDictionary, s3Utils, bucketName, asString } from "./app";

const crypto = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());

function reformUuid(shortId: string) {
  return unpackUuid(crypto.unscramble(shortId));
}

export function unpackPidField(pid: string | undefined) {
  if (!pid) {
    return { cxId: "UNK", patientId: "UNK" };
  }

  const [cxId, patientId] = pid.split("_").map(reformUuid);
  return { cxId, patientId };
}

export function withErrorHandling<T>(
  connection: Hl7Connection,
  logger: Logger,
  handler: (data: T) => void
): (data: T) => Promise<void> {
  return async (data: T) => {
    const isMessageEvent = data instanceof Hl7Message;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    await Sentry.withScope(async (_: Sentry.Scope) => {
      try {
        await handler(data);
      } catch (error) {
        if (isMessageEvent) {
          connection.send(data.buildAck());
        }

        logger.log(`Error in handler: ${error}`);
        Sentry.captureException(error);
      }
    });
  };
}

export interface ParsedHl7Data {
  message: Hl7Message;
  cxId: string;
  patientId: string;
}

export async function parseHl7Message(rawMessage: Hl7Message): Promise<ParsedHl7Data> {
  const sendingApplication = getSendingApplication(rawMessage) ?? "Unknown HIE";
  const hieTimezone = hieTimezoneDictionary[sendingApplication] ?? "UTC";
  const message = utcifyHl7Message(rawMessage, hieTimezone);

  const { cxId, patientId } = getCxIdAndPatientIdOrFail(message);

  return {
    message,
    cxId,
    patientId,
  };
}
export async function handleParsingError(rawMessage: Hl7Message, logger: Logger) {
  const { log } = logger;

  const fileKey = createUnpackPidFailureFileKey({
    rawPtIdentifier: getOptionalValueFromMessage(rawMessage, "PID", 3, 1) ?? "unknown-patient",
    rawTimestamp:
      getOptionalValueFromMessage(rawMessage, "MSH", 7, 1) ?? buildDayjs().format(ISO_DATE_TIME),
    messageCode: getOptionalValueFromMessage(rawMessage, "MSH", 9, 1) ?? "UNK",
    triggerEvent: getOptionalValueFromMessage(rawMessage, "MSH", 9, 2) ?? "UNK",
  });

  log(`Parsing failed, uploading raw HL7 message to S3 with key: ${fileKey}`);
  await s3Utils.uploadFile({
    bucket: bucketName,
    key: fileKey,
    file: Buffer.from(asString(rawMessage)),
    contentType: "text/plain",
  });
}
