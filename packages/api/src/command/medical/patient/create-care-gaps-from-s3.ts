import { S3Utils } from "@metriport/core/external/aws/s3";
import { MetriportError, NotFoundError, uuidv7 } from "@metriport/shared";
import { Config } from "@metriport/core/util/config";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { CareGapCreate, MeasureReport } from "@metriport/shared/src/domain/care-gap";
import { CareGapModel } from "../../../models/care-gap";
import * as AWS from "aws-sdk";
import { errorToString } from "@metriport/shared";

const region = Config.getAWSRegion();
const BATCH_SIZE = 500;

export type CreateCareGapsFromS3Params = {
  cxId: string;
  jobId: string;
};

interface CareGapFiles {
  patientId: string;
  measureName: string;
  reportKey?: string;
  evidenceKey?: string;
}

function extractMeasureNameFromPath(path: string): string {
  const parts = path.split("/");
  if (parts.length < 2) {
    throw new MetriportError("Invalid path format: cannot extract measure name", undefined, {
      path,
    });
  }
  const measurePart = parts[parts.length - 2];
  return measurePart;
}

function extractPatientIdFromPath(path: string): string {
  const parts = path.split("/");
  const ptPart = parts.find(part => part.startsWith("pt="));
  if (!ptPart) {
    throw new MetriportError("Could not extract patient ID from path", undefined, { path });
  }
  return ptPart.substring(3);
}

export async function createCareGapsFromS3({
  cxId,
  jobId,
}: CreateCareGapsFromS3Params): Promise<void> {
  const { log } = out(`createCareGapsFromS3 - cxId ${cxId}, jobId ${jobId}`);
  const bucketName = Config.getAnalyticsBucketName();
  if (!bucketName) throw new MetriportError("Analytics platform bucket name is not set");
  const bucket: string = bucketName;

  const s3Client = new S3Utils(region);
  const prefix = `care-gaps/cx=${cxId}/job=${jobId}/`;

  const lastRun = new Date();
  const careGapFilesMap = new Map<string, CareGapFiles>();
  const readyToProcess: CareGapFiles[] = [];
  let totalProcessed = 0;
  let failedChunks = 0;

  async function processPage(objects: AWS.S3.Object[]): Promise<void> {
    if (objects.length < 1) return;

    const reportFiles = objects.filter((obj: AWS.S3.Object) => obj.Key?.endsWith("report.json"));
    const evidenceFiles = objects.filter((obj: AWS.S3.Object) =>
      obj.Key?.endsWith("supporting-evidence.json")
    );

    for (const reportFile of reportFiles) {
      if (!reportFile.Key) continue;
      const patientId = extractPatientIdFromPath(reportFile.Key);
      const measureName = extractMeasureNameFromPath(reportFile.Key);
      const mapKey = `${patientId}-${measureName}`;

      const existing = careGapFilesMap.get(mapKey);
      if (existing) {
        existing.reportKey = reportFile.Key;
      } else {
        careGapFilesMap.set(mapKey, {
          patientId,
          measureName,
          reportKey: reportFile.Key,
        });
      }
    }

    for (const evidenceFile of evidenceFiles) {
      if (!evidenceFile.Key) continue;
      const patientId = extractPatientIdFromPath(evidenceFile.Key);
      const measureName = extractMeasureNameFromPath(evidenceFile.Key);
      const mapKey = `${patientId}-${measureName}`;

      const existing = careGapFilesMap.get(mapKey);
      if (existing) {
        existing.evidenceKey = evidenceFile.Key;
      } else {
        careGapFilesMap.set(mapKey, {
          patientId,
          measureName,
          evidenceKey: evidenceFile.Key,
        });
      }
    }

    for (const [mapKey, file] of careGapFilesMap.entries()) {
      if (file.reportKey && file.evidenceKey) {
        readyToProcess.push(file);
        careGapFilesMap.delete(mapKey);
      }
    }

    while (readyToProcess.length > 0) {
      const batchToProcess = readyToProcess.splice(0, BATCH_SIZE);
      try {
        await processCareGapBatch(batchToProcess, {
          bucket,
          s3Client,
          cxId,
          jobId,
          lastRun,
        });
        totalProcessed += batchToProcess.length;
      } catch (error) {
        failedChunks++;
        log(`Failed to process batch: ${errorToString(error)}`);
      }
    }
  }

  await s3Client.processObjects(bucket, prefix, processPage);

  if (totalProcessed < 1 && failedChunks < 1) {
    throw new NotFoundError("No files found for the given job", undefined, { cxId, jobId });
  }

  const incompletePairs = Array.from(careGapFilesMap.values());

  if (incompletePairs.length > 0) {
    const msg = `Found ${incompletePairs.length} incomplete care gap file pairs`;
    log(msg);
    capture.message(msg, {
      level: "warning",
      extra: {
        cxId,
        jobId,
        incompleteCount: incompletePairs.length,
        incompleteFiles: incompletePairs.map(f => ({
          patientId: f.patientId,
          measureName: f.measureName,
          hasReport: !!f.reportKey,
          hasEvidence: !!f.evidenceKey,
          reportKey: f.reportKey,
          evidenceKey: f.evidenceKey,
        })),
      },
    });
  }

  if (failedChunks > 0) {
    const msg = `Failed to process ${failedChunks} care gap batches`;
    log(msg);
    capture.message(msg, {
      level: "warning",
      extra: {
        cxId,
        jobId,
        failedChunks,
        totalProcessed,
      },
    });
  }
}

