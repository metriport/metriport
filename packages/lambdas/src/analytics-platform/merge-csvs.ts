import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { BadRequestError, errorToString, uuidv4 } from "@metriport/shared";
import { groupBy, partition } from "lodash";
import { createGzip } from "zlib";

/**
 * This is a temporary version of this lambda. Soon, we want to have most of this code on packages/core,
 * and this lambda just calls that code.
 */

const MB_IN_BYTES = 1024 * 1024;
// TODO UPDATE THIS
// TODO UPDATE THIS
// TODO UPDATE THIS
// TODO UPDATE THIS
// TODO UPDATE THIS
// const TARGET_GROUP_SIZE_MB = 300;
const TARGET_GROUP_SIZE_MB = 1_000;
const TARGET_GROUP_SIZE_BYTES = TARGET_GROUP_SIZE_MB * MB_IN_BYTES;

export type GroupAndMergeCSVsParams = {
  sourceBucket: string;
  sourcePrefix: string;
  destinationBucket: string;
  destinationPrefix: string;
  jsonToCsvJobId: string;
  mergeCsvJobId: string;
  patientIds: string[];
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
  region,
}: GroupAndMergeCSVsParams) {
  const grouper = new CSVGrouper({
    sourceBucket,
    sourcePrefix,
    destinationBucket,
    destinationPrefix,
    jsonToCsvJobId,
    mergeCsvJobId,
    patientIds,
    region,
  });

  await grouper.groupAndMergeCSVs();
}

export class CSVGrouper {
  private readonly s3Utils: S3Utils;
  private readonly sourceBucket: string;
  private readonly sourcePrefix: string;
  private readonly destinationBucket: string;
  private readonly destinationPrefix: string;
  private readonly jsonToCsvJobId: string;
  private readonly mergeCsvJobId: string;
  private readonly patientIds: string[];
  private readonly region: string;
  private readonly trainId: string;

  constructor({
    sourceBucket,
    sourcePrefix,
    destinationBucket,
    destinationPrefix,
    jsonToCsvJobId,
    mergeCsvJobId,
    patientIds,
    region,
  }: GroupAndMergeCSVsParams) {
    this.s3Utils = new S3Utils(region);
    this.sourceBucket = sourceBucket;
    this.sourcePrefix = sourcePrefix;
    this.destinationBucket = destinationBucket;
    this.destinationPrefix = destinationPrefix;
    this.jsonToCsvJobId = jsonToCsvJobId;
    this.mergeCsvJobId = mergeCsvJobId;
    this.patientIds = patientIds;
    this.region = region;
    this.trainId = uuidv4();
  }

  /**
   * Main function to group and merge CSV files by type
   */
  async groupAndMergeCSVs() {
    const { log } = out("groupAndMergeCSVs");
    log(`Starting CSV grouping process for bucket: ${this.sourceBucket}`);

    const allFiles = await this.listAllFiles();
    log(`Found ${allFiles.length} total files`);

    const filesToProcess = allFiles.filter(file => {
      if (file.size < 1) return false;
      if (file.key.endsWith("/")) return false;
      return true;
    });

    const fileGroups = this.groupFilesByTypeAndSize(filesToProcess);
    log(
      `Created these groups:\n${fileGroups
        .map(group => {
          return `.... ${group.groupId}: files: ${group.files.length} (${
            // TODO ENG-743 import from shared
            // formatNumber(group.totalSize / MB_IN_BYTES)
            Math.floor((group.totalSize / MB_IN_BYTES) * 100) / 100
          } MB)`;
        })
        .join("\n")}`
    );
    const mergeResults = await this.mergeFileGroups(fileGroups);
    log(`Completed merging ${mergeResults.length} groups`);
  }

