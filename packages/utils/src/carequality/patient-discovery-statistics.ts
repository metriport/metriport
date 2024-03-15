import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getDqStatistics } from "@metriport/core/util/statistics/carequality/get-dq-statistics";
import { getDrStatistics } from "@metriport/core/util/statistics/carequality/get-dr-statistics";
import { getXcpdStatistics } from "@metriport/core/util/statistics/carequality/get-xcpd-statistics";
import { getWhStatistics } from "@metriport/core/util/statistics/get-wh-statistics";
import { getEnvVarOrFail } from "../../../api/src/shared/config";

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS"); // !!!MAKE SURE TO USE THE READ REPLICA CREDENTIALS!!!

const patientId = "";
const dateString = "2024-03-14 09:00";

async function main() {
  const props = { sqlDBCreds, cxId, dateString };

  const xcpdResults = await getXcpdStatistics({
    apiUrl,
    ...props,
    patientId,
  });
  console.log(xcpdResults.string);

  const propsWithPatientIds = { ...props, patientIds: xcpdResults.patients };
  const dqResultsString = await getDqStatistics(propsWithPatientIds);
  console.log(dqResultsString);
  const drResultsString = await getDrStatistics(propsWithPatientIds);
  console.log(drResultsString);
  const whResultsString = await getWhStatistics(propsWithPatientIds);
  console.log(whResultsString);

  console.log("PATIENT IDS\n", xcpdResults.patients);

  // TODO: For v2, look at the FHIR server for some of these stats (thats where we get the records from for our CX anyway)
}

main();
