import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import {
  generatePatientDiscoveryReport,
  generateDocumentQueryReport,
  generateDocumentRetrievalReport,
} from "@metriport/core/external/carequality/ihe-gateway-v2/report/report";
import { capture } from "./shared/capture";
import * as Sentry from "@sentry/serverless";

// Keep this as early on the file as possible
capture.init();

const dbCredsArn = getEnvVarOrFail("DB_CREDS");
const dbReadOnlyEndpoint = getEnvVarOrFail("DB_READ_REPLICA_ENDPOINT");
const region = getEnvVarOrFail("AWS_REGION");

capture.setExtra({ lambdaName: "scheduled-report-lambda" });

export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  try {
    const dbCreds = await getSecretValueOrFail(dbCredsArn, region);
    const sequelize = initReadonlyDbPool(dbCreds, dbReadOnlyEndpoint);

    const [patientDiscoveryReport, documentQueryReport, documentRetrievalReport] =
      await Promise.all([
        generatePatientDiscoveryReport(sequelize),
        generateDocumentQueryReport(sequelize),
        generateDocumentRetrievalReport(sequelize),
      ]);

    console.log(JSON.stringify({ patientDiscoveryReport }, null, 2));
    console.log(JSON.stringify({ documentQueryReport }, null, 2));
    console.log(JSON.stringify({ documentRetrievalReport }, null, 2));
  } catch (error) {
    const msg = `Error generating report`;
    console.log(`${msg}: ${error}`);
    capture.error(msg, { extra: { error } });
  }
});
