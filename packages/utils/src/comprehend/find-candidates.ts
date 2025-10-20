import os from "os";
import fs from "fs";
import path from "path";
import { Command } from "commander";
import { Bundle, Resource, DiagnosticReport, Medication, Attachment } from "@medplum/fhirtypes";

/**
 * Find candidates for further inspection for medication data with the Comprehend API.
 */
const command = new Command();
command.name("find-candidates");
command.requiredOption("--cx-id <cxId>", "The customer ID for the candidates to be found.");

command.action(async ({ cxId }: { cxId: string }) => {
  const patientIds = getPatientIdsWithConsolidated(cxId);
  let candidateCount = 0;

  for (const patientId of patientIds) {
    const consolidated = getConsolidated(cxId, patientId);
    const diagnosticCount = countDiagnosticReports(consolidated);
    const medicationCount = countMedications(consolidated);

    if (medicationCount !== 0) continue;

    const ratio = diagnosticCount / medicationCount;
    if (ratio >= 10) {
      console.log(
        `${patientId} ratio: ${ratio
          .toFixed(2)
          .padEnd(10)} (${diagnosticCount} / ${medicationCount})`
      );
      candidateCount++;
    }
  }

  console.log(`Found ${candidateCount} candidates`);
});

function countDiagnosticReports(bundle: Bundle): number {
  return (
    bundle.entry?.filter(entry => entry.resource && isCandidateDiagnosticReport(entry.resource))
      .length ?? 0
  );
}

function countMedications(bundle: Bundle): number {
  return (
    bundle.entry?.filter(entry => entry.resource && isCandidateMedication(entry.resource)).length ??
    0
  );
}

function isCandidateMedication(resource: Resource): resource is Medication {
  if (resource.resourceType !== "Medication") return false;
  return true;
}

function isCandidateDiagnosticReport(resource: Resource): resource is DiagnosticReport {
  if (resource.resourceType !== "DiagnosticReport") return false;
  if (!Array.isArray(resource.presentedForm)) return false;
  return resource.presentedForm.some(form => isCandidatePresentedForm(form));
}

function isCandidatePresentedForm(attachment: Attachment): boolean {
  if (!attachment.data) return false;
  const content = Buffer.from(attachment.data, "base64").toString("utf8");
  return content.toLowerCase().includes("medication");
}

function getPatientIdsWithConsolidated(cxId: string): string[] {
  const baseDirectory = path.join(os.homedir(), ".mp", "customer", cxId, "patient");
  if (!fs.existsSync(baseDirectory)) {
    console.error(`Base directory ${baseDirectory} does not exist`);
    return [];
  }

  const patients = fs.readdirSync(baseDirectory).filter(dir => !dir.endsWith(".json"));
  return patients;
}

function getConsolidated(cxId: string, patientId: string): Bundle {
  const bundleFile = path.join(
    os.homedir(),
    ".mp",
    "customer",
    cxId,
    "patient",
    patientId,
    "consolidated-bundle.json"
  );
  if (!fs.existsSync(bundleFile)) {
    throw new Error(`Bundle file ${bundleFile} does not exist`);
  }
  return JSON.parse(fs.readFileSync(bundleFile, "utf8"));
}

export default command;
