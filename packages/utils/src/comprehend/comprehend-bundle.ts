import { Command } from "commander";

const program = new Command();

program
  .command("bundle")
  .description("Run AWS Comprehend on a bundle")
  .option("--cx-id <cx-id>", "The customer ID")
  .option("--patient-id <patient-id>", "The patient ID")
  .action(async ({ cxId, patientId }: { cxId?: string; patientId?: string }) => {
    if (!cxId) throw new Error("CX ID is required");
    if (!patientId) throw new Error("Patient ID is required");
  });

export default program;
