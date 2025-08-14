import { executeWithRetriesS3, S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { BadRequestError, errorToString, uuidv4 } from "@metriport/shared";
import { groupBy, partition, uniqBy } from "lodash";
import { createGzip } from "zlib";

/**
 * TODO ENG-743 This is a temporary version of this lambda. Soon, we want to have most of this code on packages/core,
 * and this lambda just calls that code.
 */

export const MB_IN_BYTES = 1024 * 1024;

// Too much can result in continuous rate limit errors from S3 (we try up to 5 times)
const numberOfParallelListObjectsFromS3 = 20;
// Too much can result in an OOM error at the lambda
const numberOfParallelMergeFileGroups = 5;

export type GroupAndMergeCSVsParams = {
  sourceBucket: string;
  sourcePrefix: string;
  destinationBucket: string;
  destinationPrefix: string;
  jsonToCsvJobId: string;
  mergeCsvJobId: string;
  patientIds: string[];
  targetGroupSizeMB: number;
  region: string;
};

interface FileInfo {
  key: string;
  size: number;
  tableName: string;
}

interface FileGroup {
  groupId: string;
  files: FileInfo[];
  tableName: string;
  totalSize: number;
}

interface MergeResult {
  groupId: string;
  tableName: string;
  outputKey: string | undefined;
  totalSize: number;
  fileCount: number;
}

/**
 * Entry point function to group and merge CSV files
 *
 * @param sourceBucket - Source S3 bucket containing patient CSV files
 * @param destinationBucket - Destination S3 bucket for merged files
 * @param region - AWS region
 * @returns Promise<MergeResult[]> - Array of merge results
 */
export async function groupAndMergeCSVs({
  sourceBucket,
  sourcePrefix,
  destinationBucket,
  destinationPrefix,
  jsonToCsvJobId,
  mergeCsvJobId,
  patientIds,
  targetGroupSizeMB,
  region,
}: GroupAndMergeCSVsParams): Promise<MergeResult[]> {
  const grouper = new CSVGrouper({
    sourceBucket,
    sourcePrefix,
    destinationBucket,
    destinationPrefix,
    jsonToCsvJobId,
    mergeCsvJobId,
    patientIds,
    targetGroupSizeMB,
    region,
  });

  return await grouper.groupAndMergeCSVs();
}

export class CSVGrouper {
  private readonly sourceBucket: string;
  private readonly sourcePrefix: string;
  private readonly destinationBucket: string;
  private readonly destinationPrefix: string;
  private readonly jsonToCsvJobId: string;
  private readonly mergeCsvJobId: string;
  private readonly patientIds: string[];
  private readonly targetGroupSizeMB: number;
  private readonly trainId: string;
  private readonly region: string;

  constructor({
    sourceBucket,
    sourcePrefix,
    destinationBucket,
    destinationPrefix,
    jsonToCsvJobId,
    mergeCsvJobId,
    patientIds,
    targetGroupSizeMB,
    region,
  }: GroupAndMergeCSVsParams) {
    this.sourceBucket = sourceBucket;
    this.sourcePrefix = sourcePrefix;
    this.destinationBucket = destinationBucket;
    this.destinationPrefix = destinationPrefix;
    this.jsonToCsvJobId = jsonToCsvJobId;
    this.mergeCsvJobId = mergeCsvJobId;
    this.patientIds = patientIds;
    this.targetGroupSizeMB = targetGroupSizeMB;
    this.trainId = uuidv4();
    this.region = region;
  }

  get targetGroupSizeBytes(): number {
    return this.targetGroupSizeMB * MB_IN_BYTES;
  }

  /**
   * Main function to group and merge CSV files by type
   */
  async groupAndMergeCSVs(): Promise<MergeResult[]> {
    const { log } = out(`mergeId: ${this.mergeCsvJobId}, trainId: ${this.trainId}`);
    log(
      `Starting CSV merge for ${this.patientIds.length} patients - bucket: ${this.sourceBucket}, ` +
        `jsonToCsvJobId: ${this.jsonToCsvJobId}, numberOfParallelMergeFileGroups: ${numberOfParallelMergeFileGroups}, ` +
        `numberOfParallelListObjectsFromS3: ${numberOfParallelListObjectsFromS3}`
    );
    // Store the input params to help debugging issues
    await this.storeInputParams();

    let allFiles: FileInfo[] | undefined = await this.listAllFiles(log);

    const filesToProcess = allFiles.filter(file => {
      if (file.size < 1) return false;
      if (file.key.endsWith("/")) return false;
      return true;
    });
    allFiles = undefined;

    const fileGroups = this.groupFilesByTypeAndSize(filesToProcess);
    const s3Utils = new S3Utils(this.region);
    const mergeInfoPrefix = this.buildMergeInfoPrefix();
    await s3Utils.uploadFile({
      bucket: this.destinationBucket,
      key: `${mergeInfoPrefix}/${this.trainId}_groups.json`,
      file: Buffer.from(JSON.stringify(fileGroups, null, 2)),
    });

    const mergeResults = await this.mergeFileGroups(fileGroups, log);

    return mergeResults;
  }

  private async storeInputParams(): Promise<void> {
    const params = {
      numberOfParallelMergeFileGroups,
      numberOfParallelListObjectsFromS3,
      jsonToCsvJobId: this.jsonToCsvJobId,
      mergeCsvJobId: this.mergeCsvJobId,
      sourceBucket: this.sourceBucket,
      sourcePrefix: this.sourcePrefix,
      destinationBucket: this.destinationBucket,
      destinationPrefix: this.destinationPrefix,
      patientIds: this.patientIds,
    };
    const s3Utils = new S3Utils(this.region);
    const mergeInfoPrefix = this.buildMergeInfoPrefix();
    await s3Utils.uploadFile({
      bucket: this.destinationBucket,
      key: `${mergeInfoPrefix}/${this.trainId}_params.json`,
      file: Buffer.from(JSON.stringify(params, null, 2)),
    });
  }

  /**
   * Lists all files in the source bucket
   */
  private async listAllFiles(log: typeof console.log): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const startedAt = Date.now();
    log(`Listing files...`);

    // Going through each patient (concurrently) instead of listing all files in in the customer's
    // because listing all files of all patients in one go was very slow.
    const rawFileList: AWS.S3.ObjectList = [];
    await executeAsynchronously(
      this.patientIds,
      async ptId => {
        const s3Utils = new S3Utils(this.region);
        const prefixToSearch = `${this.sourcePrefix}/${this.jsonToCsvJobId}/${ptId}`;
        const patientFiles = await s3Utils.listObjects(this.sourceBucket, prefixToSearch);
        rawFileList.push(...patientFiles);
      },
      {
        numberOfParallelExecutions: numberOfParallelListObjectsFromS3,
        minJitterMillis: 10,
        maxJitterMillis: 50,
      }
    );

    files.push(
      ...rawFileList.flatMap(obj => {
        if (obj.Key && obj.Key.includes(this.jsonToCsvJobId)) {
          const tableName = parseTableNameFromKey(obj.Key);
          return {
            key: obj.Key,
            size: obj.Size ?? 0,
            tableName,
          };
        }
        return [];
      })
    );

    const uniqueFiles = uniqBy(files, file => file.key);
    const finishedAt = Date.now();
    log(
      `Returning ${uniqueFiles.length} files (${files.length} pre-uniq) - took ${
        finishedAt - startedAt
      }ms`
    );
    return uniqueFiles;
  }

  /**
   * Groups files by type and size into evenly balanced chunks.
   */
  private groupFilesByTypeAndSize(files: FileInfo[]): FileGroup[] {
    const grouped = groupBy(files, file => file.tableName);

    const fileGroups: FileGroup[] = [];

    // For each file type, create evenly balanced groups
    for (const [tableName, typeFiles] of Object.entries(grouped)) {
      const [filesLargerThanTargetGroupSize, filesSmallerThanTargetGroupSize] = partition(
        typeFiles,
        file => file.size > this.targetGroupSizeBytes
      );

      let groupIndex = 0;

      filesLargerThanTargetGroupSize.forEach(file => {
        fileGroups.push({
          groupId: `${tableName}_${groupIndex++}`,
          tableName,
          files: [file],
          totalSize: file.size,
        });
      });

      // Sort files by size (largest first) for better distribution
      const sortedFiles = filesSmallerThanTargetGroupSize.sort((a, b) => b.size - a.size);

      // Calculate total size and optimal number of groups
      const totalSize = sortedFiles.reduce((sum, file) => sum + file.size, 0);
      const optimalGroupCount = Math.max(1, Math.ceil(totalSize / this.targetGroupSizeBytes));

      // Use a greedy approach with multiple passes to balance groups
      const groups: FileInfo[][] = Array.from({ length: optimalGroupCount }, () => []);
      const groupSizes: number[] = Array(optimalGroupCount).fill(0);

      // First pass: distribute large files evenly
      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        if (!file) continue;

        // Find the group with the smallest current size
        let smallestGroupIndex = 0;
        let smallestGroupSize = groupSizes[0] || 0;

        for (let j = 1; j < optimalGroupCount; j++) {
          const currentSize = groupSizes[j] || 0;
          if (currentSize < smallestGroupSize) {
            smallestGroupSize = currentSize;
            smallestGroupIndex = j;
          }
        }

        // Add file to the smallest group
        const targetGroup = groups[smallestGroupIndex];
        if (targetGroup) {
          targetGroup.push(file);
          groupSizes[smallestGroupIndex] = (groupSizes[smallestGroupIndex] || 0) + file.size;
        }
      }

      // Create FileGroup objects
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const groupSize = groupSizes[i];
        if (group && group.length > 0 && groupSize !== undefined) {
          fileGroups.push({
            groupId: `${tableName}_${groupIndex++}`,
            tableName: tableName,
            files: group,
            totalSize: groupSize,
          });
        }
      }
    }

    return fileGroups;
  }

  /**
   * Merges each groups' files into their respective compressed CSV files.
   */
  private async mergeFileGroups(
    fileGroups: FileGroup[],
    log: typeof console.log
  ): Promise<MergeResult[]> {
    const results: MergeResult[] = [];
    const startedAt = Date.now();

    log(`Merging ${fileGroups.length} file groups`);

    let idx = 0;
    const errors: { fileGroup: FileGroup; error: string }[] = [];
    await executeAsynchronously(
      fileGroups,
      async (fileGroup: FileGroup) => {
        try {
          const result = await executeWithRetriesS3(() => this.mergeFileGroup(fileGroup, log));
          results[idx++] = result;
        } catch (error) {
          log(`Error merging group ${fileGroup.groupId}: ${errorToString(error)}`);
          errors.push({ fileGroup, error: errorToString(error) });
          throw error;
        }
      },
      {
        numberOfParallelExecutions: numberOfParallelMergeFileGroups,
        minJitterMillis: 50,
        maxJitterMillis: 200,
      }
    );
    if (errors.length > 0) {
      log(
        `Errors merging ${errors.length} groups: ${errors
          .map(e => `${e.fileGroup.tableName}/${e.fileGroup.groupId}`)
          .join(", ")}`
      );
      throw new Error(`Errors merging groups`);
    }
    log(`Completed merging ${results.length} groups - took ${Date.now() - startedAt}ms`);

    return results.filter(Boolean);
  }

  /**
   * Merges a single group of files into a single compressed CSV file
   */
  private async mergeFileGroup(
    fileGroup: FileGroup,
    log: typeof console.log
  ): Promise<MergeResult> {
    const { files, groupId, tableName } = fileGroup;

    const s3Utils = new S3Utils(this.region);
    const outputKey = this.buildOutputKey(fileGroup);

    log(`Merging ${files.length} files for ${tableName}, groupId ${groupId}`);

    // Create a streaming gzip compressor
    const gzip = createGzip();
    const compressedChunks: Buffer[] = [];

    // Set up gzip event handlers
    gzip.on("data", (chunk: Buffer) => compressedChunks.push(chunk));

    // Process files sequentially to avoid memory issues
    let amountOfFilesProcessed = 0;
    for (const file of files) {
      // Get S3 read stream and pipe directly to gzip
      const s3ReadStream = s3Utils.s3
        .getObject({
          Bucket: this.sourceBucket,
          Key: file.key,
        })
        .createReadStream();

      // Pipe S3 stream directly to gzip without loading into memory
      s3ReadStream.pipe(gzip, { end: false });

      // Wait for this file's stream to complete before processing the next
      await new Promise<void>((resolve, reject) => {
        s3ReadStream.on("end", () => resolve());
        s3ReadStream.on("error", reject);
      });

      amountOfFilesProcessed++;
      if (amountOfFilesProcessed % 50 === 0) {
        log(`Processed ${amountOfFilesProcessed} files, tableName ${tableName}`);
      }
    }
    log(`Processed ${amountOfFilesProcessed} files, tableName ${tableName}`);

    // End the gzip stream and wait for completion
    gzip.end();
    // Wait for gzip to finish processing all data
    await new Promise<void>((resolve, reject) => {
      gzip.on("end", () => resolve());
      gzip.on("error", reject);
    });

    const gzippedContent = Buffer.concat(compressedChunks);
    const totalSize = gzippedContent.length;
    compressedChunks.length = 0;

    log(`Compressed, uploading to S3...`);
    await s3Utils.uploadFile({
      bucket: this.destinationBucket,
      key: outputKey,
      file: gzippedContent,
      contentType: "application/gzip",
    });

    log(`Successfully merged ${tableName}, groupId ${groupId}, to ${outputKey}`);
    return {
      tableName: tableName,
      groupId,
      outputKey,
      totalSize,
      fileCount: files.length,
    };
  }

  private buildMergePrefix(): string {
    return `${this.destinationPrefix}/run=${this.mergeCsvJobId}`;
  }
  private buildMergeInfoPrefix(): string {
    return `${this.buildMergePrefix()}/_info`;
  }
  private buildOutputKey(fileGroup: FileGroup): string {
    const mergePrefix = this.buildMergePrefix();
    return `${mergePrefix}/${fileGroup.tableName}/train=${this.trainId}/${fileGroup.groupId}.csv.gz`;
  }
}

function parseTableNameFromKey(key: string): string {
  // e.g.: snowflake/fhir-to-csv/cx-id/2025-08-08T02-18-56/patient-id/_tmp_fhir-to-csv_output_cx-id_patient-id_condition.csv
  const tableName = key.split("/")[5]?.split("_").slice(6).join("_").split(".")[0] || "";
  return tableName;
}

/**
 * Lambda handler entry point for AWS Lambda
 */
export async function handler(params: GroupAndMergeCSVsParams): Promise<MergeResult[]> {
  const {
    sourceBucket,
    sourcePrefix,
    destinationBucket,
    destinationPrefix,
    region,
    jsonToCsvJobId,
    mergeCsvJobId,
    patientIds,
    targetGroupSizeMB,
  } = params;

  if (
    !sourceBucket ||
    !sourcePrefix ||
    !destinationBucket ||
    !destinationPrefix ||
    !jsonToCsvJobId ||
    !mergeCsvJobId ||
    !patientIds ||
    !region ||
    !targetGroupSizeMB
  ) {
    throw new BadRequestError(`Missing required parameters`);
  }

  const results = await groupAndMergeCSVs(params);

  return results;
}
