import { Hl7Field, Hl7Message, Hl7Segment } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { capture, out } from "../../../util";
import { Base64Scrambler } from "../../../util/base64-scrambler";
import { Config } from "../../../util/config";
import { ICD_10_URL, ICD_9_URL, LOINC_URL, SNOMED_URL } from "../../../util/constants";
import { HL7_FILE_EXTENSION } from "../../../util/mime";
import { packUuid, unpackUuid } from "../../../util/pack-uuid";
import { getMessageDatetime, getMessageUniqueIdentifier } from "./msh";

type Hl7FileKeyParams = {
  messageId: string;
  cxId: string;
  patientId: string;
  timestamp: string;
  messageCode: string;
  triggerEvent: string;
};

// TODO: Ensure the HL7 coding system values are correct and up to date
const hl7CodingSystemToUrlMap: Record<string, string> = {
  SCT: SNOMED_URL, // SNOMED CT
  L: LOINC_URL, // LOINC
  I10: ICD_10_URL, // ICD-10
  "ICD-10": ICD_10_URL, // ICD-10
  ICD10: ICD_10_URL, // ICD-10
  "ICD-10-CM": ICD_10_URL, // ICD-10
  I9: ICD_9_URL, // ICD-9
  "ICD-9": ICD_9_URL, // ICD-9
};

const hl7UnknownCodingSystems: Set<string> = new Set(["HRV", "FT"]);

function decompressUuid(shortId: string) {
  return unpackUuid(new Base64Scrambler(Config.getHl7Base64ScramblerSeed()).unscramble(shortId));
}

export function compressUuid(uuid: string) {
  return new Base64Scrambler(Config.getHl7Base64ScramblerSeed()).scramble(packUuid(uuid));
}

export function unpackPidFieldOrFail(pid: string) {
  if (!pid || !pid.includes("_")) {
    throw new MetriportError("Invalid PID format: missing separator");
  }

  const [cxId, patientId] = pid.split("_").map(decompressUuid);
  if (!cxId || !patientId) {
    throw new MetriportError("Invalid PID format: could not unpack identifiers");
  }

  return { cxId, patientId };
}

export function getCxIdAndPatientIdOrFail(msg: Hl7Message): { cxId: string; patientId: string } {
  const pid = getSegmentByNameOrFail(msg, "PID");
  const idComponent = pid.getComponent(3, 1);
  return unpackPidFieldOrFail(idComponent);
}

export function getRequiredValueFromMessage(
  msg: Hl7Message,
  targetSegmentName: string,
  fieldIndex: number,
  componentIndex: number
): string {
  const segment = getSegmentByNameOrFail(msg, targetSegmentName);
  const value = getOptionalValueFromSegment(segment, fieldIndex, componentIndex);
  if (!value) {
    const patientIds = getCxIdAndPatientIdOrFail(msg);
    const datetime = getMessageDatetime(msg);
    const messageId = getMessageUniqueIdentifier(msg);
    throw new MetriportError("Missing required value", undefined, {
      ids: JSON.stringify(patientIds),
      targetSegmentName,
      fieldIndex,
      componentIndex,
      datetime,
      messageId,
    });
  }

  return value;
}

export function getOptionalValueFromMessage(
  msg: Hl7Message,
  targetSegmentName: string,
  fieldIndex: number,
  componentIndex: number
): string | undefined {
  const segment = msg.getSegment(targetSegmentName);
  if (!segment) return undefined;

  return getOptionalValueFromSegment(segment, fieldIndex, componentIndex);
}

export function getSegmentByNameOrFail(msg: Hl7Message, targetSegmentName: string): Hl7Segment {
  const segment = msg.getSegment(targetSegmentName);
  if (!segment) {
    const patientIds = getCxIdAndPatientIdOrFail(msg);
    const datetime = getMessageDatetime(msg);
    const messageId = getMessageUniqueIdentifier(msg);
    throw new MetriportError("Missing required segment", undefined, {
      ids: JSON.stringify(patientIds),
      targetSegmentName,
      datetime,
      messageId,
    });
  }
  return segment;
}

export function getOptionalValueFromSegment(
  segment: Hl7Segment,
  fieldIndex: number,
  componentIndex: number
): string | undefined {
  return segment.getComponent(fieldIndex, componentIndex).trim() || undefined;
}

export function getOptionalValueFromField(
  field: Hl7Field,
  componentIndex: number
): string | undefined {
  return field.getComponent(componentIndex).trim() || undefined;
}

/**
 * Maps an HL7 coding system name to its corresponding URL.
 * Returns undefined if the system name is not recognized.
 */
export function mapHl7SystemNameToSystemUrl(systemName: string | undefined): string | undefined {
  if (!systemName) return undefined;

  const cleanedSystemName = systemName.trim().toUpperCase();
  const systemUrl = hl7CodingSystemToUrlMap[cleanedSystemName];
  const hasUnknownCodingSystem = hl7UnknownCodingSystems.has(cleanedSystemName);

  // Don't warn on any explicitly unknown coding systems
  if (!systemUrl && !hasUnknownCodingSystem) {
    const { log } = out(`mapHl7SystemNameToSystemUrl`);
    const msg = "Failed to map HL7 system name to URL";
    log(`${msg}: ${systemName}`);
    capture.message(msg, {
      extra: {
        systemName,
      },
      level: "warning",
    });
  }

  return systemUrl;
}

export function createFileKeyHl7Message({
  cxId,
  patientId,
  messageId,
  timestamp,
  messageCode,
  triggerEvent,
}: Hl7FileKeyParams) {
  return `${cxId}/${patientId}/${timestamp}_${messageId}_${messageCode}_${triggerEvent}.${HL7_FILE_EXTENSION}`;
}

export function formatDateToHl7(date: Date): string {
  return buildDayjs(date).format("YYYYMMDDHHmmss");
}

export function createUnpackPidFailureFileKey({
  rawPtIdentifier,
  rawTimestamp,
  messageCode,
  triggerEvent,
}: {
  rawPtIdentifier: string;
  rawTimestamp: string;
  messageCode: string;
  triggerEvent: string;
}) {
  return `unpack-pid-failure/${rawPtIdentifier}_${rawTimestamp}_${messageCode}_${triggerEvent}_${nanoid()}.hl7`;
}
