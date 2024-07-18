import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../util/error/shared";
import { getEnvVarOrFail } from "../../../../../util/env-var";
import { uuidv7 } from "../../../../../util/uuid-v7";
import { RDSDataClient, ExecuteStatementCommand, TypeHint } from "@aws-sdk/client-rds-data";

export async function createOutboundPatientDiscoveryResp({
  response,
}: {
  response: OutboundPatientDiscoveryResp;
}): Promise<void> {
  const resourceArn = getEnvVarOrFail("DB_RESOURCE_ARN");
  const secretArn = getEnvVarOrFail("DB_SECRET_ARN");
  const region = getEnvVarOrFail("AWS_REGION");
  const rdsDataClient = new RDSDataClient({ region });

  const sql = `
      INSERT INTO patient_discovery_result (id, request_id, patient_id, status, data, created_at)
      VALUES (:id, :requestId, :patientId, :status, :data, :createdAt)
    `;

  const parameters = [
    { name: "id", value: { stringValue: uuidv7() }, typeHint: TypeHint.UUID },
    { name: "requestId", value: { stringValue: response.id }, typeHint: TypeHint.UUID },
    {
      name: "patientId",
      value: { stringValue: response.patientId ?? "" },
      typeHint: TypeHint.UUID,
    },
    { name: "status", value: { stringValue: getPDResultStatus(response.patientMatch) } },
    { name: "data", value: { stringValue: JSON.stringify(response) }, typeHint: TypeHint.JSON },
    {
      name: "createdAt",
      value: { stringValue: new Date().toISOString() },
    },
  ];

  try {
    const command = new ExecuteStatementCommand({
      secretArn,
      resourceArn,
      sql,
      parameters,
      database: "metriport_api",
    });

    await rdsDataClient.send(command);
  } catch (error) {
    console.error(`Failed to insert record - ${errorToString(error)}`);
    console.log(JSON.stringify(response, null, 2));
    throw error;
  }
}

function getPDResultStatus(patientMatch: boolean | null): string {
  if (patientMatch === true) {
    return "success";
  } else if (patientMatch === false) {
    return "failure";
  } else {
    return "error";
  }
}
