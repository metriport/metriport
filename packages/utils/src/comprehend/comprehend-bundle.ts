import { Command } from "commander";
import { DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { ComprehendExtractionSource } from "@metriport/core/external/comprehend/source";

const program = new Command();

program
  .name("bundle")
  .description("Run AWS Comprehend on a bundle")
  .option("--cx-id <cx-id>", "The customer ID")
  .option("--patient-id <patient-id>", "The patient ID")
  .action(async ({ cxId, patientId }: { cxId?: string; patientId?: string }) => {
    if (!cxId) throw new Error("CX ID is required");
    if (!patientId) throw new Error("Patient ID is required");

    const source = new ComprehendExtractionSource();
    const bundle = await source.getConsolidatedBundle(cxId, patientId);

    const observationMap: Record<string, Observation> = {};
    bundle.entry?.forEach(({ resource }) => {
      if (!resource) return;
      if (resource.resourceType === "Observation") {
        const observation = resource as Observation;
        if (observation.id) {
          observationMap["Observation/" + observation.id] = observation;
        }
      }
    });

    bundle.entry?.forEach(({ resource }) => {
      if (!resource) return;
      if (resource.resourceType === "DiagnosticReport") {
        const report = resource as DiagnosticReport;
        if (!report.presentedForm || !report.result) return;

        console.log("____ DIAGNOSTIC REPORT _____");
        console.log(report.code?.text);

        const observations = report.result
          .map(({ reference }) => {
            if (!reference) return null;
            return observationMap[reference];
          })
          .filter(Boolean);
        if (observations.length === 0) return;

        console.log("--------------------------------");
        console.log("OBSERVATIONS");
        observations.forEach(observation => {
          console.log(observation?.code?.text);
        });

        report.presentedForm?.forEach(({ data }) => {
          if (data != null) {
            const text = Buffer.from(data, "base64").toString("utf-8");
            console.log("--------------------------------");
            console.log(text);
            console.log("--------------------------------");
          }
        });
      }
    });
  });

export default program;
