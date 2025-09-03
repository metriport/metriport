import { makeDirIfNeeded } from "@metriport/core/util/fs";
import * as fs from "fs";
import * as path from "path";
import { buildGetDirPathInside, initRunsFolder } from "../../shared/folder";

/**
 * Script to check for duplicate patient IDs across multiple *_params.json files.
 *
 * This script reads all *_params.json files in a directory and identifies
 * patient IDs that appear in more than one file OR multiple times within the same file,
 * which could indicate potential issues with data processing or duplicate work.
 *
 * These files are created by the merge-csvs lambda, as part of the job to merge
 * individual patients' CSV into merged CSV files by resource type/table.
 * @see storeInputParams in packages/core/src/command/analytics-platform/merge-csvs/index.ts
 *
 * To execute it:
 * - download the params files from S3 into local
 *   > aws s3 sync s3://bucket/prefix/run=merge-id bucket/prefix/run=merge-id --exact-timestamps --exclude "*" --include "*_params.json"
 * - run the script with the local folder as the argument
 *   > ts-node src/analytics-platform/util/check-duplicate-patient-ids.ts <path-to-merge-id>
 *
 * Output files are stored in the `runs/analytics/` folder:
 * - `check-dup-patient-ids_<timestamp>.json`: Contains only duplicate patient IDs and summary
 * - `check-dup-patient-ids_<timestamp>.txt`: Detailed text report with all findings
 */

const outputFileName = buildGetDirPathInside("analytics")("check-dup-patient-ids");
makeDirIfNeeded(outputFileName);

interface ParamsFile {
  numberOfParallelMergeFileGroups: number;
  numberOfParallelListObjectsFromS3: number;
  jsonToCsvJobId: string;
  mergeCsvJobId: string;
  sourceBucket: string;
  sourcePrefix: string;
  destinationBucket: string;
  destinationPrefix: string;
  patientIds: string[];
}

interface PatientIdOccurrence {
  patientId: string;
  files: string[];
  count: number;
  totalOccurrences: number;
  occurrencesPerFile: { [fileName: string]: number };
}

class DuplicatePatientIdChecker {
  private patientIdMap: Map<string, Map<string, number>> = new Map();
  private duplicatePatientIds: PatientIdOccurrence[] = [];
  private targetFolder: string;
  private totalFilesProcessed = 0;
  private totalPatientIds = 0;

  constructor(folderPath: string) {
    this.targetFolder = folderPath;
  }

  /**
   * Find all *_params.json files in the specified directory
   */
  private findParamsFiles(): string[] {
    try {
      const files = fs.readdirSync(this.targetFolder);
      return files
        .filter(file => file.endsWith("_params.json"))
        .map(file => path.join(this.targetFolder, file));
    } catch (error) {
      console.error(`Error reading directory ${this.targetFolder}:`, error);
      return [];
    }
  }

