import { buildDayjs } from "@metriport/shared/common/date";
import { DynamoDbUpdateBuilder } from "../../external/aws/dynamodb-atomic-update-builder";
import { GetConversionParams } from "./conversion/types";
import { CreateDqParams } from "./dq/types";
import { CreateDrParams } from "./dr/types";
import { getPatientState } from "./get-patient-state";
import { CreatePdParams } from "./pd/types";
import {
  buildCxIdCondition,
  buildDefaultTtl,
  createDynamoDbUtils,
  createPatientStateKey,
  CX_ID_ATTRIBUTE,
  transformDynamoDbItemToPatientState,
} from "./shared";
import {
  CreateOrUpdatePatientState,
  PatientState,
  PatientStateKey,
  StatusCondition,
} from "./types";

type ConditionBuilder = { names: Record<string, string>; values: Record<string, unknown> };

/**
 * Dynamically sets all properties from the update object as nested values.
 * Only properties present in the object are set (undefined values are skipped by setValue).
 * This ensures that partial updates only modify the specified properties, preserving others.
 */
function setNestedValues<T extends Record<string, unknown>>(
  builder: DynamoDbUpdateBuilder<PatientState>,
  prefix: string,
  obj: T
): void {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const path = `${prefix}.${key}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      builder.setValue(path as any, obj[key] as any);
    }
  }
}

/**
 * Builds a DynamoDB condition expression for status checks.
 * Adds the necessary attribute names and values to the builder.
 */
function buildStatusCondition(builder: ConditionBuilder, condition: StatusCondition): string {
  const fieldName = condition.field;
  const statusValueKey = `:${condition.value}`;
  const statusAttribute = `#${fieldName}.#status`;

  builder.names[`#${fieldName}`] = fieldName;
  builder.names["#status"] = "status";
  builder.values[statusValueKey] = condition.value;

  const operator = condition.operator === "equals" ? "=" : "<>";
  return `attribute_not_exists(${statusAttribute}) OR ${statusAttribute} ${operator} ${statusValueKey}`;
}

function buildConditionExpression(
  builder: ConditionBuilder,
  cxId: string,
  statusCondition?: StatusCondition
): string {
  const cxIdCondition = buildCxIdCondition(builder, cxId);
  const statusConditionExpression = statusCondition
    ? buildStatusCondition(builder, statusCondition)
    : undefined;
  const mergedCxIdCondition = statusConditionExpression
    ? `(${statusConditionExpression}) AND (${cxIdCondition})`
    : cxIdCondition;
  return mergedCxIdCondition;
}

/**
 * Creates or updates the patient state in the database.
 *
 * The return value always contains the complete PatientState with all attributes
 * (since we use ReturnValues: "ALL_NEW").
 *
 * @param patientId - The ID of the patient.
 * @param network - The network of the query. Expected to be: EHEX, CAREQUALITY, COMMONWELL
 * @param requestId - The request ID of the query.
 * @param cxId - The CX ID of the patient.
 * @param state - The state to create or update.
 * @param statusCondition - Optional structured condition to guard the update based on status.
 * @returns The updated patient state with all attributes populated
 */
