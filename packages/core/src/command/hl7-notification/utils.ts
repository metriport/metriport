import { Hl7Message } from "@medplum/core";
import {
  createUnparseableHl7MessageErrorMessageFileKey,
  createUnparseableHl7MessageFileKey,
  getCxIdAndPatientIdOrFail,
  getOptionalValueFromMessage,
} from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { utcifyHl7Message } from "../../external/hl7-notification/datetime";
import { errorToString } from "@metriport/shared";
import { buildDayjs, ISO_DATE_TIME } from "@metriport/shared/common/date";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";

export interface ParsedHl7Data {
  message: Hl7Message;
  cxId: string;
  patientId: string;
}

const supportedTypes = ["A01", "A03"] as const;

export type SupportedTriggerEvent = (typeof supportedTypes)[number];
export function isSupportedTriggerEvent(
  triggerEvent: string
): triggerEvent is SupportedTriggerEvent {
  return supportedTypes.includes(triggerEvent as SupportedTriggerEvent);
}

export async function parseHl7Message(
  rawMessage: Hl7Message,
  hieConfig: string
): Promise<ParsedHl7Data> {
  const message = utcifyHl7Message(rawMessage, hieConfig);

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
  log: typeof console.log
) {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getHl7IncomingMessageBucketName();

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

/**
 * Avoid using message.toString() as its not stringifying every segment
 */
export function asString(message: Hl7Message) {
  return message.segments.map(s => s.toString()).join("\n");
}
