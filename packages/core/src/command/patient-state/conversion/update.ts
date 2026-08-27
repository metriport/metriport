import { DynamoDbUpdateBuilder } from "../../../external/aws/dynamodb-atomic-update-builder";
import { MetriportError } from "@metriport/shared";
import {
  buildCxIdCondition,
  createDynamoDbUtils,
  createPatientStateKey,
  PARTITION_KEY,
  transformDynamoDbItemToPatientState,
} from "../shared";
import { PatientState, PatientStateKey } from "../types";
import { GetConversionParams } from "./types";

export type IncrementPatientStateConversionParams = PatientStateKey & {
  success: boolean;
  count?: number;
};

/**
 * Atomically stores the result of document conversion in PatientState.
 *
 * The return value always contains the complete PatientState with all attributes
 * (since we use ReturnValues: "ALL_NEW").
 *
 * @returns CreateConversionParams with all attributes populated
 */
export async function updatePatientStateWithConversionResponse(
  params: IncrementPatientStateConversionParams
): Promise<GetConversionParams> {
  const { patientId, network, requestId, cxId, success, count = 1 } = params;

  const ddbUtils = createDynamoDbUtils();
  const key = createPatientStateKey({ patientId, network, requestId });

  const builder = new DynamoDbUpdateBuilder<PatientState>();

  if (success) {
    builder.addIncrement("conversion.totalConverted", count);
  } else {
    builder.addIncrement("conversion.totalErrors", count);
  }

  const cxIdCondition = buildCxIdCondition(builder, cxId);
  const conditionExpression = `attribute_exists(${PARTITION_KEY}) AND attribute_exists(#conversion) AND (${cxIdCondition})`;

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

  const additionalInfo = {
    patientId,
    network,
    requestId,
    cxId,
  };

  if (!result.Attributes) {
    throw new MetriportError(
      "Failed to update conversion state - no attributes in response",
      undefined,
      additionalInfo
    );
  }
  const updatedState = transformDynamoDbItemToPatientState(
    result.Attributes as Record<string, unknown> & { PK: string; SK: string }
  );
  const updatedConversionState = updatedState.conversion;
  if (!updatedConversionState) {
    throw new MetriportError(
      `Failed to retrieve updated patient state after increment operation.`,
      undefined,
      additionalInfo
    );
  }

  return updatedConversionState;
}
