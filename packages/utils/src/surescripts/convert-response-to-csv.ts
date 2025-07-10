import { Command } from "commander";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { parseResponseFileToCsv } from "@metriport/core/external/surescripts/file/file-parser";
import { writeSurescriptsRunsFile, openSurescriptsRunsFile } from "./shared";

const program = new Command();

interface ConvertResponseOptions {
  cxId?: string;
  facilityId?: string;
  transmissionId?: string;
  populationId?: string;
  patientId?: string;
}

program
  .name("convert-response-to-csv")
  .option("--patient-id <patientId>", "The patient ID")
  .option("--transmission-id <transmissionId>", "The transmission ID")
  .description("Converts a patient response to CSV")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ transmissionId, patientId }: ConvertResponseOptions) {
    if (!patientId) throw new Error("Patient ID is required");
    if (!transmissionId) throw new Error("Transmission ID is required");

    const replica = new SurescriptsReplica();
    const file = await replica.getRawResponseFile({ transmissionId, populationId: patientId });
    if (!file) throw new Error("File not found");
    const csv = parseResponseFileToCsv(file);
    const csvPath = `csv/${patientId}/${transmissionId}.csv`;
    writeSurescriptsRunsFile(csvPath, csv);
    console.log(`CSV written to ${csvPath}`);
    openSurescriptsRunsFile(csvPath);
  });

export default program;