async function processCareGapBatch(
  batch: CareGapFiles[],
  context: {
    bucket: string;
    s3Client: S3Utils;
    cxId: string;
    jobId: string;
    lastRun: Date;
  }
): Promise<void> {
  const { log } = out(`processCareGapBatch - cxId ${context.cxId}, jobId ${context.jobId}`);
  const { bucket, s3Client, cxId, jobId, lastRun } = context;
  const careGaps: CareGapCreate[] = [];
  let failedItems = 0;

  for (const careGapFiles of batch) {
    let measureReport: MeasureReport;
    try {
      if (!careGapFiles.reportKey) {
        failedItems++;
        log(
          `Skipping care gap file without reportKey for patient ${careGapFiles.patientId}, measure ${careGapFiles.measureName}`
        );
        continue;
      }

      const reportContents = await s3Client.getFileContentsAsString(bucket, careGapFiles.reportKey);
      measureReport = JSON.parse(reportContents);
      validateMeasureReport(measureReport, careGapFiles.reportKey, careGapFiles.patientId);
    } catch (error) {
      failedItems++;
      log(`Failed to process care gap file ${careGapFiles.reportKey}: ${errorToString(error)}`);
      continue;
    }

    let supportingEvidence: Record<string, unknown> = {};
    try {
      if (!careGapFiles.evidenceKey) {
        failedItems++;
        log(
          `Skipping care gap file without evidenceKey for patient ${careGapFiles.patientId}, measure ${careGapFiles.measureName}`
        );
        continue;
      }

      const evidenceContents = await s3Client.getFileContentsAsString(
        bucket,
        careGapFiles.evidenceKey
      );
      supportingEvidence = JSON.parse(evidenceContents);
    } catch (error) {
      failedItems++;
      log(`Failed to process care gap file ${careGapFiles.evidenceKey}: ${errorToString(error)}`);
      continue;
    }

    careGaps.push({
      cxId,
      patientId: careGapFiles.patientId,
      measureName: careGapFiles.measureName,
      jobId,
      measureReport,
      supportingEvidence,
      lastRun,
    });
  }

  if (failedItems > 0) {
    log(`Failed to process ${failedItems} out of ${batch.length} care gap items in batch`);
    capture.message(`Failed to process care gap items in batch`, {
      level: "warning",
      extra: {
        cxId,
        jobId,
        failedItems,
        batchSize: batch.length,
      },
    });
  }

  const careGapsToInsert = careGaps.map((c: CareGapCreate) => {
    return {
      ...c,
      id: uuidv7(),
    };
  });

  const sequelize = CareGapModel.sequelize;
  if (!sequelize) {
    throw new MetriportError("Sequelize instance not available");
  }

  const transaction = await sequelize.transaction();
  try {
    await CareGapModel.bulkCreate(careGapsToInsert, {
      ignoreDuplicates: true,
      returning: false,
      transaction,
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function validateMeasureReport(
  report: unknown,
  s3Key: string,
  expectedPatientId: string
): asserts report is MeasureReport {
  if (!report || typeof report !== "object") {
    throw new MetriportError("Measure report must be an object", undefined, { s3Key });
  }

  const r = report as Record<string, unknown>;

  if (r.resourceType !== "MeasureReport") {
    throw new MetriportError("Invalid resourceType in measure report", undefined, {
      s3Key,
      resourceType: String(r.resourceType),
    });
  }

  if (!r.id || typeof r.id !== "string") {
    throw new MetriportError("Missing or invalid id in measure report", undefined, { s3Key });
  }

  if (!r.status || typeof r.status !== "string") {
    throw new MetriportError("Missing or invalid status in measure report", undefined, { s3Key });
  }

  if (!r.type || typeof r.type !== "string") {
    throw new MetriportError("Missing or invalid type in measure report", undefined, { s3Key });
  }

  if (!r.measure || typeof r.measure !== "string") {
    throw new MetriportError("Missing or invalid measure in measure report", undefined, { s3Key });
  }

  if (!r.subject || typeof r.subject !== "object") {
    throw new MetriportError("Missing or invalid subject in measure report", undefined, { s3Key });
  }

  const subject = r.subject as Record<string, unknown>;
  const subjectReference = subject.reference;
  if (!subjectReference || typeof subjectReference !== "string") {
    throw new MetriportError("Missing or invalid subject.reference in measure report", undefined, {
      s3Key,
    });
  }

  const patientIdFromReference = subjectReference.startsWith("Patient/")
    ? subjectReference.substring(8)
    : subjectReference;

  if (patientIdFromReference !== expectedPatientId) {
    throw new MetriportError("Patient ID mismatch between path and measure report", undefined, {
      s3Key,
      expectedPatientId,
      actualPatientId: patientIdFromReference,
      subjectReference,
    });
  }

  if (!r.period || typeof r.period !== "object") {
    throw new MetriportError("Missing or invalid period in measure report", undefined, { s3Key });
  }

  if (!Array.isArray(r.group)) {
    throw new MetriportError("Missing or invalid group array in measure report", undefined, {
      s3Key,
    });
  }
}