  /**
   * Lists all files in the source bucket
   */
  private async listAllFiles(): Promise<FileInfo[]> {
    const { log } = out("listAllFiles");
    const files: FileInfo[] = [];

    const s3Utils = new S3Utils(this.region);

    // Going through each patient (concurrently) instead of listing all files in in the customer's
    // because listing all files of all patients in one go was very slow.
    const startedAt = Date.now();
    const rawFileList: AWS.S3.ObjectList = [];
    await executeAsynchronously(
      this.patientIds,
      async ptId => {
        // snowflake/fhir-to-csv/15ae0cea-e90a-4a49-82e4-42164c74b0aa/01981325-f688-70bc-9cb8-79c4b405755d/2025-08-08T02-18-56/_tmp_fhir-to-csv_output_15ae0cea-e90a-4a49-82e4-42164c74b0aa_01981325-f688-70bc-9cb8-79c4b405755d_condition.csv
        const prefixToSearch = `${this.sourcePrefix}/${ptId}/${this.jsonToCsvJobId}`;
        const patientFiles = await s3Utils.listObjects(this.sourceBucket, prefixToSearch);
        rawFileList.push(...patientFiles);
      },
      {
        numberOfParallelExecutions: 20,
        minJitterMillis: 10,
        maxJitterMillis: 50,
      }
    );
    const finishedAt = Date.now();
    log(`Listed ${rawFileList.length} raw files in ${finishedAt - startedAt}ms`);

    files.push(
      ...rawFileList.flatMap(obj => {
        if (obj.Key && obj.Key.includes(this.jsonToCsvJobId)) {
          // snowflake/fhir-to-csv/15ae0cea-e90a-4a49-82e4-42164c74b0aa/01981325-f688-70bc-9cb8-79c4b405755d/2025-08-08T02-18-56/_tmp_fhir-to-csv_output_15ae0cea-e90a-4a49-82e4-42164c74b0aa_01981325-f688-70bc-9cb8-79c4b405755d_condition.csv
          const tableName =
            obj.Key.split("/")[5]?.split("_").slice(6).join("_").split(".")[0] || "";
          return {
            key: obj.Key,
            size: obj.Size ?? 0,
            tableName,
          };
        }
        return [];
      })
    );

    log(`Returning info for ${files.length} files from bucket ${this.sourceBucket}`);
    return files;
  }

  /**
   * Groups files by type and size into evenly balanced chunks.
   */
  private groupFilesByTypeAndSize(files: FileInfo[]): FileGroup[] {
    const { log } = out("groupFilesByTypeAndSize");

    const grouped = groupBy(files, file => file.tableName);

    const fileGroups: FileGroup[] = [];

    // For each file type, create evenly balanced groups
    for (const [tableName, typeFiles] of Object.entries(grouped)) {
      // log(`Processing ${typeFiles.length} files of table: ${tableName}`);

      const [filesLargerThanTargetGroupSize, filesSmallerThanTargetGroupSize] = partition(
        typeFiles,
        file => file.size > TARGET_GROUP_SIZE_BYTES
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
      const optimalGroupCount = Math.max(1, Math.ceil(totalSize / TARGET_GROUP_SIZE_BYTES));
      // const targetGroupSize = totalSize / optimalGroupCount;
      // log(
      //   `Total size: ${(totalSize / MB_IN_BYTES).toFixed(
      //     2
      //   )} MB, Target groups: ${optimalGroupCount}, Target group size: ${(
      //     targetGroupSize / MB_IN_BYTES
      //   ).toFixed(2)} MB`
      // );

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

    log(`Created ${fileGroups.length} file groups`);
    return fileGroups;
  }

  /**
   * Merges files in each group. Run them in sequence to avoid running out of memory (optimizing
   * for output bundle size - larger files).
   */
  private async mergeFileGroups(fileGroups: FileGroup[]): Promise<MergeResult[]> {
    const { log } = out("mergeFileGroups");
    const results: MergeResult[] = [];

    let idx = 0;
    for (const fileGroup of fileGroups) {
      try {
        const result = await this.mergeFileGroup(fileGroup);
        results[idx++] = result;
      } catch (error) {
        log(`Error merging group ${fileGroup.groupId}: ${errorToString(error)}`);
        throw error;
      }
    }
    return results.filter(Boolean);
  }

  /**
   * Merges a single group of files
   */
  private async mergeFileGroup(fileGroup: FileGroup): Promise<MergeResult> {
    const { log } = out("mergeFileGroup");
    const { files, groupId, tableName } = fileGroup;

    const outputKey = this.buildOutputKey(fileGroup);

    const chunks: Buffer[] = [];

    await executeAsynchronously(files, async file => {
      let fileContent = await this.s3Utils.getFileContentsAsString(this.sourceBucket, file.key);
      chunks.push(Buffer.from(fileContent));
      fileContent = "";
    });

    let combinedContent: Buffer | undefined = Buffer.concat(chunks);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const gzippedContent = await this.compressBuffer(combinedContent!);
    const totalSize = gzippedContent.length;
    combinedContent = undefined;

    await this.s3Utils.uploadFile({
      bucket: this.destinationBucket,
      key: outputKey,
      file: gzippedContent,
      contentType: "application/gzip",
    });

    log(`Successfully merged group ${groupId} to ${outputKey}`);

    return {
      tableName: tableName,
      groupId,
      outputKey,
      totalSize,
      fileCount: files.length,
    };
  }

  private buildOutputKey(fileGroup: FileGroup): string {
    return `${this.destinationPrefix}/run=${this.mergeCsvJobId}/${fileGroup.tableName}/train=${this.trainId}/${fileGroup.groupId}.csv.gz`;
  }

  /**
   * TODO ENG-743 MOVE THIS TO CORE
   * TODO ENG-743 MOVE THIS TO CORE
   * TODO ENG-743 MOVE THIS TO CORE
   *
   * Helper method to compress a buffer using gzip
   */
  private async compressBuffer(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const chunks: Buffer[] = [];

      gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
      gzip.on("end", () => resolve(Buffer.concat(chunks)));
      gzip.on("error", reject);

      gzip.write(buffer);
      gzip.end();
    });
  }
}

