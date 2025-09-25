import { Hl7Field, Hl7Message, Hl7Segment } from "@medplum/core";
import { nanoid } from "nanoid";
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

// Turn + into - , and = into .
export function toBambooId(id: string) {
  return id.replace(/\+/g, "-").replace(/=/g, ".");
}

// Reverse: - back to + , . back to =
export function fromBambooId(id: string) {
  return id.replace(/-/g, "+").replace(/\./g, "=");
}

const PATIENT_ID_FIELD_INDEX = 3;
export function remapMessageReplacingPid3(
  message: Hl7Message,
  newId: string,
  oldIdIndex?: number
): Hl7Message {
  const pid = getSegmentByNameOrFail(message, "PID");
  console.log("pid", pid.toString());
  const updatedPid = setPid3Id(getSegmentByNameOrFail(message, "PID"), newId, oldIdIndex);
  console.log("updatedPid", updatedPid.toString());
  const newSegments = message.segments.map(seg => (seg.name === "PID" ? updatedPid : seg));

  return new Hl7Message(newSegments, message.context);
}

/**
 * Sets PID-3 (Patient Identifier List) to `newId`. If `oldIdIndex` is provided, the old patient id will be moved to the given index.
 */
function setPid3Id(pid: Hl7Segment, newId: string, oldIdIndex?: number): Hl7Segment {
  const newPatientIdField = new Hl7Field([[newId]], pid.context);

  const newFields = [...pid.fields];
  if (oldIdIndex) {
    if (oldIdIndex >= newFields.length || oldIdIndex < 0) {
      throw new MetriportError("oldIdIndex out of bounds", undefined, {
        oldIdIndex,
        fieldsLength: newFields.length,
      });
    }
    const oldPatientId = newFields[PATIENT_ID_FIELD_INDEX];
    if (!oldPatientId) {
      throw new MetriportError(
        "Old patient id not found, when trying to replace it with a new one",
        undefined,
        { oldPatientId, oldIdIndex }
      );
    }
    newFields[oldIdIndex] = oldPatientId;
  }
  newFields[PATIENT_ID_FIELD_INDEX] = newPatientIdField;

  return new Hl7Segment(newFields, pid.context);
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
    const datetime = getMessageDatetime(msg);
    const messageId = getMessageUniqueIdentifier(msg);
    throw new MetriportError("Missing required value", undefined, {
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

export function createIncomingMessageFileKey({
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

export function createUnparseableHl7MessageFileKey({
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
  return `parse-failure/${rawTimestamp}_${rawPtIdentifier}_${messageCode}_${triggerEvent}_${nanoid()}.hl7`;
}

export function createUnparseableHl7MessageErrorMessageFileKey({
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
  return `parse-failure/${rawTimestamp}_${rawPtIdentifier}_${messageCode}_${triggerEvent}_${nanoid()}_error.txt`;
}

export function createUnparseableHl7MessagePhiFileKey({
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
  return `phi/${rawTimestamp}_${rawPtIdentifier}_${messageCode}_${triggerEvent}_${nanoid()}_phi.txt`;
}
