import { DynamoDbUpdateBuilder } from "../../../external/aws/dynamodb-atomic-update-builder";
import {
  buildCxIdCondition,
  createDynamoDbUtils,
  createPatientStateKey,
  PARTITION_KEY,
  transformDynamoDbItemToPatientState,
} from "../shared";
import { PatientState, PatientStateKey } from "../types";
import { GetPdParams } from "./types";

export type IncrementPatientStatePdParams = PatientStateKey & {
  success: boolean;
};

/**
 * Atomically stores the result of patient discovery in DynamoDB.
 *
 * The return value always contains the complete PatientState with all attributes
 * (since we use ReturnValues: "ALL_NEW").
 *
 * @returns GetPdParams with all attributes populated
 */
export async function updatePatientStateWithPdResponse(
  params: IncrementPatientStatePdParams
): Promise<GetPdParams> {
  const { patientId, network, requestId, cxId, success } = params;

  const ddbUtils = createDynamoDbUtils();
  const key = createPatientStateKey({ patientId, network, requestId });

  const builder = new DynamoDbUpdateBuilder<PatientState>();

  if (success) {
    builder.addIncrement("pd.gatewaySuccess", 1);
  } else {
    builder.addIncrement("pd.gatewayFailure", 1);
  }

  const cxIdCondition = buildCxIdCondition(builder, cxId);
  const conditionExpression = `attribute_exists(${PARTITION_KEY}) AND attribute_exists(#pd) AND (${cxIdCondition})`;

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
    throw new Error("Failed to update PD state - no attributes in response");
  }
  const updatedState = transformDynamoDbItemToPatientState(
    result.Attributes as Record<string, unknown> & { PK: string; SK: string }
  );
  const updatedPdState = updatedState.pd;
  if (!updatedPdState) {
    throw new Error(`Failed to retrieve updated patient state after increment operation.`);
  }

  return updatedPdState;
}
