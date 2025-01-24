import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { Bundle, Coding } from "@medplum/fhirtypes";
import { isVitalSignsObservation } from "@metriport/core/fhir-to-cda/fhir";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents, getFileNames } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to calculate the percentage of patients that have BP/HR in the last 90 days, based on
 * their consolidated data downloaded from S3.
 *
 * The output will be printed on the console.
 *
 * To get the files from S3:
 * > cd <phi-safe-folder>
 * > aws s3 sync s3://<bucket-name-and-path> ./ --exclude "*" --include "*_CONSOLIDATED_DATA.json"
 *
 * To run it:
 * - Update `folderName`
 * - Run `ts-node src/customer-requests/resource-metrics`
 */

const folderName = "";

const maxPatientsToProcess = 0; // 0 means all patients
const numberOfParallelExecutions = 10;
const last90Days = dayjs().subtract(90, "days");
const delayTime = dayjs.duration(5, "milliseconds");

async function main() {
  await sleep(50);
  const { log } = out("");
  const startedAt = Date.now();
  log(`>>> Starting ...`);

  const fileNamesTmp = getFileNames({
    folder: folderName,
    recursive: true,
    extension: "_CONSOLIDATED_DATA.json",
  });
  log(`Found ${fileNamesTmp.length} files`);

  const fileNames =
    maxPatientsToProcess > 0 ? fileNamesTmp.slice(0, maxPatientsToProcess) : fileNamesTmp;
  log(`Processing ${fileNames.length} files...`);

  let count = 0;
  let index = 0;
  await executeAsynchronously(
    fileNames,
    async fileName => {
      const containVitals = getMetricsFromFile(fileName, log);
      if (containVitals) count++;
      log(`>>> Progress: ${++index}/${fileNames.length} files parsed`);
      await sleep(delayTime.asMilliseconds());
    },
    { numberOfParallelExecutions }
  );

  log(
    `>>> RESULTS: ${count} patients contain BP/HR in the last 90 days, from ${
      fileNames.length
    } patients, percentage: ${formatNumber((count / fileNames.length) * 100)}%`
  );

  log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  process.exit(0);
}

function getMetricsFromFile(fileName: string, log: typeof console.log): boolean {
  try {
    const fileContents = getFileContents(fileName);
    const bundle = JSON.parse(fileContents) as Bundle;

    const vitalSigns = (bundle.entry ?? []).flatMap(entry =>
      isVitalSignsObservation(entry.resource) ? [entry.resource] : []
    );
    const vitalSignsLast90Days = vitalSigns.filter(vitalSign =>
      dayjs(vitalSign.effectiveDateTime).isAfter(last90Days)
    );
    const bloodPressureVitalSigns = vitalSignsLast90Days.filter(vitalSign =>
      vitalSign.code?.coding?.some(coding => isBloodPressure(coding) || isHeartRate(coding))
    );
    return bloodPressureVitalSigns.length > 0;
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = `ERROR processing file ${fileName}: `;
    log(msg, error.message);
  }
  return false;
}

function isBloodPressure(coding: Coding): boolean {
  if (coding.system?.includes("loinc")) {
    return ["8480-6", "8462-4", "8478-0"].includes(coding.code ?? "");
  }
  if (coding.system?.includes("1.2.840.113619.21.3.2527")) {
    return ["53", "54"].includes(coding.code ?? "");
  }
  if (coding.system?.includes("terminology.hl7.org")) {
    return ["4500634~1", "4500634~2"].includes(coding.code ?? "");
  }
  return false;
}

function isHeartRate(coding: Coding): boolean {
  if (coding.system?.includes("loinc")) {
    return [
      "8867-4",
      "8869-0",
      "8870-8",
      "8872-4",
      "8873-2",
      "8874-0",
      "8875-7",
      "8876-5",
      "8877-3",
      "8878-1",
      "8879-9",
    ].includes(coding.code ?? "");
  }
  if (coding.system?.includes("1.2.840.113619.21.3.2527")) {
    return ["56", "57", "58", "59"].includes(coding.code ?? "");
  }
  if (["urn:oid:2.16.840.1.113883.6.233", "terminology.hl7.org"].includes(coding.system ?? "")) {
    return ["4500636"].includes(coding.code ?? "");
  }
  return false;
}

main();
