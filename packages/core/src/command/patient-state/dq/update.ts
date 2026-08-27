import { DynamoDbUpdateBuilder } from "../../../external/aws/dynamodb-atomic-update-builder";
import {
  buildCxIdCondition,
  createDynamoDbUtils,
  createPatientStateKey,
  PARTITION_KEY,
  transformDynamoDbItemToPatientState,
} from "../shared";
import { PatientState, PatientStateKey } from "../types";
import { GetDqParams } from "./types";

export type IncrementPatientStateDqParams = PatientStateKey & {
  success: boolean;
  amountOfDocumentsFound: number;
};

/**
 * Atomically stores the result of document query in DynamoDB.
 *
 * The return value always contains the complete PatientState with all attributes
 * (since we use ReturnValues: "ALL_NEW").
 *
 * @returns GetDqParams with all attributes populated
 */
export async function updatePatientStateWithDqResponse(
  params: IncrementPatientStateDqParams
): Promise<GetDqParams> {
  const { patientId, network, requestId, cxId, success, amountOfDocumentsFound } = params;

  const ddbUtils = createDynamoDbUtils();
  const key = createPatientStateKey({ patientId, network, requestId });

  const builder = new DynamoDbUpdateBuilder<PatientState>();

  if (success) {
    builder.addIncrement("dq.gatewaySuccess", 1);
    builder.addIncrement("dq.totalDocuments", amountOfDocumentsFound);
  } else {
    builder.addIncrement("dq.gatewayFailure", 1);
  }

  const cxIdCondition = buildCxIdCondition(builder, cxId);
  const conditionExpression = `attribute_exists(${PARTITION_KEY}) AND attribute_exists(#dq) AND (${cxIdCondition})`;

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
    throw new Error("Failed to update DQ state - no attributes in response");
  }
  const updatedState = transformDynamoDbItemToPatientState(
    result.Attributes as Record<string, unknown> & { PK: string; SK: string }
  );
  const updatedDqState = updatedState.dq;
  if (!updatedDqState) {
    throw new Error(`Failed to retrieve updated patient state after increment operation.`);
  }
  return updatedDqState;
}
