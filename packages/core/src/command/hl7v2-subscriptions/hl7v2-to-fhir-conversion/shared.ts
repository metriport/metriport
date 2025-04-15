import { Hl7Field, Hl7Message, Hl7Segment } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { capture, out } from "../../../util";
import { Base64Scrambler } from "../../../util/base64-scrambler";
import { Config } from "../../../util/config";
import { ICD_10_URL, ICD_9_URL, LOINC_URL, SNOMED_URL } from "../../../util/constants";
import { packUuid, unpackUuid } from "../../../util/pack-uuid";
import { getPatientIdsOrFail } from "./adt/utils";
import { getMessageDatetime } from "./msh";

const crypto = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());

// TODO: Ensure the HL7 coding system values are correct and up to date
const hl7CodingSystemToUrlMap: Record<string, string> = {
  SCT: SNOMED_URL, // SNOMED CT
  L: LOINC_URL, // LOINC
  I10: ICD_10_URL, // ICD-10
  "ICD-10": ICD_10_URL, // ICD-10
  I9: ICD_9_URL, // ICD-9
  "ICD-9": ICD_9_URL, // ICD-9
};

function decompressUuid(shortId: string) {
  return unpackUuid(crypto.unscramble(shortId));
}

export function compressUuid(uuid: string) {
  return crypto.scramble(packUuid(uuid));
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

export function getRequiredValueFromMessage(
  msg: Hl7Message,
  targetSegmentName: string,
  fieldIndex: number,
  componentIndex: number
): string {
  const segment = getSegmentByNameOrFail(msg, targetSegmentName);
  const value = getOptionalValueFromSegment(segment, fieldIndex, componentIndex);
  if (!value) {
    // TODO 2883: Need a more universal way to get the message identifiers that aren't exclusive to ADTs
    const patientIds = getPatientIdsOrFail(msg);
    const datetime = getMessageDatetime(msg);
    throw new MetriportError("Missing required value", undefined, {
      ids: JSON.stringify(patientIds),
      targetSegmentName,
      fieldIndex,
      componentIndex,
      datetime,
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
    // TODO 2883: Need a more universal way to get the message identifiers that aren't exclusive to ADTs
    const patientIds = getPatientIdsOrFail(msg);
    const datetime = getMessageDatetime(msg);
    throw new MetriportError("Missing required segment", undefined, {
      ids: JSON.stringify(patientIds),
      targetSegmentName,
      datetime,
    });
  }
  return segment;
}

export function getOptionalValueFromSegment(
  segment: Hl7Segment,
  fieldIndex: number,
  componentIndex: number
): string | undefined {
  try {
    const component = segment.getComponent(fieldIndex, componentIndex).trim();
    return component.length > 0 ? component : undefined;
  } catch (error) {
    return undefined;
  }
}

export function getOptionalValueFromField(
  field: Hl7Field,
  componentIndex: number
): string | undefined {
  try {
    const component = field.getComponent(componentIndex).trim();
    return component.length > 0 ? component : undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Maps an HL7 coding system name to its corresponding URL.
 * Returns undefined if the system name is not recognized.
 */
export function mapHl7SystemNameToSystemUrl(systemName: string | undefined): string | undefined {
  if (!systemName) return undefined;

  const systemUrl = hl7CodingSystemToUrlMap[systemName.trim().toUpperCase()];
  if (!systemUrl) {
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

export function buildHl7MessageFileKey({
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
}) {
  return `${cxId}/${patientId}/${timestamp}_${messageType}_${messageCode}.hl7`;
}