  /**
   * Process a single params.json file
   */
  private processFile(filePath: string): void {
    try {
      console.log(`Processing: ${path.basename(filePath)}`);

      const content = fs.readFileSync(filePath, "utf-8");
      const data: ParamsFile = JSON.parse(content);

      if (!data.patientIds || !Array.isArray(data.patientIds)) {
        console.warn(
          `⚠️  Warning: ${path.basename(filePath)} has no patientIds array or invalid structure`
        );
        return;
      }

      const fileName = path.basename(filePath);
      this.totalFilesProcessed++;
      this.totalPatientIds += data.patientIds.length;

      data.patientIds.forEach(patientId => {
        if (!this.patientIdMap.has(patientId)) {
          this.patientIdMap.set(patientId, new Map<string, number>());
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const fileOccurrences = this.patientIdMap.get(patientId)!;
        const currentCount = fileOccurrences.get(fileName) || 0;
        fileOccurrences.set(fileName, currentCount + 1);
      });

      console.log(`   - Found ${data.patientIds.length} patient IDs`);
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  /**
   * Find duplicate patient IDs
   */
  private findDuplicates(): void {
    this.patientIdMap.forEach((fileOccurrences, patientId) => {
      const files = Array.from(fileOccurrences.keys());
      const totalOccurrences = Array.from(fileOccurrences.values()).reduce(
        (sum, count) => sum + count,
        0
      );

      // Check if patient ID appears in multiple files OR multiple times in the same file
      if (files.length > 1 || totalOccurrences > files.length) {
        this.duplicatePatientIds.push({
          patientId,
          files,
          count: files.length,
          totalOccurrences,
          occurrencesPerFile: Object.fromEntries(fileOccurrences),
        });
      }
    });
  }

  /**
   * Generate a summary report
   */
  private generateReport(): void {
    const totalUniquePatientIds = this.patientIdMap.size;
    const duplicateCount = this.duplicatePatientIds.length;
    const uniquePatientIds = totalUniquePatientIds - duplicateCount;

    // Console output - summary
    console.log("\n" + "=".repeat(80));
    console.log("DUPLICATE PATIENT ID ANALYSIS REPORT");
    console.log("=".repeat(80));
    console.log(`Target folder: ${this.targetFolder}`);
    console.log(`Total files processed: ${this.totalFilesProcessed}`);
    console.log(`Total patient IDs found: ${this.totalPatientIds}`);
    console.log(`Unique patient IDs: ${totalUniquePatientIds}`);
    console.log(`Patient IDs appearing only once: ${uniquePatientIds}`);
    console.log(
      `Patient IDs with duplicates (across files or within same file): ${duplicateCount}`
    );
    console.log("=".repeat(80));

    if (duplicateCount > 0) {
      console.log(
        `\n❌ Found ${duplicateCount} patient IDs with duplicates (across files or within same file). Check the detailed report file for more information.`
      );
    } else {
      console.log(
        "\n✅ No duplicate patient IDs found! All patient IDs are unique across all files and within each file."
      );
    }

    // Write detailed report to text file
    this.writeDetailedReportToFile(totalUniquePatientIds, uniquePatientIds, duplicateCount);
  }

  /**
   * Write detailed report to text file
   */
  private writeDetailedReportToFile(
    totalUniquePatientIds: number,
    uniquePatientIds: number,
    duplicateCount: number
  ): void {
    const reportContent = [
      "=".repeat(80),
      "DUPLICATE PATIENT ID ANALYSIS REPORT",
      "=".repeat(80),
      `Target folder: ${this.targetFolder}`,
      `Total files processed: ${this.totalFilesProcessed}`,
      `Total patient IDs found: ${this.totalPatientIds}`,
      `Unique patient IDs: ${totalUniquePatientIds}`,
      `Patient IDs appearing only once: ${uniquePatientIds}`,
      `Patient IDs with duplicates (across files or within same file): ${duplicateCount}`,
      `Timestamp: ${new Date().toISOString()}`,
      "=".repeat(80),
      "",
    ];

    if (duplicateCount > 0) {
      reportContent.push("DUPLICATE PATIENT IDs:");
      reportContent.push("-".repeat(80));

      this.duplicatePatientIds
        .sort((a, b) => b.totalOccurrences - a.totalOccurrences) // Sort by total occurrences descending
        .forEach((occurrence, index) => {
          reportContent.push(`${index + 1}. Patient ID: ${occurrence.patientId}`);
          reportContent.push(`   Files: ${occurrence.files.join(", ")}`);
          reportContent.push(`   Total Occurrences: ${occurrence.totalOccurrences}`);
          reportContent.push(`   Occurrences per file:`);
          Object.entries(occurrence.occurrencesPerFile).forEach(([fileName, count]) => {
            reportContent.push(`     - ${fileName}: ${count} time${count > 1 ? "s" : ""}`);
          });
          reportContent.push("");
        });
    } else {
      reportContent.push(
        "✅ No duplicate patient IDs found! All patient IDs are unique across all files."
      );
    }

    const outputFile = outputFileName + ".txt";
    fs.writeFileSync(outputFile, reportContent.join("\n"));
    console.log(`📄 Detailed report written to: ${outputFile}`);
  }

  /**
   * Export detailed results to JSON file
   */
  private exportResults(): void {
    const results = {
      summary: {
        targetFolder: this.targetFolder,
        totalFilesProcessed: this.totalFilesProcessed,
        totalPatientIds: this.totalPatientIds,
        uniquePatientIds: this.patientIdMap.size,
        patientIdsAppearingOnce: this.patientIdMap.size - this.duplicatePatientIds.length,
        duplicatePatientIds: this.duplicatePatientIds.length,
        timestamp: new Date().toISOString(),
      },
      duplicates: this.duplicatePatientIds,
    };

    const outputFile = outputFileName + ".json";
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n📊 Detailed results exported to: ${outputFile}`);
  }

  /**
   * Main execution method
   */
  public async run(): Promise<void> {
    console.log("🔍 Starting duplicate patient ID analysis...\n");
    console.log(`Target folder: ${this.targetFolder}\n`);

    // Check if folder exists
    if (!fs.existsSync(this.targetFolder)) {
      console.log(`❌ Error: Folder '${this.targetFolder}' does not exist.`);
      return;
    }

    // Check if folder is a directory
    if (!fs.statSync(this.targetFolder).isDirectory()) {
      console.log(`❌ Error: '${this.targetFolder}' is not a directory.`);
      return;
    }

    const paramsFiles = this.findParamsFiles();
    console.log(`Found ${paramsFiles.length} *_params.json files to process\n`);

    if (paramsFiles.length === 0) {
      console.log(`❌ No *_params.json files found in '${this.targetFolder}'.`);
      return;
    }

    // Process each file
    paramsFiles.forEach(file => this.processFile(file));

    // Find duplicates
    this.findDuplicates();

    // Generate report
    this.generateReport();

    // Export results
    this.exportResults();
  }
}

// Run the script
async function main() {
  try {
    initRunsFolder();

    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log(
        "Usage: ts-node src/analytics-platform/util/check-duplicate-patient-ids.ts <folder-path>"
      );
      console.log("\nOr use current directory:");
      console.log("ts-node src/analytics-platform/util/check-duplicate-patient-ids.ts .");
      process.exit(1);
    }

    const folderPath = args[0];

    // Resolve relative paths
    const resolvedPath = path.resolve(folderPath);

    console.log(`🔍 Duplicate Patient ID Checker`);
    console.log(`📁 Target folder: ${resolvedPath}\n`);

    const checker = new DuplicatePatientIdChecker(resolvedPath);
    await checker.run();
  } catch (error) {
    console.error("❌ Script execution failed:", error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (require.main === module) {
  main();
}

export { DuplicatePatientIdChecker };
