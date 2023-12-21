import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import {
  APIMode,
  CommonWell,
  Document,
  OperationOutcome,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { PurposeOfUse } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as fs from "fs";
import * as mime from "mime-types";
import { getCxData } from "../shared/get-cx-data";

/**
 * Utility to run a coverage check for a subset of a customer's patients.
 *
 * This will:
 *    - create a new folder in the root dir for the current assessment
 *    - run a coverage check for each patient in the patientIds array, saving corresponding CW responses to the patient's folder
 *    - also, will optionally download documents if downloadDocs is `true`
 *    - finally, spit out a csv containing the coverage report with a row for each patient
 *
 * Update the respective env variables and run `npm run coverage-assessment > output.txt`
 */

const pathToCerts = getEnvVarOrFail("ORG_CERTS_FOLDER");
const cert = fs.readFileSync(`${pathToCerts}/cert1.pem`, "utf8");
const privkey = fs.readFileSync(`${pathToCerts}/privkey1.pem`, "utf8");

const cxId = getEnvVarOrFail("CX_ID");

/**
 * Only need to provide the facilityId if the CX has more than one facility.
 * Used to determine the NPI used to query CW.
 */
const facilityId: string = ""; // eslint-disable-line @typescript-eslint/no-inferrable-types

/**
 * List of patients to check coverage for.
 */
const patientIds: string[] = [];

const cwApiMode = APIMode.production;
const downloadDocs = false;
const csvHeader =
  "patientId,state,zip,firstName,lastName,dob,gender,personCreatedByOrg,numLinks,linksLOLA2+,docQueryMs,docQueryResults,docQueryErrs,fileTypes,docRetrieves,docRetrieveErrs\n";
const curDateTime = new Date();
const runName = (orgName: string) =>
  `${orgName.replaceAll(" ", "-")}_Assessment_${curDateTime.toISOString()}`;
const baseDir = (orgName: string) => `./runs/${runName(orgName)}`;
const dedupMap: { [index: string]: string } = {};

// This will do the assessment with "patientChunkSize" patients at a time, sleeping
// for "intraChunkSleepMs" ms inbetween chunks - this is an attempt to improve on the
// amount of 'Too many requests received for the patient - XDSRegistryError" errors
// that are present, but it's still not clear whether this is effective, so play around with
// these params as you see fit.
const patientChunkSize = 5;
const intraChunkSleepMs = 3000;

function buildCWPatientId(orgOID: string, patientId: string): string {
  return `${patientId}%5E%5E%5Eurn%3aoid%3a${orgOID}`;
}

function sanitizeName(name?: string[]): string {
  return name ? name.map(str => str.replaceAll(",", " ")).join(" ") : "";
}

async function assessCoverageForPatient(
  orgName: string,
  orgOID: string,
  patientId: string,
  queryMeta: RequestMetadata,
  cwApi: CommonWell,
  resultsCsvFileName: string
) {
  const patientDirName = `${baseDir(orgName)}/${patientId}`;
  const docDirName = `${patientDirName}/docs`;

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  function printAndSaveResponse(payload: any, fileName: string) {
    log(`>>> Response:`);
    log(JSON.stringify(payload, null, 2));
    fs.writeFileSync(`${patientDirName}/${fileName}`, JSON.stringify(payload));
  }

  const cwPatientId = buildCWPatientId(orgOID, patientId);
  let docQueryErrCnt = 0;
  let docQueryCnt = 0;
  let docRetrieveErrCnt = 0;
  let docRetrieveCnt = 0;
  let numLinks = 0;
  let cnt = 0;
  let personCreatedByOrg = false;
  let allLinksLOLA2 = true;
  let docQueryResponseTimeMs = 0;

  log(`>>> Checking coverage for patient ${patientId}...`);
  fs.mkdirSync(patientDirName);

  log(`>>> Getting patient demographics...`);
  const patient = await cwApi.getPatient(queryMeta, cwPatientId);
  printAndSaveResponse(patient, "patient.json");
  const patientAddress = patient.details.address[0];
  const patientName = patient.details.name[0];
  const firstName = sanitizeName(patientName.given);
  const lastName = sanitizeName(patientName.family);
  const uniquePatientStr = `${patientAddress.state},${patientAddress.zip},${firstName},${lastName},${patient.details.birthDate},${patient.details.gender.code}`;
  const existingPatientId = dedupMap[uniquePatientStr];
  if (existingPatientId) {
    error(
      `>>> Patient ${existingPatientId} and ${patientId} are duplicates... remove one from the DB`
    );
    return;
  } else {
    dedupMap[uniquePatientStr] = patientId;
  }
  const mimeTypeCnt: { [index: string]: number } = {};

  log(`>>> Checking if the underlying CW person is new and was created by ${orgName}...`);
  const personResp = await cwApi.searchPersonByPatientDemo(queryMeta, cwPatientId);
  printAndSaveResponse(personResp, "person.json");
  if (personResp._embedded.person[0].enrollmentSummary?.enroller === orgName) {
    personCreatedByOrg = true;
    warn(
      `>>> Person was created by ${orgName} - meaning this person did not exist in CW prior to this customer onboarding`
    );
  } else {
    log(`>>> Person already existed in CW`);
  }

  log(`>>> Checking links...`);
  const links = await cwApi.getNetworkLinks(queryMeta, cwPatientId);
  numLinks = links._embedded.networkLink?.length ?? 0;
  printAndSaveResponse(links, "networkLinks.json");

  if (numLinks < 1) {
    warn(`>>> No network links found for patient, nothing to query...`);
  } else {
    for (const link of links._embedded.networkLink ?? []) {
      if (parseInt(link?.assuranceLevel || "0") < 2) {
        allLinksLOLA2 = false;
        error(`>>> Patient has links less than LOLA 2... this should never happen`);
        break;
      }
    }
    log(`>>> Running DQ...`);
    const curTime = new Date();
    const docs = await cwApi.queryDocumentsFull(queryMeta, cwPatientId);
    const afterDQTime = new Date();
    docQueryResponseTimeMs = afterDQTime.getTime() - curTime.getTime();
    printAndSaveResponse(docs, "docQuery.json");
    log(`>>> DQ returned ${docs.entry?.length} results.`);

    if (docs.entry && docs.entry.length >= 1) {
      fs.mkdirSync(docDirName);
      for (const item of docs.entry) {
        cnt++;
        if (item.content?.resourceType === "DocumentReference") {
          const doc = item as Document;
          if (doc.content?.location) {
            if (doc.content.size === 0) {
              warn(`>>> DQ returned 0 length document, might cause a DR 404"`);
            }
            docQueryCnt++;

            let extension = "xml";
            if (doc.content.mimeType) {
              let curCnt = mimeTypeCnt[doc.content.mimeType] ?? 0;
              mimeTypeCnt[doc.content.mimeType] = ++curCnt;
              const imputedExtension = mime.extension(doc.content.mimeType);
              extension = imputedExtension ? imputedExtension : extension;
            }

            if (downloadDocs) {
              const fileName = `${docDirName}/${cnt}.${extension}`;
              const outputStream = fs.createWriteStream(fileName, { encoding: undefined });
              log(`>>> Downloading from ${doc.content.location}`);
              try {
                await cwApi.retrieveDocument(queryMeta, doc.content.location, outputStream);
                log(`>>> File saved to "${fileName}"`);
                docRetrieveCnt++;
              } catch (err) {
                error(`>>> DQ failed with error: ${err}"`);
                docRetrieveErrCnt++;
              }
            } else {
              log(`>>> Skipping doc download...`);
            }
          }
        } else if (item.content?.resourceType === "OperationOutcome") {
          const result = item as OperationOutcome;
          console.log(`>>> DQ contained error: ${JSON.stringify(result.content?.issue, null, 2)}"`);
          docQueryErrCnt++;
        }
      }
    }
  }

  log(`>>> Results for patient ${patientId}:
Total number of results returned: ${cnt}
Doc refs: ${docQueryCnt}
Doc refs with issues: ${docQueryErrCnt}
Docs successfully downloaded: ${downloadDocs ? docRetrieveCnt : "skipped"}
Docs downloaded but errored: ${downloadDocs ? docRetrieveErrCnt : "skipped"}
  `);

  // write line to results csv
  fs.appendFileSync(
    resultsCsvFileName,
    `${patientId},${uniquePatientStr},${personCreatedByOrg},${numLinks},${allLinksLOLA2},${docQueryResponseTimeMs},${docQueryCnt},${docQueryErrCnt},${JSON.stringify(
      mimeTypeCnt
    ).replaceAll(",", " ")},${docRetrieveCnt},${docRetrieveErrCnt}\n`
  );
}

async function main() {
  const { npi, orgName, orgOID } = await getCxData(cxId, facilityId.trim());

  const cwApi = new CommonWell(cert, privkey, orgName, "urn:oid:" + orgOID, cwApiMode);
  const base = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${orgName} System User`,
  };
  const queryMeta = {
    subjectId: base.subjectId,
    role: base.role,
    purposeOfUse: base.purposeOfUse,
    npi: npi,
  };
  const dirName = baseDir(orgName);
  fs.mkdirSync(dirName);

  // create results csv
  const resultsCsvFileName = `${dirName}/${runName(orgName)}.csv`;
  fs.writeFileSync(resultsCsvFileName, csvHeader);

  // TODO review this logic, input 9 and got 8 results on the CSV - https://metriport.slack.com/archives/C04GEQ1GH9D/p1698700612408739?thread_ts=1698699585.390059&cid=C04GEQ1GH9D
  // >> it might be a concurrency issue when trying to update the same file
  // >> could return the results to the main Promise and write them synchronously
  // TODO OSS has a function to run stuff in parallel/chunks
  log(`>>> Checking coverage for total ${patientIds.length} patients...`);
  for (let i = 0; i < patientIds.length; i += patientChunkSize) {
    const chunk = patientIds.slice(i, i + patientChunkSize);
    log(`>>> Now checking coverage for chunk of ${chunk.length} patients...`);
    const coverageAssessments: Promise<void>[] = [];
    for (const patientId of chunk) {
      coverageAssessments.push(
        assessCoverageForPatient(
          orgName,
          orgOID,
          patientId,
          queryMeta,
          cwApi,
          resultsCsvFileName
        ).catch(error => {
          error(`>>> Error assessing coverage for patient ${patientId}: ${error}`);
        })
      );
    }
    await Promise.allSettled(coverageAssessments);

    log(`>>> Now sleeping for ${intraChunkSleepMs} ms to avoid rate limiting...`);
    await new Promise(f => setTimeout(f, intraChunkSleepMs));
  }
}

function log(...args: unknown[]) {
  console.log(...args);
}
function warn(...args: unknown[]) {
  console.log("WARN ", ...args);
}
function error(...args: unknown[]) {
  console.log("ERROR ", ...args);
}

main();
