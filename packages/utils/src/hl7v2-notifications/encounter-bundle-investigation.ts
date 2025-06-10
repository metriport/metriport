import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { makeDirIfNeeded, writeFileContents } from "@metriport/core/util/fs";
import { Command } from "commander";
import path from "path";

/**
 * This script downloads files from multiple S3 buckets for encounter bundle investigation.
 *
 * It downloads files from:
 * 1. metriport-hl7-conversion-production: encounter.hl7.json files
 * 2. metriport-incoming-hl7-notification-production: all HL7 notification files
 * 3. metriport-medical-documents: consolidated data files
 *
 * Files are organized in a directory structure: {cx_id}_{patient_id}_{timestamp}/
 *
 * Execute this with:
 * $ npm run encounter-bundle-investigation -- --cx-id <cx_id> --patient-id <patient_id> [--encounter-id <encounter_id>] [--dryrun]
 */

const region = getEnvVarOrFail("AWS_REGION");

const buckets = {
  hl7Conversion: "metriport-hl7-conversion-production",
  incomingNotifications: "metriport-incoming-hl7-notification-production",
  medicalDocs: "metriport-medical-documents",
} as const;

type Params = {
  cxId: string;
  patientId: string;
  encounterId?: string;
  dryrun?: boolean;
};

const program = new Command();
program
  .name("encounter-bundle-investigation")
  .description("CLI to download HL7v2 encounter bundle files from S3 for investigation.")
  .requiredOption(`--cx-id <cxId>`, "Customer ID")
  .requiredOption(`--patient-id <patientId>`, "Patient ID")
  .option(
    `--encounter-id <encounterId>`,
    "Encounter ID (optional, downloads all encounters if not provided)"
  )
  .option(`--dryrun`, "Just list files without downloading them.")
  .showHelpAfterError();

async function downloadEncounterFiles(
  s3: S3Utils,
  cxId: string,
  patientId: string,
  encounterId: string | undefined,
  outputDir: string,
  dryRun: boolean,
  log: typeof console.log
): Promise<void> {
  log("=== Downloading HL7 Conversion Files ===");

  const encounterPrefix = encounterId
    ? `cxId=${cxId}/ptId=${patientId}/ADT/${encounterId}`
    : `cxId=${cxId}/ptId=${patientId}/ADT/`;

  const encounterObjects = await s3.listObjects(buckets.hl7Conversion, encounterPrefix);
  const encounterJsonFiles =
    encounterObjects?.filter(obj => obj.Key?.includes("encounter.hl7.json")) ?? [];

  log(`Found ${encounterJsonFiles.length} encounter.hl7.json files`);

  if (!dryRun) {
    for (const obj of encounterJsonFiles) {
      if (obj.Key) {
        log(`Downloading: ${obj.Key}`);
        const content = await s3.getFileContentsAsString(buckets.hl7Conversion, obj.Key);
        const fileName = path.basename(obj.Key);
        const filePath = path.join(outputDir, "hl7-conversion", fileName);
        makeDirIfNeeded(filePath);
        writeFileContents(filePath, content);
      }
    }
  } else {
    encounterJsonFiles.forEach(obj => log(`Would download: ${obj.Key}`));
  }
}

async function downloadNotificationFiles(
  s3: S3Utils,
  cxId: string,
  patientId: string,
  outputDir: string,
  dryRun: boolean,
  log: typeof console.log
): Promise<void> {
  log("=== Downloading HL7 Notification Files ===");

  const notificationPrefix = `${cxId}/${patientId}/`;
  const notificationObjects = await s3.listObjects(
    buckets.incomingNotifications,
    notificationPrefix
  );

  log(`Found ${notificationObjects?.length ?? 0} notification files`);

  if (!dryRun && notificationObjects) {
    for (const obj of notificationObjects) {
      if (obj.Key) {
        log(`Downloading: ${obj.Key}`);
        const content = await s3.getFileContentsAsString(buckets.incomingNotifications, obj.Key);
        const fileName = path.basename(obj.Key);
        const filePath = path.join(outputDir, "hl7-notifications", fileName);
        makeDirIfNeeded(filePath);
        writeFileContents(filePath, content);
      }
    }
  } else if (dryRun && notificationObjects) {
    notificationObjects.forEach(obj => log(`Would download: ${obj.Key}`));
  }
}

async function downloadConsolidatedData(
  s3: S3Utils,
  cxId: string,
  patientId: string,
  outputDir: string,
  dryRun: boolean,
  log: typeof console.log
): Promise<void> {
  log("=== Downloading Consolidated Data Files ===");

  const consolidatedKey = `${cxId}/${patientId}/${cxId}_${patientId}_CONSOLIDATED_DATA.json`;

  try {
    const content = await s3.getFileContentsAsString(buckets.medicalDocs, consolidatedKey);
    log(`Found consolidated data file: ${consolidatedKey}`);

    if (!dryRun) {
      log(`Downloading: ${consolidatedKey}`);
      const filePath = path.join(
        outputDir,
        "consolidated-data",
        `${cxId}_${patientId}_CONSOLIDATED_DATA.json`
      );
      makeDirIfNeeded(filePath);
      writeFileContents(filePath, content);
    } else {
      log(`Would download: ${consolidatedKey}`);
    }
  } catch (error) {
    log(`No consolidated data file found at: ${consolidatedKey}`);
  }
}

async function main(): Promise<void> {
  program.parse();
  const { cxId, patientId, encounterId, dryrun: dryRun } = program.opts<Params>();

  const { log } = out(dryRun ? "DRY-RUN" : "");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseDir = "./runs/encounter-bundle-investigation";
  makeDirIfNeeded(baseDir);
  const outputDir = `${baseDir}/${cxId}_${patientId}_${timestamp}`;

  log(`=== Encounter Bundle Investigation ===`);
  log(`Customer ID: ${cxId}`);
  log(`Patient ID: ${patientId}`);
  log(`Encounter ID: ${encounterId ?? "All encounters"}`);
  log(`Output Directory: ${outputDir}`);
  log(`Dry Run: ${dryRun ? "Yes" : "No"}`);

  if (!dryRun) {
    makeDirIfNeeded(path.join(outputDir, "dummy"));
  }

  const s3 = new S3Utils(region);

  try {
    await downloadEncounterFiles(s3, cxId, patientId, encounterId, outputDir, dryRun ?? false, log);
    await downloadNotificationFiles(s3, cxId, patientId, outputDir, dryRun ?? false, log);
    await downloadConsolidatedData(s3, cxId, patientId, outputDir, dryRun ?? false, log);

    log("=== Download Complete ===");
    if (!dryRun) {
      log(`Files saved to: ${outputDir}`);
    }
  } catch (error) {
    log("Error during download:", error);
    process.exit(1);
  }
}

main().catch(console.error);
