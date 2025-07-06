import { Command } from "commander";

const program = new Command();

program
  .name("preview-extraction-bundle")
  .description("Preview an extraction bundle")
  .option("--cx-id <cx-id>", "The ID of the customer")
  .option("--patient-id <patient-id>", "The ID of the patient")
  .action(async ({ cxId, patientId }: { cxId?: string; patientId?: string }) => {
    if (!cxId || !patientId) {
      throw new Error("CX ID and patient ID are required");
    }

    // const bundle = await getExtractionBundle(cxId, patientId);
    console.log("Previewing extraction bundle", cxId, patientId);
  });

export default program;
