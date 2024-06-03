import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on tops

import fs from "fs";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import {
  generatePatientDiscoveryReport,
  generateDocumentQueryReport,
  generateDocumentRetrievalReport,
} from "@metriport/core/external/carequality/ihe-gateway-v2/report/report";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";

async function main() {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const readReplicaEndpoint = getEnvVarOrFail("DB_READ_REPLICA_ENDPOINT");
  const sequelize = initReadonlyDbPool(sqlDBCreds, readReplicaEndpoint);

  try {
    const [patientDiscoveryReport, documentQueryReport, documentRetrievalReport] =
      await Promise.all([
        generatePatientDiscoveryReport(sequelize),
        generateDocumentQueryReport(sequelize),
        generateDocumentRetrievalReport(sequelize),
      ]);

    fs.writeFileSync(
      "./runs/carequality-report/patient-discovery-report.json",
      JSON.stringify(patientDiscoveryReport, null, 2)
    );
    fs.writeFileSync(
      "./runs/carequality-report/document-query-report.json",
      JSON.stringify(documentQueryReport, null, 2)
    );
    fs.writeFileSync(
      "./runs/carequality-report/document-retrieval-report.json",
      JSON.stringify(documentRetrievalReport, null, 2)
    );
  } catch (error) {
    console.error("Error generating report:", error);
  } finally {
    await sequelize.close();
  }
}
main();
