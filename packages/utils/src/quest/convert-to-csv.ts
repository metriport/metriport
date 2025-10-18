import fs from "fs";
import path from "path";
import { QuestReplica } from "@metriport/core/external/quest/replica";
import { responseDetailRow } from "@metriport/core/external/quest/schema/response";
import { Command } from "commander";

/**
 * This command converts a Quest response file of tab-separate values into a CSV that can be
 * loaded into any spreadsheet viewer.
 */
const command = new Command();
command.name("convert-to-csv");
command.description("Converts a Quest response file into a CSV");
command.argument("<date-id>", "The date ID of the Quest response file to convert");

// Maps headers of each column to their corresponding JSON key
const headerMap = Object.fromEntries(
  responseDetailRow.map(row => (row ? [row.header, row.key] : []))
);

command.action(async (dateId: string) => {
  const replica = new QuestReplica();
  const fileContent = await replica.readFile(`Incoming/Metriport_${dateId}.txt`);
  const csv = convertToCsv(fileContent);
  writeCsvToRunsDir(dateId, csv);
});

// Convert to CSV and escape any quotation marks in the cell content
function convertToCsv(fileContent: Buffer): string {
  const lines = fileContent.toString().split("\n");
  const headers = lines[0].split("\t").map(header => headerMap[header]);
  const rows = lines.slice(1).map(line => {
    const cells = line.split("\t");
    return cells.map(cell => cell.replace(/"/g, '""'));
  });
  return [headers, ...rows].map(row => `"${row.join('","')}"`).join("\n");
}

function writeCsvToRunsDir(dateId: string, csv: string) {
  const outputPath = path.join(process.cwd(), `runs/quest-csv/${dateId}.csv`);
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, csv, "utf-8");
  console.log(`CSV file written to ${outputPath}`);
}

export default command;
