import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getDqStatistics } from "@metriport/core/util/statistics/carequality/get-dq-statistics";
import { getDrStatistics } from "@metriport/core/util/statistics/carequality/get-dr-statistics";
import { getXcpdStatistics } from "@metriport/core/util/statistics/carequality/get-xcpd-statistics";
import { getWhStatistics } from "@metriport/core/util/statistics/get-wh-statistics";
import { getEnvVarOrFail } from "../../../api/src/shared/config";
import * as fs from "fs";

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const cxName = getEnvVarOrFail("CX_NAME");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS"); // !!!MAKE SURE TO USE THE READ REPLICA CREDENTIALS!!!

const patientIds = [""];
const dateString = "";

const meta = "cxId,date";
const xcpdCsvHeader =
  "pdRows,pdSuccesses,uniquePatients,patientsWithLinks,pdCoverage,avgLinks,patientResources,patientsParsed,mpiMatches";
const dqCsvHeader =
  "dqRows,dqSuccesses,dqSuccessRate,patientsWithDocs,dqCoverage,avgDocsPerPatient,totalDocsFound";
const drCsvHeader =
  "drRows,drSuccesses,drSuccessRate,patientsWithDocs,drCoverage,avgDocsPerPatient,totalDocsDownloaded";
const whCsvHeader =
  "whRows,whSuccesses,download.numDownloads,download.numWebhooks,download.success,conversion.numWebhooks,conversion.success,mrSummaries.numWebhooks,mrSummaries.success";
const csvHeader = `${meta},${xcpdCsvHeader},${dqCsvHeader},${drCsvHeader},${whCsvHeader}\n`;
const curDateTime = new Date();
const runName = (orgName: string) =>
  `${orgName.replaceAll(" ", "-")}_FlowStatistics_${curDateTime.toISOString()}`;

// fs.mkdirSync(`./runs/flow_stats`);
const baseDir = (orgName: string) => `./runs/flow_stats/${runName(orgName)}`;

const dirName = baseDir(cxName);
fs.mkdirSync(dirName);
const resultsCsvFileName = `${dirName}/${runName(cxName)}.csv`;

// create results csv
function createCsvFile() {
  fs.writeFileSync(resultsCsvFileName, csvHeader);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printAndSaveResponse(payload: any) {
  log(`>>> Response:`);
  log(JSON.stringify(payload, null, 2));
  const meta = `${cxId},${dateString}`;
  const xcpdStats = `${payload.numRows},${payload.numSuccesses},${payload.uniquePatients},${payload.patientsWithLinks},${payload.coverageRate},${payload.avgLinksPerPatient},${payload.patientResources},${payload.parsedPatients},${payload.mpiMatches}`;
  const dqStats = `${payload.numDqRows},${payload.numDqSuccesses},${payload.dqSuccessRate},${payload.patientsWithDocs},${payload.dqCoverage},${payload.avgDocsPerPatient},${payload.totalDocsFound}`;
  const drStats = `${payload.numDrRows},${payload.numDrSuccesses},${payload.drSuccessRate},${payload.patientsWithDocs},${payload.drCoverage},${payload.avgDocsPerPatient},${payload.totalDocsFound}`;
  const whStats = `${payload.numRows},${payload.numSuccesses},${payload.downloads.numDownloads},${payload.downloads.numWebhooks},${payload.downloads.sentSuccessfully},${payload.conversions.numWebhooks},${payload.conversions.sentSuccessfully},${payload.mrSummaries.numWebhooks},${payload.mrSummaries.sentSuccessfully}`;

  const csvLine = `${meta},${xcpdStats},${dqStats},${drStats},${whStats}\n`;

  fs.appendFileSync(`${resultsCsvFileName}`, csvLine);
}

function log(...args: unknown[]) {
  console.log(...args);
}
type StatisticsProps = {
  sqlDBCreds: string;
  cxId: string;
  dateString: string;
  patientIds?: string[];
};

async function main() {
  const props: StatisticsProps = { sqlDBCreds, cxId, dateString, patientIds };
  if (patientIds[0].length === 0) delete props.patientIds;

  createCsvFile();
  const xcpdResults = await getXcpdStatistics({
    apiUrl,
    ...props,
  });
  console.log(xcpdResults.stats);

  const propsWithPatientIds = { ...props, patientIds: xcpdResults.patients };
  const dqResults = await getDqStatistics(propsWithPatientIds);
  const drResults = await getDrStatistics(propsWithPatientIds);
  const whResults = await getWhStatistics(propsWithPatientIds);
  console.log(whResults);

  printAndSaveResponse({ ...xcpdResults.stats, ...dqResults, ...drResults, ...whResults });
  // TODO: For v2, look at the FHIR server for some of these stats (thats where we get the records from for our CX anyway)
}

main();
