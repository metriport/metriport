import { Bundle, MedicationRequest } from "@medplum/fhirtypes";
import { Command } from "commander";
import { getFileContents } from "../shared/fs";

function compareMedicationRequests(
  originalFilePath: string,
  deduplicatedFilePath: string
): (string | undefined)[] {
  const originalBundle: Bundle = JSON.parse(getFileContents(originalFilePath));
  const deduplicatedBundle: Bundle = JSON.parse(getFileContents(deduplicatedFilePath));

  const originalMedicationRequests =
    originalBundle.entry
      ?.filter(entry => entry.resource?.resourceType === "MedicationRequest")
      .map(entry => (entry.resource as MedicationRequest).id) ?? [];

  const deduplicatedMedicationRequests =
    deduplicatedBundle.entry
      ?.filter(entry => entry.resource?.resourceType === "MedicationRequest")
      .map(entry => (entry.resource as MedicationRequest).id) ?? [];

  const missingIds = originalMedicationRequests.filter(
    id => !deduplicatedMedicationRequests.includes(id)
  );

  return missingIds.filter(id => id !== undefined);
}

const program = new Command();

program
  .option("-o, --original <path>", "path to original file")
  .option("-d, --deduplicated <path>", "path to deduplicated file")
  .parse(process.argv);

const options = program.opts();

if (!options.original || !options.deduplicated) {
  console.error("Please provide both original and deduplicated file paths");
  process.exit(1);
}

const missingMedicationRequestIds = compareMedicationRequests(
  options.original,
  options.deduplicated
);

console.log(
  "MedicationRequest IDs missing from the deduplicated file:",
  missingMedicationRequestIds
);