/**
 * Lambda handler entry point for AWS Lambda
 */
export async function handler(params: GroupAndMergeCSVsParams) {
  const {
    sourceBucket,
    sourcePrefix,
    destinationBucket,
    destinationPrefix,
    region,
    jsonToCsvJobId,
    mergeCsvJobId,
    patientIds,
  } = params;

  if (
    !sourceBucket ||
    !sourcePrefix ||
    !destinationBucket ||
    !destinationPrefix ||
    !jsonToCsvJobId ||
    !mergeCsvJobId ||
    !patientIds ||
    !region
  ) {
    throw new BadRequestError(`Missing required parameters`);
  }

  await groupAndMergeCSVs(params);
}

// metriport-analytics-platform-production/snowflake/fhir-to-csv/15ae0cea-e90a-4a49-82e4-42164c74b0aa/01981325-f688-70bc-9cb8-79c4b405755d/2025-08-08T02-18-56
// groupAndMergeCSVs({
//   sourceBucket: "metriport-analytics-platform-production",
//   sourcePrefix: "snowflake/fhir-to-csv/15ae0cea-e90a-4a49-82e4-42164c74b0aa",
//   destinationBucket: "metriport-analytics-platform-production",
//   destinationPrefix: "snowflake/merged/15ae0cea-e90a-4a49-82e4-42164c74b0aa",
//   jobId: "2025-08-08T02-23-29",
//   region: "us-west-1",
//   patientIds: [
//     "01981484-89cf-79ca-8a30-fecaa88d9bb7",
//     "01981a23-495b-7339-b678-2e3363b48a60",
//     "019814ef-b8e6-781c-98e6-338dee77a01d",
//     "01981a24-fd9d-76cb-8608-8c4e0721087a",
//     "01981ab7-f842-7177-bd31-07ded77ff616",
//     "01981b4d-973e-7516-969b-a152a884a2da",
//     "01981b5c-1f75-71d2-9550-8e8e3cc6789c",
//     "01981b7e-a005-7957-b60a-067a8c6c0689",
//     "01981bba-03d1-785a-a9f5-6644481e0ab7",
//     "01981b94-afa7-7507-b844-9b2f148d2e83",
//     "01981ab1-5a28-79d7-9f39-5a997951bb6c",
//   ],
// });
