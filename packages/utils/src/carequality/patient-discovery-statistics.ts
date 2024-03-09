import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getXcpdStatisticsForPatient } from "@metriport/core/external/carequality/pd/get-statistics";
import { getEnvVarOrFail } from "../../../api/src/shared/config";

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const patientId = "";
const dateString = ""; // RECOMMENDED to use in production due to the large amount of data generated on a daily basis

async function main() {
  const resultsString = await getXcpdStatisticsForPatient(
    apiUrl,
    sqlDBCreds,
    cxId,
    dateString,
    patientId
  );
  console.log(resultsString);
}

main();
