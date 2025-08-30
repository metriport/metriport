import * as fs from "fs";
import * as path from "path";

/**
 * Script to check the "merge groups" to make sure they're healthy.
 *
 * A merge group represents the plan to merge CSVs from single lambda invocation.
 *
 * A single Merge CSV script invocation creates a Merge CSV ID, and all lambda
 * invocations done from that script will share the same merge ID.
 *
 * All merge group files will be stored under the `/_info` folder inside the
 * merge ID's folder in S3.
 *
 * The script will look for duplicated (S3) keys across all group files.
 *
 * To execute it:
 * - download the group files from S3 into local
 *   > aws s3 sync s3://cx-merge-prefix/run=merge-id cx-merge-prefix/run=merge-id --exact-timestamps --exclude "*" --include "*_groups.json"
 * - run the script with the local folder as the argument
 *   > ts-node check-merge-groups.ts <path-to-merge-id>/_info
 */
interface FileEntry {
  key: string;
  size: number;
  tableName: string;
}

interface GroupEntry {
  groupId: string;
  tableName: string;
  files: FileEntry[];
}

interface KeyOccurrence {
  key: string;
  files: string[];
  count: number;
}

class DuplicateKeyChecker {
  private keyMap: Map<string, string[]> = new Map();
  private duplicateKeys: KeyOccurrence[] = [];
  private targetFolder: string;

  constructor(folderPath: string) {
    this.targetFolder = folderPath;
  }

  /**
   * Find all *_groups.json files in the specified directory
   */
  private findGroupFiles(): string[] {
    try {
      const files = fs.readdirSync(this.targetFolder);
      return files
        .filter(file => file.endsWith("_groups.json"))
        .map(file => path.join(this.targetFolder, file));
    } catch (error) {
      console.error(`Error reading directory ${this.targetFolder}:`, error);
      return [];
    }
  }

  /**
   * Process a single groups.json file
   */
  private processFile(filePath: string): void {
    try {
      console.log(`Processing: ${path.basename(filePath)}`);

      const content = fs.readFileSync(filePath, "utf-8");
      const data: GroupEntry[] = JSON.parse(content);

      data.forEach(group => {
        group.files.forEach(file => {
          const key = file.key;
          if (!this.keyMap.has(key)) {
            this.keyMap.set(key, []);
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.keyMap.get(key)!.push(path.basename(filePath));
        });
      });
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  /**
   * Find duplicate keys
   */
  private findDuplicates(): void {
    this.keyMap.forEach((files, key) => {
      if (files.length > 1) {
        this.duplicateKeys.push({
          key,
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
    const totalKeys = this.keyMap.size;
    const duplicateCount = this.duplicateKeys.length;
    const uniqueKeys = totalKeys - duplicateCount;

    // Console output - only summary
    console.log("\n" + "=".repeat(80));
    console.log("DUPLICATE KEY ANALYSIS REPORT");
    console.log("=".repeat(80));
    console.log(`Target folder: ${this.targetFolder}`);
    console.log(`Total unique keys found: ${totalKeys}`);
    console.log(`Keys appearing only once: ${uniqueKeys}`);
    console.log(`Keys appearing multiple times: ${duplicateCount}`);
    console.log("=".repeat(80));

    if (duplicateCount > 0) {
      console.log(
        `\n❌ Found ${duplicateCount} duplicate keys. Check the detailed report file for more information.`
      );
    } else {
      console.log("\n✅ No duplicate keys found! All keys are unique across all files.");
    }

    // Write detailed report to text file
    this.writeDetailedReportToFile(totalKeys, uniqueKeys, duplicateCount);
  }

  /**
   * Write detailed report to text file
   */
  private writeDetailedReportToFile(
    totalKeys: number,
    uniqueKeys: number,
    duplicateCount: number
  ): void {
    const reportContent = [
      "=".repeat(80),
      "DUPLICATE KEY ANALYSIS REPORT",
      "=".repeat(80),
      `Target folder: ${this.targetFolder}`,
      `Total unique keys found: ${totalKeys}`,
      `Keys appearing only once: ${uniqueKeys}`,
      `Keys appearing multiple times: ${duplicateCount}`,
      `Timestamp: ${new Date().toISOString()}`,
      "=".repeat(80),
      "",
    ];

    if (duplicateCount > 0) {
      reportContent.push("DUPLICATE KEYS:");
      reportContent.push("-".repeat(80));

      this.duplicateKeys
        .sort((a, b) => b.count - a.count) // Sort by count descending
        .forEach((occurrence, index) => {
          reportContent.push(`${index + 1}. Key: ${occurrence.key}`);
          reportContent.push(`   Count: ${occurrence.count}`);
          reportContent.push(`   Files: ${occurrence.files.join(", ")}`);
          reportContent.push("");
        });
    } else {
      reportContent.push("✅ No duplicate keys found! All keys are unique across all files.");
    }

    const outputFile = path.join(this.targetFolder, "duplicate-key-analysis.txt");
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
        totalKeys: this.keyMap.size,
        uniqueKeys: this.keyMap.size - this.duplicateKeys.length,
        duplicateKeys: this.duplicateKeys.length,
        timestamp: new Date().toISOString(),
      },
      duplicates: this.duplicateKeys,
      allKeys: Array.from(this.keyMap.entries()).map(([key, files]) => ({
        key,
        files: [...new Set(files)],
        count: files.length,
      })),
    };

    const outputFile = path.join(this.targetFolder, "duplicate-key-analysis.json");
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n📊 Detailed results exported to: ${outputFile}`);
  }

  /**
   * Main execution method
   */
  public async run(): Promise<void> {
    console.log("🔍 Starting duplicate key analysis...\n");
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

    const groupFiles = this.findGroupFiles();
    console.log(`Found ${groupFiles.length} *_groups.json files to process\n`);

    if (groupFiles.length === 0) {
      console.log(`❌ No *_groups.json files found in '${this.targetFolder}'.`);
      return;
    }

    // Process each file
    groupFiles.forEach(file => this.processFile(file));

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
      console.log("Usage: ts-node check-merge-groups.ts <folder-path>");
      console.log("Example: ts-node check-merge-groups.ts /path/to/your/folder");
      console.log("\nOr use current directory:");
      console.log("ts-node check-merge-groups.ts .");
      process.exit(1);
    }

    const folderPath = args[0];

    // Resolve relative paths
    const resolvedPath = path.resolve(folderPath);

    console.log(`🔍 Duplicate Key Checker`);
    console.log(`📁 Target folder: ${resolvedPath}\n`);

    const checker = new DuplicateKeyChecker(resolvedPath);
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

export { DuplicateKeyChecker };
