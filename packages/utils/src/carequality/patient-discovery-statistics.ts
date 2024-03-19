import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getXcpdStatisticsForPatient } from "@metriport/core/external/carequality/pd/get-xcpd-statistics";
import { getEnvVarOrFail } from "../../../api/src/shared/config";

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const patientId = "";
const dateString = "";

async function main() {
  const xcpdResultsString = await getXcpdStatisticsForPatient(
    apiUrl,
    sqlDBCreds,
    cxId,
    dateString,
    patientId
  );
  console.log(xcpdResultsString);
}

main();
