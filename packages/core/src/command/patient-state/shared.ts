import { MedicalDataSource } from "../../external";
import { DynamoDbUtils } from "../../external/aws/dynamodb";
import { buildTtlForXDays } from "@metriport/shared/common/date";
import { PatientState } from "./types";
import { Config } from "../../util/config";

const DEFAULT_TTL_DAYS = 30;

export type PatientStateBaseParams = {
  patientId: string;
  cxId: string;
  network: MedicalDataSource;
};

export const PARTITION_KEY = "PK";
export const SORT_KEY = "SK";
export const NETWORK_PREFIX = "NETWORK#";
export const PATIENT_PREFIX = "PATIENT#";
export const REQUEST_PREFIX = "REQUEST#";
export const CX_ID_ATTRIBUTE = "cxId";

export function createPatientStateKey({
  patientId,
  network,
  requestId,
}: {
  patientId: string;
  network: MedicalDataSource;
  requestId: string;
}): {
  PK: string;
  SK: string;
} {
  return {
    PK: `${PATIENT_PREFIX}${patientId}`,
    SK: `${NETWORK_PREFIX}${network}#${REQUEST_PREFIX}${requestId}`,
  };
}

export function createDynamoDbUtils(): DynamoDbUtils {
  return new DynamoDbUtils({
    table: Config.getPatientStateTableName(),
    partitionKey: "PK",
    rangeKey: "SK",
  });
}

export function buildDefaultTtl(): number {
  return buildTtlForXDays(DEFAULT_TTL_DAYS);
}

/**
 * Builds a DynamoDB condition expression for cxId filtering.
 * Adds the necessary attribute names and values to the builder.
 *
 * @param builder - The DynamoDB update builder to add names/values to
 * @param cxId - The customer ID to filter by
 * @returns The condition expression string: "attribute_not_exists(#cxId) OR #cxId = :cxId"
 */
export function buildCxIdCondition(
  builder: { names: Record<string, string>; values: Record<string, unknown> },
  cxId: string
): string {
  builder.names[`#${CX_ID_ATTRIBUTE}`] = CX_ID_ATTRIBUTE;
  builder.values[`:${CX_ID_ATTRIBUTE}`] = cxId;
  return `attribute_not_exists(#${CX_ID_ATTRIBUTE}) OR #${CX_ID_ATTRIBUTE} = :${CX_ID_ATTRIBUTE}`;
}

/**
 * Transforms a DynamoDB item to PatientState by extracting clean values
 * from PK/SK and removing the key attributes.
 */
export function transformDynamoDbItemToPatientState(
  item: Record<string, unknown> & { PK: string; SK: string }
): PatientState {
  const { PK, SK, ...rest } = item;

  if (!PK) {
    throw new Error("PK is required in DynamoDB item");
  }
  if (!SK) {
    throw new Error("SK is required in DynamoDB item");
  }

  const cxId = rest[CX_ID_ATTRIBUTE];
  if (!cxId || typeof cxId !== "string") {
    throw new Error(`${CX_ID_ATTRIBUTE} is required in DynamoDB item`);
  }

  const patientId = PK.startsWith(PATIENT_PREFIX) ? PK.slice(PATIENT_PREFIX.length) : PK;

  const skMatch = SK.match(/^NETWORK#([^#]+)#REQUEST#(.+)$/);
  if (!skMatch) {
    throw new Error(`Invalid SK format: ${SK}`);
  }
  const [, network, requestId] = skMatch;

  return {
    ...rest,
    patientId,
    network: network as PatientState["network"],
    requestId,
    cxId,
  } as PatientState;
}
