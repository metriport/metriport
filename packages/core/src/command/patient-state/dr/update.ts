import { DynamoDbUpdateBuilder } from "../../../external/aws/dynamodb-atomic-update-builder";
import {
  buildCxIdCondition,
  createDynamoDbUtils,
  createPatientStateKey,
  PARTITION_KEY,
  transformDynamoDbItemToPatientState,
} from "../shared";
import { PatientState, PatientStateKey } from "../types";
import { CreateDrParams } from "./types";

export type IncrementPatientStateDrParams = PatientStateKey & {
  success: boolean;
  documentCount: number;
};

/**
 * Atomically stores the result of document retrieval in DynamoDB.
 *
 * The return value always contains the complete PatientState with all attributes
 * (since we use ReturnValues: "ALL_NEW").
 *
 * @returns CreateDrParams with all attributes populated
 */
export async function updatePatientStateWithDrResponse(
  params: IncrementPatientStateDrParams
): Promise<CreateDrParams> {
  const { patientId, network, requestId, cxId, success, documentCount } = params;

  if (documentCount === 0) {
    throw new Error("documentCount must be > 0 for atomic increment operations.");
  }

  const ddbUtils = createDynamoDbUtils();
  const key = createPatientStateKey({ patientId, network, requestId });

  const builder = new DynamoDbUpdateBuilder<PatientState>();

  if (success) {
    builder.addIncrement("dr.countSuccess", documentCount);
  } else {
    builder.addIncrement("dr.countError", documentCount);
  }

  const cxIdCondition = buildCxIdCondition(builder, cxId);
  const conditionExpression = `attribute_exists(${PARTITION_KEY}) AND attribute_exists(#dr) AND (${cxIdCondition})`;

  const result = await ddbUtils._docClient
    .update({
      TableName: ddbUtils._table,
      Key: key,
      UpdateExpression: `SET ${builder.setExpressions.join(", ")}`,
      ConditionExpression: conditionExpression,
      ExpressionAttributeNames: builder.names,
      ExpressionAttributeValues: builder.values,
      ReturnValues: "ALL_NEW", // This returns the state AFTER update with all attributes
    })
    .promise();

  if (!result.Attributes) {
    throw new Error("Failed to update DR state - no attributes in response");
  }
  const updatedState = transformDynamoDbItemToPatientState(
    result.Attributes as Record<string, unknown> & { PK: string; SK: string }
  );
  const updatedDrState = updatedState.dr;
  if (!updatedDrState) {
    throw new Error(`Failed to retrieve updated patient state after increment operation.`);
  }

  return updatedDrState;
}
