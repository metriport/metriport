import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BundleEntry, EncounterDiagnosis, Reference, Resource } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { groupBy } from "lodash";
import { ellapsedTimeAsStr } from "../shared/duration";
import { initRunsFolder } from "../shared/folder";
import { processAllergyIntolerance } from "./allergy-intolerance";
import { processCondition } from "./condition";
import { csvSeparator } from "./csv";
import { processDiagnosticReport } from "./diagnostic-report";
import { processEncounter } from "./encounter";
import { processFamilyMemberHistory } from "./family-member-history";
import {
  buildGetDirPathInside,
  getFilesToProcessFromLocal,
  getFilesToProcessFromS3,
} from "./get-files";
import { processImmunization } from "./immunization";
import { processMedication } from "./medication";
import { processMedicationAdministration } from "./medication-administration";
import { processMedicationRequest } from "./medication-requests";
import { processMedicationStatement } from "./medication-statement";
import { processObservation } from "./observation";
import { processOrganization } from "./organization";
import { processPractitioner } from "./practitioner";
import { processProcedure } from "./procedure";

dayjs.extend(duration);

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
const missingRefsFileName = "missing-refs.csv";

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

  console.log(`>>> Done in ${ellapsedTimeAsStr(startedAt)}`);
}

/**
 * Go through each resource, find other resources it references, and check if they are present in the bundle.
 */
function validateReferences(resources: Resource[], dirName: string): boolean {
  const resourceMap = new Map<string, Resource>();
  resources.forEach(r => resourceMap.set(r.id ?? "", r));

  const missingRefs: { resource: Resource; missingRefs: string[] }[] = [];
  resources.forEach(r => {
    const localMissingRefs = findMissingRefs(r, resourceMap);
    if (localMissingRefs.length) missingRefs.push({ resource: r, missingRefs: localMissingRefs });
  });

  if (missingRefs.length) {
    const outputFileName = dirName + "/" + missingRefsFileName;
    const header = ["resource", "missing-refs..."].join(csvSeparator);
    fs.writeFileSync(outputFileName, header + "\n");
    console.log(
      `>>> Found ${missingRefs.length} missing references! Check the file ${outputFileName} for details.`
    );
    const lines = missingRefs
      .map(entry => {
        const resource = `${entry.resource.resourceType}/${entry.resource.id}`;
        const missingRefs = entry.missingRefs.join(csvSeparator);
        return resource + csvSeparator + missingRefs;
      })
      .join("\n");
    fs.writeFileSync(outputFileName, lines, { flag: "a+" });
    return false;
  }
  return true;
}

function findMissingRefs(resource: Resource, resourceMap: Map<string, Resource>): string[] {
  const missingRefs: string[] = [];
  const refs = findRefs(resource);
  refs.forEach(ref => {
    if (!resourceMap.has(ref.split("/")[1] ?? "")) {
      missingRefs.push(ref);
    }
  });
  return missingRefs;
}

function findRefs<T extends Resource>(resource: T): string[] {
  if ("result" in resource && resource.result) {
    const results = resource.result;
    if (Array.isArray(results)) {
      return results.flatMap(item => item.reference ?? []);
    }
  }

  if ("diagnosis" in resource && resource.diagnosis) {
    if (resource.resourceType === "Encounter") {
      const diagnoses = resource.diagnosis as EncounterDiagnosis[];
      return diagnoses.flatMap(d => d.condition?.reference ?? []);
    }
  }

  if ("author" in resource && resource.author) {
    if (resource.resourceType === "Composition") {
      return resource.author.flatMap(a => a.reference ?? []);
    }
  }

  if ("section" in resource && resource.section) {
    return resource.section.flatMap(s => s.entry?.flatMap(e => e.reference ?? []) ?? []);
  }

  if ("location" in resource && resource.location) {
    if (Array.isArray(resource.location)) {
      if (resource.location.length < 1) return [];
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      const withRefs = (resource.location as any[]).filter(
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        (l: any) => "reference" in l
      ) as Reference<Resource>[];
      return withRefs.flatMap(l => l.reference ?? []);
    }
    if ("reference" in resource.location) {
      return [resource.location.reference ?? ""];
    }
  }

  if ("participant" in resource && resource.participant) {
    if (resource.resourceType === "Encounter") {
      return resource.participant.flatMap(p => p.individual?.reference ?? []);
    }
  }

  if ("performer" in resource && resource.performer) {
    if (Array.isArray(resource.performer)) {
      return resource.performer.flatMap(p => {
        if ("reference" in p) return p.reference ?? [];
        if ("actor" in p) return p.actor?.reference ?? [];
        return [];
      });
    }
    return [resource.performer.reference ?? []].flat();
  }

  if ("payor" in resource && resource.payor) {
    return resource.payor.flatMap(p => p.reference ?? []);
  }

  return [];
}

main();
