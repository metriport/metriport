import { NotFoundError } from "@metriport/shared";
import _ from "lodash";
import {
  createDynamoDbUtils,
  createPatientStateKey,
  PARTITION_KEY,
  SORT_KEY,
  transformDynamoDbItemToPatientState,
} from "./shared";
import { PatientState, PatientStateKey, Status } from "./types";

export type PatientStateWithOverallStatus = PatientState & {
  isCompleted: boolean;
};

export async function getPatientStateWithOverallStatus(
  params: Omit<PatientStateKey, "requestId"> & {
    requestId?: string;
    isConsiderConversion?: boolean;
  }
): Promise<PatientStateWithOverallStatus> {
  const { patientId, cxId, network, requestId, isConsiderConversion } = params;
  if (requestId) {
    const patientState = await getPatientStateOrFail({
      patientId,
      cxId,
      network,
      requestId,
    });
    return withOverallStatus(patientState, isConsiderConversion);
  }

  const patientState = await getMostRecentPatientStateOrFail({
    patientId,
    network,
  });

  return withOverallStatus(patientState, isConsiderConversion);
}

function withOverallStatus(
  state: PatientState,
  isConsiderConversion: boolean | undefined
): PatientStateWithOverallStatus {
  return {
    ...state,
    isCompleted: isDataPipelineCompleted(state, isConsiderConversion),
  };
}

export async function getPatientStateOrFail(params: PatientStateKey): Promise<PatientState> {
  const patientState = await getPatientState(params);
  if (!patientState) {
    throw new NotFoundError(`Patient state not found`, undefined, {
      requestId: params.requestId,
      patientId: params.patientId,
      network: params.network,
      cxId: params.cxId,
    });
  }
  return patientState;
}

export async function getPatientState({
  patientId,
  network,
  requestId,
}: PatientStateKey): Promise<PatientState | undefined> {
  const ddbUtils = createDynamoDbUtils();
  const key = createPatientStateKey({ patientId, network, requestId });
  const result = await ddbUtils.get({
    partition: key[PARTITION_KEY],
    range: key[SORT_KEY],
  });

  if (!result.Item) {
    return undefined;
  }

  return transformDynamoDbItemToPatientState(
    result.Item as Record<string, unknown> & { PK: string; SK: string }
  );
}

export async function getMostRecentPatientStateOrFail(params: {
  patientId: string;
  network: PatientState["network"];
}): Promise<PatientState> {
  const patientState = await getMostRecentPatientState(params);
  if (!patientState) {
    throw new NotFoundError(`Patient state not found`, undefined, {
      patientId: params.patientId,
      network: params.network,
    });
  }
  return patientState;
}

/**
 * Gets the most recent patient state for a certain network.
 * Queries DynamoDB for all patient states matching the patientId and network,
 * and returns the one with the most recent createdAt timestamp.
 */
export async function getMostRecentPatientState({
  patientId,
  network,
}: {
  patientId: string;
  network: PatientState["network"];
}): Promise<PatientState | undefined> {
  const ddbUtils = createDynamoDbUtils();
  const keys = createPatientStateKey({ patientId, network, requestId: "" }); //  intentionally set to empty string since we're looking for any most recent state

  const result = await ddbUtils._docClient
    .query({
      TableName: ddbUtils._table,
      KeyConditionExpression: `${PARTITION_KEY} = :pk AND begins_with(${SORT_KEY}, :skPrefix)`,
      ExpressionAttributeValues: {
        ":pk": keys.PK,
        ":skPrefix": keys.SK,
      },
    })
    .promise();

  if (!result.Items || result.Items.length === 0) {
    return undefined;
  }

  const sortedItems = _.orderBy(result.Items, ["createdAt"], ["desc"]);
  const item = sortedItems[0] as Record<string, unknown> & { PK: string; SK: string };
  return transformDynamoDbItemToPatientState(item);
}

export function isDataPipelineCompleted(state: PatientState, isConsiderConversion = true): boolean {
  const pdStatus = state.pd?.status;
  const dqStatus = state.dq?.status;
  const drStatus = state.dr?.status;
  const conversionStatus = state.conversion?.status;

  if (pdStatus && pdStatus === Status.processing) {
    return false;
  }
  if (dqStatus && dqStatus === Status.processing) {
    return false;
  }
  if (drStatus && drStatus === Status.processing) {
    return false;
  }
  if (isConsiderConversion && conversionStatus && conversionStatus === Status.processing) {
    return false;
  }
  return true;
}
