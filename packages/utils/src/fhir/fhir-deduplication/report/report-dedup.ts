import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/shared";
import { out } from "@metriport/core/util/log";
import fs from "fs";
import { groupBy } from "lodash";
import { elapsedTimeAsStr } from "../../shared/duration";
import { initRunsFolder } from "../../shared/folder";
import { processAllergyIntolerance } from "./allergy-intolerance";
import { processCondition } from "./condition";
import { processCoverage } from "./coverage";
import { processDiagnosticReport } from "./diagnostic-report";
import { processEncounter } from "./encounter";
import { processFamilyMemberHistory } from "./family-member-history";
import {
  buildGetDirPathInside,
  getFilesToProcessFromLocal,
  getFilesToProcessFromS3,
} from "./get-files";
import { processImmunization } from "./immunization";
import { processLocation } from "./location";
import { processMedication } from "./medication";
import { processMedicationAdministration } from "./medication-administration";
import { processMedicationRequest } from "./medication-requests";
import { processMedicationStatement } from "./medication-statement";
import { processObservation } from "./observation";
import { processOrganization } from "./organization";
import { processPractitioner } from "./practitioner";
import { processProcedure } from "./procedure";
import { processRelatedPerson } from "./related-person";
import { validateReferences } from "./validate-references";

/**
 * Utility to report differences between two FHIR bundles.
 * Commonly used to compare the original bundle with the deduplicated one.
 *
 * You can choose to provide the bundles in two ways:
 * - `patientIds`: list of patient IDs to fetch the bundles from S3
 * - `localConsolidated`: local path to the consolidated bundles
 *
 * If both are provided, the patientIds/S3 will be used.
 *
 * The results are stored on the `runs/dedup-reports` folder.
 *
 * Run with:
 * > ts-node src/fhir-dedup/report-dedup.ts
 */

/**
 * List of patients to get the bundles from S3.
 */
const patientIds: string[] = [];
/**
 * Path to the local consolidated bundles.
 */
const localConsolidated = "";

const cxId = getEnvVarOrFail("CX_ID");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const startedAt = Date.now();
const dirName = buildGetDirPathInside(`dedup-reports`, startedAt);

async function main() {
  initRunsFolder();

  const dedupPairs =
    patientIds && patientIds.length
      ? await getFilesToProcessFromS3({ dirName, cxId, patientIds, bucketName, region })
      : await getFilesToProcessFromLocal(dirName, localConsolidated);
  if (!dedupPairs || !dedupPairs.length) return;

  console.log(`\nGenerating reports...\n`);
  const patientsWithMissingRefs: string[] = [];
  for (const pair of dedupPairs) {
    const { log } = out(`patient ${pair.patientId}`);
    log(`Found files:\n... O ${pair.original.localFileName}\n... D ${pair.dedup.localFileName}`);
    const patientDirName = dirName + "/" + pair.patientId;
    fs.mkdirSync(`./${patientDirName}`, { recursive: true });

    const originalFile = fs.readFileSync(pair.original.localFileName, "utf8");
    const dedupFile = fs.readFileSync(pair.dedup.localFileName, "utf8");

    const originalResources: Resource[] =
      JSON.parse(originalFile).entry?.map((entry: BundleEntry) => entry.resource) ?? [];
    const dedupResources: Resource[] =
      JSON.parse(dedupFile).entry?.map((entry: BundleEntry) => entry.resource) ?? [];

    const groupedOriginal = groupBy(originalResources, "resourceType");
    const groupedDedup = groupBy(dedupResources, "resourceType");

    log(`Processing Medication...`);
    await processMedication(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing MedicationStatement...`);
    await processMedicationStatement(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing MedicationRequest...`);
    await processMedicationRequest(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing MedicationAdministration...`);
    await processMedicationAdministration(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Condition...`);
    await processCondition(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Observation...`);
    await processObservation(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing DiagnosticReport...`);
    await processDiagnosticReport(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Encounter...`);
    await processEncounter(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing AllergyIntolerance...`);
    await processAllergyIntolerance(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Immunization...`);
    await processImmunization(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Procedure...`);
    await processProcedure(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing FamilyMemberHistory...`);
    await processFamilyMemberHistory(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Organization...`);
    await processOrganization(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Practitioner...`);
    await processPractitioner(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Coverage...`);
    await processCoverage(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing Location...`);
    await processLocation(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing RelatedPerson...`);
    await processRelatedPerson(groupedOriginal, groupedDedup, patientDirName);

    log(`Validating references on deduped bundle...`);
    if (!validateReferences(dedupResources, patientDirName)) {
      patientsWithMissingRefs.push(pair.patientId);
    }
  }

  console.log(``);
  if (patientsWithMissingRefs.length > 0) {
    console.log(`Patients with missing references:\n- ${patientsWithMissingRefs.join("\n- ")}`);
  } else {
    console.log(`No patients with missing references, yay!`);
  }
  console.log(``);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
