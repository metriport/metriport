import { Hl7Context, Hl7Field, Hl7Message, Hl7Segment } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { Base64Scrambler } from "../../../util/base64-scrambler";
import { Config } from "../../../util/config";
import {
  CPT_URL,
  CVX_URL,
  HL7_ACT_URL,
  ICD_10_URL,
  ICD_9_URL,
  LOINC_URL,
  NDC_URL,
  RXNORM_URL,
  SNOMED_URL,
} from "../../../util/constants";
import { packUuid, unpackUuid } from "../../../util/pack-uuid";
import { getPotentialIdentifiers } from "./adt/utils";

const crypto = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());

// TODO: Ensure the HL7 coding system values are correct and up to date
const hl7CodingSystemToUrlMap: Record<string, string> = {
  SCT: SNOMED_URL, // SNOMED CT
  LN: LOINC_URL, // LOINC
  ICD10: ICD_10_URL, // ICD-10
  ICD9: ICD_9_URL, // ICD-9
  RXNORM: RXNORM_URL, // RxNorm
  NDC: NDC_URL, // National Drug Code
  CVX: CVX_URL, // CVX Vaccine Codes
  CPT: CPT_URL, // Current Procedural Terminology
  HL7: HL7_ACT_URL, // HL7 Act Code
};

export function parseHl7v2Message(msgSegments: Hl7Segment[], context?: Hl7Context) {
  return new Hl7Message(msgSegments, context);
}

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
    const ids = getPotentialIdentifiers(msg);
    throw new MetriportError("Missing required value", undefined, {
      msg: JSON.stringify(ids),
      targetSegmentName,
      fieldIndex,
      componentIndex,
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
    const ids = getPotentialIdentifiers(msg);
    throw new MetriportError("Missing required segment", undefined, {
      msg: JSON.stringify(ids),
      targetSegmentName,
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
  return hl7CodingSystemToUrlMap[systemName.trim().toUpperCase()];
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
