import * as fs from "fs";
import * as path from "path";

/**
 * Script to check for duplicate patient IDs across multiple *_params.json files.
 *
 * This script reads all *_params.json files in a directory and identifies
 * patient IDs that appear in more than one file, which could indicate
 * potential issues with data processing or duplicate work.
 *
 * To execute it:
 * - download the params files from S3 into local
 *   > aws s3 sync s3://bucket/prefix/run=merge-id bucket/prefix/run=merge-id --exact-timestamps --exclude "*" --include "*_params.json"
 * - run the script with the local folder as the argument
 *   > ts-node check-duplicate-patient-ids.ts <path-to-merge-id>
 */

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
}

class DuplicatePatientIdChecker {
  private patientIdMap: Map<string, string[]> = new Map();
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
          this.patientIdMap.set(patientId, []);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.patientIdMap.get(patientId)!.push(fileName);
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
    this.patientIdMap.forEach((files, patientId) => {
      if (files.length > 1) {
        this.duplicatePatientIds.push({
          patientId,
          files: [...new Set(files)], // Remove duplicate file references
          count: files.length,
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
    console.log(`Patient IDs appearing multiple times: ${duplicateCount}`);
    console.log("=".repeat(80));

    if (duplicateCount > 0) {
      console.log(
        `\n❌ Found ${duplicateCount} duplicate patient IDs. Check the detailed report file for more information.`
      );
    } else {
      console.log(
        "\n✅ No duplicate patient IDs found! All patient IDs are unique across all files."
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
      `Patient IDs appearing multiple times: ${duplicateCount}`,
      `Timestamp: ${new Date().toISOString()}`,
      "=".repeat(80),
      "",
    ];

    if (duplicateCount > 0) {
      reportContent.push("DUPLICATE PATIENT IDs:");
      reportContent.push("-".repeat(80));

      this.duplicatePatientIds
        .sort((a, b) => b.count - a.count) // Sort by count descending
        .forEach((occurrence, index) => {
          reportContent.push(`${index + 1}. Patient ID: ${occurrence.patientId}`);
          reportContent.push(`   Count: ${occurrence.count}`);
          reportContent.push(`   Files: ${occurrence.files.join(", ")}`);
          reportContent.push("");
        });
    } else {
      reportContent.push(
        "✅ No duplicate patient IDs found! All patient IDs are unique across all files."
      );
    }

    const outputFile = path.join(this.targetFolder, "duplicate-patient-id-analysis.txt");
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
      allPatientIds: Array.from(this.patientIdMap.entries()).map(([patientId, files]) => ({
        patientId,
        files: [...new Set(files)],
        count: files.length,
      })),
    };

    const outputFile = path.join(this.targetFolder, "duplicate-patient-id-analysis.json");
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
    // Get folder path from command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log("Usage: ts-node check-duplicate-patient-ids.ts <folder-path>");
      console.log("Example: ts-node check-duplicate-patient-ids.ts /path/to/your/folder");
      console.log("\nOr use current directory:");
      console.log("ts-node check-duplicate-patient-ids.ts .");
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
