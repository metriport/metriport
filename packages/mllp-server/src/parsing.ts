import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Message } from "@medplum/core";
import {
  createUnparseableHl7MessageErrorMessageFileKey,
  createUnparseableHl7MessageFileKey,
  getCxIdAndPatientIdOrFail,
  getOptionalValueFromMessage,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { utcifyHl7Message } from "@metriport/core/external/hl7-notification/datetime";
import { Logger } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { buildDayjs, ISO_DATE_TIME } from "@metriport/shared/common/date";
import { asString, bucketName, s3Utils } from "./utils";
export interface ParsedHl7Data {
  message: Hl7Message;
  cxId: string;
  patientId: string;
}

export async function parseHl7Message(
  rawMessage: Hl7Message,
  hieTimezone: string
): Promise<ParsedHl7Data> {
  const message = utcifyHl7Message(rawMessage, hieTimezone);

  const { cxId, patientId } = getCxIdAndPatientIdOrFail(message);

  return {
    message,
    cxId,
    patientId,
  };
}

export async function persistHl7MessageError(
  rawMessage: Hl7Message,
  parseError: unknown,
  logger: Logger
) {
  const { log } = logger;

  const keyParams = {
    rawPtIdentifier: getOptionalValueFromMessage(rawMessage, "PID", 3, 1) ?? "unknown-patient",
    rawTimestamp:
      getOptionalValueFromMessage(rawMessage, "MSH", 7, 1) ?? buildDayjs().format(ISO_DATE_TIME),
    messageCode: getOptionalValueFromMessage(rawMessage, "MSH", 9, 1) ?? "UNK",
    triggerEvent: getOptionalValueFromMessage(rawMessage, "MSH", 9, 2) ?? "UNK",
  };

  const fileKey = createUnparseableHl7MessageFileKey(keyParams);
  const errorFileKey = createUnparseableHl7MessageErrorMessageFileKey(keyParams);

  log(`Parsing failed, uploading raw HL7 message to S3 with key: ${fileKey}`);
  await s3Utils.uploadFile({
    bucket: bucketName,
    key: fileKey,
    file: Buffer.from(asString(rawMessage)),
    contentType: "text/plain",
  });

  log(`Parsing failed, uploading error message to S3 with key: ${errorFileKey}`);
  await s3Utils.uploadFile({
    bucket: bucketName,
    key: errorFileKey,
    file: Buffer.from(errorToString(parseError)),
    contentType: "text/plain",
  });
}
