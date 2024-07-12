import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as Sentry from "@sentry/serverless";
import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";

const resourceArn = getEnvVarOrFail("DB_RESOURCE_ARN");
const secretArn = getEnvVarOrFail("DB_SECRET_ARN");
const region = getEnvVarOrFail("AWS_REGION");

const rdsDataClient = new RDSDataClient({ region });

export const handler = Sentry.AWSLambda.wrapHandler(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (event: any) => {
    console.log(`Running with event: ${JSON.stringify(event)}`);
    try {
      const command = new ExecuteStatementCommand({
        secretArn,
        resourceArn,
        sql: "SELECT * FROM document_query_lambda LIMIT 10",
        includeResultMetadata: true,
      });

      const response = await rdsDataClient.send(command);
      console.log("Query result:", response.records);
    } catch (error) {
      const msg = `Error reading from database`;
      console.log(`${msg}: ${error}`);
    }
  }
);
