import { Command } from "commander";
import { samplePatientIds } from "./shared/utils";
import { eachPatient } from "./shared/patient-iterator";
import { generateAiSummary } from "./shared/generate-summary";
import { addToComparisonOutput, addToComparisonSummary } from "./shared/compare";
import { startComparisonCsv } from "./shared/compare";
import {
  generatePatientHTML,
  generateEmptyPatientHTML,
  openComparisonReport,
} from "./shared/generate-html";
import { parseModelList } from "./shared/utils";
import { AI_BRIEF_MODELS } from "@metriport/core/command/ai-brief/shared";

/**
 * Generate a comparison of multiple AI summaries and generates an HTML report for each patient,
 * making it easier to compare different LLM models side-by-side and page through multiple examples.
 *
 * Example usage:
 * npm run summary -- compare-report --cx-id <cxId> --model-list "claude-sonnet-3.5,openai.gpt-oss-120b-1:0" --total-patients 10
 */
const command = new Command();
command.name("compare-report");
command.requiredOption("--cx-id <cx-id>", "The CX ID to generate the report for");
command.option(
  "--total-patients <total-patients>",
  "The total number of patients to generate the report for"
);
command.option(
  "--model-list <model-list>",
  "List of models to generate comparison for",
  AI_BRIEF_MODELS.join(",")
);
command.option("--blind-test", "Whether to generate a report for blind testing");
command.description("Generate a comparison report between multiple AI summaries");
command.action(generateComparison);

async function generateComparison({
  cxId,
  totalPatients,
  modelList,
  blindTest,
}: {
  cxId: string;
  totalPatients?: string;
  modelList?: string;
  blindTest?: boolean;
}) {
  const patientIds = await samplePatientIds(cxId, totalPatients);
  const models = parseModelList(modelList);

  console.log(
    `Generating comparison report for ${models.join(", ")} with ${patientIds.length} patients...`
  );
  const { summaryFile, comparisonId } = startComparisonCsv(models);
  for await (const {
    patientId,
    consolidatedBundle,
    nextPatientId,
    previousPatientId,
  } of eachPatient(cxId, patientIds)) {
    if (!consolidatedBundle) {
      console.log(`No consolidated bundle found for patient ${patientId}`);
      generateEmptyPatientHTML({ comparisonId, cxId, patientId, nextPatientId, previousPatientId });
      continue;
    }

    const summaries = await Promise.all(
      models.map(model =>
        generateAiSummary({
          bundle: consolidatedBundle,
          cxId,
          patientId,
          model,
        })
      )
    );
    addToComparisonSummary(summaryFile, patientId, consolidatedBundle, summaries);
    addToComparisonOutput(comparisonId, patientId, models, summaries);
    generatePatientHTML({
      comparisonId,
      cxId,
      patientId,
      nextPatientId,
      previousPatientId,
      models,
      summaries,
      blindTest,
    });
  }
  openComparisonReport(comparisonId, patientIds);
}

export default command;
