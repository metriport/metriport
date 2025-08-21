import { Command } from "commander";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { parseResponseFileToCsv } from "@metriport/core/external/surescripts/file/file-parser";
import { writeSurescriptsRunsFile } from "./shared";

const program = new Command();

interface ConvertResponseOptions {
  transmissionId: string;
  patientId: string;
}

program
  .name("convert-response-to-csv")
  .requiredOption("--patient-id <patientId>", "The patient ID")
  .requiredOption("--transmission-id <transmissionId>", "The transmission ID")
  .description("Converts a patient response to CSV")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async ({ transmissionId, patientId }: ConvertResponseOptions) => {
    const replica = new SurescriptsReplica();
    const file = await replica.getRawResponseFile({ transmissionId, populationId: patientId });
    if (!file) throw new Error("File not found");
    const csv = parseResponseFileToCsv(file);
    const csvPath = `csv/${patientId}/${transmissionId}.csv`;
    writeSurescriptsRunsFile(csvPath, csv);
    console.log(`CSV written to ${csvPath}`);
  });

export default program;
