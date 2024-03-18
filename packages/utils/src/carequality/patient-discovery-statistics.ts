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

const patientIds = [""];
const dateString = "";

type StatisticsProps = {
  sqlDBCreds: string;
  cxId: string;
  dateString: string;
  patientIds?: string[];
};

async function main() {
  const props: StatisticsProps = { sqlDBCreds, cxId, dateString, patientIds };
  if (patientIds[0].length === 0) delete props.patientIds;

  const xcpdResults = await getXcpdStatistics({
    apiUrl,
    ...props,
  });
  console.log(xcpdResults.string);

  const propsWithPatientIds = { ...props, patientIds: xcpdResults.patients };
  const dqResultsString = await getDqStatistics(propsWithPatientIds);
  console.log(dqResultsString);
  const drResultsString = await getDrStatistics(propsWithPatientIds);
  console.log(drResultsString);
  const whResultsString = await getWhStatistics(propsWithPatientIds);
  console.log(whResultsString);

  // TODO: For v2, look at the FHIR server for some of these stats (thats where we get the records from for our CX anyway)
}

main();
