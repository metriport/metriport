/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/core/util/sleep";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import _ from "lodash";
import { initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * This script processes S3 files containing FHIR bundles, extracts encounter data,
 * and outputs JSON payloads for TCM encounter creation.
 *
 * Usage:
 * - Set the LOOKBACK_WINDOW environment variable (default: 7d)
 * - Set the CX_ID environment variable
 * - Run with: npm run backfill-tcm-encounter
 */

// Configuration
const CX_ID = getEnvVarOrFail("CX_ID");
const BUCKET_NAME = "metriport-hl7-conversion-production";
const S3_PREFIX = `cxId=${CX_ID}/`;
const AWS_REGION = getEnvVarOrFail("AWS_REGION");

// TCM Encounter payload type
type TcmEncounterPayload = {
  cxId: string;
  patientId: string;
  facilityName: string;
  latestEvent: "Admitted" | "Transferred" | "Discharged";
  class: string;
  admitTime?: string;
  dischargeTime?: string | null;
  clinicalInformation: Record<string, unknown>;
};

// FHIR Encounter type for parsing
type FhirEncounter = {
  resourceType: "Encounter";
  id: string;
  status: string;
  class: {
    code: string;
    display?: string;
    system?: string;
  };
  period?: {
    start?: string;
    end?: string;
  };
  subject?: {
    reference: string;
  };
  [key: string]: unknown;
};

// FHIR Location type for parsing
type FhirLocation = {
  resourceType: "Location";
  id: string;
  name?: string;
  [key: string]: unknown;
};

// FHIR Bundle type for parsing
type FhirBundle = {
  resourceType: "Bundle";
  entry?: Array<{
    resource?: FhirEncounter | FhirLocation | unknown;
  }>;
};

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  const { log } = out("backfill-tcm-encounter");

  log(`Started at ${new Date(startedAt).toISOString()}`);
  log(`Processing files from bucket: ${BUCKET_NAME}, prefix: ${S3_PREFIX}`);

  // Initialize S3 client
  const s3Utils = new S3Utils(AWS_REGION);

  // Calculate cutoff date
  const cutoffDate = dayjs().subtract(7, "days");

  // Initialize output folder
  initRunsFolder();
  const timestamp = dayjs().toISOString();
  const outputFolder = `runs/backfill-tcm-encounter/${timestamp}`;
  fs.mkdirSync(outputFolder, { recursive: true });

  const outputFile = `${outputFolder}/tcm-encounters.ndjson`;
  const errorFile = `${outputFolder}/errors.log`;

  try {
    // List objects in S3 with the specified prefix
    const objects = await s3Utils.listObjects(BUCKET_NAME, S3_PREFIX);

    // Filter objects by date and filename (only encounter.hl7.json files)
    const filteredObjects = objects.filter(obj => {
      if (!obj.LastModified || !obj.Key) return false;

      // Only process encounter.hl7.json files
      if (!obj.Key.endsWith("encounter.hl7.json")) return false;

      const objectDate = dayjs(obj.LastModified);
      return objectDate.isAfter(cutoffDate);
    });

    log(
      `Found ${objects.length} total objects, ${filteredObjects.length} encounter.hl7.json files within lookback window`
    );

    let processedCount = 0;
    let errorCount = 0;
    const tcmEncounters: TcmEncounterPayload[] = [];

    // Process each object
    for (const obj of filteredObjects) {
      if (!obj.Key) continue;

      try {
        // Download and parse the file
        const fileContent = await s3Utils.downloadFile({ bucket: BUCKET_NAME, key: obj.Key });
        const jsonContent = JSON.parse(fileContent.toString());

        // Extract encounters from the bundle
        const encounters = extractEncountersFromBundle(jsonContent);

        // Extract location from the bundle for facility name
        const location = extractLocationFromBundle(jsonContent);
        const facilityName = location?.name || "Unknown Facility";

        // Convert to TCM encounter payloads
        const tcmPayloads = encounters.map(encounter =>
          convertToTcmEncounterPayload(encounter, facilityName)
        );

        tcmEncounters.push(...tcmPayloads);
        processedCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing ${obj.Key}: ${error}`;
        log(errorMsg);
        fs.appendFileSync(errorFile, `${errorMsg}\n`);
      }
    }

    // Write results to file
    for (const encounter of tcmEncounters) {
      fs.appendFileSync(outputFile, JSON.stringify(encounter) + "\n");
    }

    log(`Done in ${elapsedTimeAsStr(startedAt)}`);
    log(
      `Processed ${processedCount} files, found ${tcmEncounters.length} encounters, errors: ${errorCount}`
    );
    log(`Output: ${outputFile}`);
  } catch (error) {
    log(`Fatal error: ${error}`);
    process.exit(1);
  }
}

export function extractEncountersFromBundle(bundle: FhirBundle): FhirEncounter[] {
  const encounters: FhirEncounter[] = [];

  if (!bundle.entry) return encounters;

  for (const entry of bundle.entry) {
    if (!entry.resource) continue;

    const resource = entry.resource as FhirEncounter;
    if (resource.resourceType === "Encounter") {
      // Filter for specific encounter classes (IMP = Inpatient, EMER = Emergency)
      if (resource.class?.code && ["IMP", "EMER"].includes(resource.class.code)) {
        encounters.push(resource);
      }
    }
  }

  return encounters;
}

export function extractLocationFromBundle(bundle: FhirBundle): FhirLocation | undefined {
  if (!bundle.entry) return undefined;

  for (const entry of bundle.entry) {
    if (!entry.resource) continue;

    const resource = entry.resource as FhirLocation;
    if (resource.resourceType === "Location") {
      return resource;
    }
  }

  return undefined;
}

export function convertToTcmEncounterPayload(
  encounter: FhirEncounter,
  facilityName: string
): TcmEncounterPayload {
  // Extract patient ID from subject reference
  const patientId = encounter.subject?.reference?.replace("Patient/", "") || "";

  // Determine latest event based on period field
  // If both start and end exist, it's a discharge event
  // If only start exists, it's an admit event
  let latestEvent: "Admitted" | "Transferred" | "Discharged" = "Admitted";
  if (encounter.period?.start && encounter.period?.end) {
    latestEvent = "Discharged";
  } else if (encounter.period?.start && !encounter.period?.end) {
    latestEvent = "Admitted";
  }

  // Extract admit and discharge times and shift them 5 hours back to convert from NY local to UTC
  const admitTime = encounter.period?.start
    ? dayjs(encounter.period.start).subtract(5, "hours").toISOString()
    : undefined;
  const dischargeTime = encounter.period?.end
    ? dayjs(encounter.period.end).subtract(5, "hours").toISOString()
    : undefined;

  // Extract encounter class
  const encounterClass = _.capitalize(encounter.class?.display || "unknown");

  return {
    cxId: CX_ID,
    patientId,
    facilityName,
    latestEvent,
    class: encounterClass,
    ...(admitTime && { admitTime }),
    ...(dischargeTime && { dischargeTime }),
    clinicalInformation: {},
  };
}

function elapsedTimeAsStr(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