export async function createOrUpdatePatientState({
  patientId,
  network,
  requestId,
  cxId,
  state,
  statusCondition,
}: PatientStateKey & {
  state: Partial<CreateOrUpdatePatientState>;
  statusCondition?: StatusCondition;
}): Promise<PatientState> {
  const ddbUtils = createDynamoDbUtils();
  const key = createPatientStateKey({ patientId, network, requestId });

  const builder = new DynamoDbUpdateBuilder<PatientState>();

  builder.names[`#${CX_ID_ATTRIBUTE}`] = CX_ID_ATTRIBUTE;
  builder.values[`:${CX_ID_ATTRIBUTE}`] = cxId;
  builder.setExpressions.push(`#${CX_ID_ATTRIBUTE} = :${CX_ID_ATTRIBUTE}`);

  if (state.pd) {
    if (isCreatePd(state.pd)) {
      builder.setObject("pd", state.pd);
    } else {
      setNestedValues(builder, "pd", state.pd);
    }
  }

  if (state.dq) {
    if (isCreateDq(state.dq)) {
      builder.setObject("dq", state.dq);
    } else {
      setNestedValues(builder, "dq", state.dq);
    }
  }

  if (state.dr) {
    if (isCreateDr(state.dr)) {
      builder.setObject("dr", state.dr);
    } else {
      setNestedValues(builder, "dr", state.dr);
    }
  }

  if (state.conversion) {
    if (isCreateConversion(state.conversion)) {
      builder.setObject("conversion", state.conversion);
    } else {
      setNestedValues(builder, "conversion", state.conversion);
    }
  }

  builder.setValue("ttl", buildDefaultTtl());

  // Set createdAt timestamp only when creating a new record (not updating)
  const createdAtTimestamp = buildDayjs().toISOString();
  builder.values[":createdAt"] = createdAtTimestamp;
  builder.setExpressions.push("createdAt = if_not_exists(createdAt, :createdAt)");

  if (builder.setExpressions.length === 0) {
    const existingState = await getPatientState({ patientId, network, requestId, cxId });
    if (!existingState) {
      throw new Error(
        `Cannot create or update patient state: no update expressions generated and no existing state found for patientId=${patientId}, network=${network}, requestId=${requestId}`
      );
    }
    return existingState;
  }

  const updateParams: {
    TableName: string;
    Key: Record<string, string>;
    UpdateExpression: string;
    ExpressionAttributeNames: Record<string, string>;
    ExpressionAttributeValues: Record<string, unknown>;
    ReturnValues: "ALL_NEW";
    ConditionExpression?: string;
  } = {
    TableName: ddbUtils._table,
    Key: key,
    UpdateExpression: `SET ${builder.setExpressions.join(", ")}`,
    ExpressionAttributeNames: builder.names,
    ExpressionAttributeValues: builder.values,
    ReturnValues: "ALL_NEW",
    ConditionExpression: buildConditionExpression(builder, cxId, statusCondition),
  };

  const result = await ddbUtils._docClient.update(updateParams).promise();
  if (!result.Attributes) {
    throw new Error("Failed to update patient state - no attributes in response");
  }
  return transformDynamoDbItemToPatientState(
    result.Attributes as Record<string, unknown> & { PK: string; SK: string }
  );
}

function isCreatePd(pd: CreateOrUpdatePatientState["pd"]): pd is CreatePdParams {
  if (!pd) return false;
  return (
    pd.requestId !== undefined &&
    pd.status !== undefined &&
    pd.facilityId !== undefined &&
    pd.rerunPdOnNewDemographics !== undefined &&
    pd.totalGateways !== undefined &&
    pd.gatewaySuccess !== undefined &&
    pd.gatewayFailure !== undefined &&
    (pd as CreatePdParams).startedAt !== undefined
  );
}

function isCreateDq(dq: CreateOrUpdatePatientState["dq"]): dq is CreateDqParams {
  if (!dq) return false;
  return (
    dq.requestId !== undefined &&
    dq.startedAt !== undefined &&
    dq.status !== undefined &&
    dq.facilityId !== undefined &&
    dq.totalGateways !== undefined &&
    dq.gatewaySuccess !== undefined &&
    dq.gatewayFailure !== undefined &&
    dq.totalDocuments !== undefined &&
    dq.forceDownload !== undefined
  );
}

function isCreateDr(dr: CreateOrUpdatePatientState["dr"]): dr is CreateDrParams {
  if (!dr) return false;
  return (
    dr.requestId !== undefined &&
    dr.status !== undefined &&
    dr.facilityId !== undefined &&
    dr.countSuccess !== undefined &&
    dr.countError !== undefined &&
    dr.countTotal !== undefined &&
    dr.forceDownload !== undefined &&
    (dr as CreateDrParams).startedAt !== undefined &&
    (dr as CreateDrParams).countFilteredFromRedownload !== undefined
  );
}

function isCreateConversion(
  conversion: CreateOrUpdatePatientState["conversion"]
): conversion is GetConversionParams {
  if (!conversion) return false;
  return (
    conversion.requestId !== undefined &&
    conversion.startedAt !== undefined &&
    conversion.status !== undefined &&
    conversion.totalToConvert !== undefined &&
    conversion.totalConverted !== undefined &&
    conversion.totalErrors !== undefined
  );
}
