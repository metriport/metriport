import { Command } from "commander";
import { getAiSummary, getConsolidatedBundle } from "./shared/consolidated-bundle";
import { generateAiSummary } from "./shared/generate-summary";
import { AiSummaryOutput } from "./shared/compare";
import { parseModelList } from "./shared/utils";
import { AI_BRIEF_MODELS } from "@metriport/core/command/ai-brief/shared";

/**
 * Compare the performance of various LLM models for a specific patient, and output the results to the console.
 *
 * Example usage:
 * npm run summary -- compare-patient --cx-id <cxId> --patient-id <patientId>
 */
const command = new Command();
command.name("compare-patient");
command.description("Compare the performance of various LLM models for a specific patient");
command.requiredOption("--cx-id <cxId>", "The ID of the customer");
command.requiredOption("--patient-id <patientId>", "The ID of the patient");
command.option(
  "--model-list <modelList>",
  "Comma-separated list of models to compare",
  AI_BRIEF_MODELS.join(",")
);
command.action(comparePatient);

async function comparePatient({
  cxId,
  patientId,
  modelList,
}: {
  cxId: string;
  patientId: string;
  modelList: string;
}) {
  const models = parseModelList(modelList);
  console.log(`Comparing ${models.join(", ")} for patient ${patientId}...`);
  const consolidatedBundle = await getConsolidatedBundle(cxId, patientId);
  if (!consolidatedBundle) {
    throw new Error("No consolidated bundle found for patient");
  }
  const existingAiSummary = getAiSummary(consolidatedBundle);
  if (!existingAiSummary) {
    console.log(`No existing AI summary found!!!!`);
  }
  const summaries: AiSummaryOutput[] = [];
  for (const model of models) {
    console.log(`Generating with ${model}...`);
    const summary = await generateAiSummary({
      bundle: consolidatedBundle,
      cxId,
      patientId,
      model,
    });
    summaries.push(summary);
  }

  console.log(`========================================`);
  console.log(`Results:`);
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const summary = summaries[i];
    console.log(`${model} - ${(summary.durationInMs / 1000).toFixed(2)} seconds`);
  }
  console.log(`========================================`);
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const summary = summaries[i];
    console.log(
      `${model} - (${summary.inputTokensUsed} input tokens, ${summary.outputTokensUsed} output tokens)`
    );
    console.log(`${summary.summary}`);
    console.log(`========================================`);
  }
}

export default command;
