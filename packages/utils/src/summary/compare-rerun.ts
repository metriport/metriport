import { Command } from "commander";
import { eachPatientInComparison } from "./shared/patient-iterator";
import { generateAiSummary } from "./shared/generate-summary";
import { getConsolidatedBundle, getAiSummary } from "./shared/consolidated-bundle";
import { addToComparisonOutput } from "./shared/compare";
import { parseModelList } from "./shared/utils";
import { generatePatientHTML, generateEmptyPatientHTML } from "./shared/generate-html";
import { AI_BRIEF_MODELS } from "@metriport/core/command/ai-brief/shared";

/**
 * Rerun a comparison report for a given comparison directory name (the comparison ID).
 * This will iterate through each patient in the comparison, rerun the AI summaries for
 * each model, and regenerate the HTML report.
 *
 * Example usage:
 * npm run summary -- compare-rerun --cx-id <cxId> --comparison-id <comparisonId> --model-list "claude-sonnet-3.5,openai.gpt-oss-120b-1:0" --parallel
 *
 * The --parallel flag will run the reruns in parallel, which is much faster but may cause the
 * reported latency to deviate from the true values. It is important to provide the same CX ID
 * and model list as the original comparison.
 */
const command = new Command();
command.name("compare-rerun");
command.description("Rerun a comparison report for a given comparison directory name");
command.requiredOption(
  "--cx-id <cxId>",
  "The original CX ID of the customer that the comparison was run on"
);
command.requiredOption("--comparison-id <comparisonId>", "The comparison directory name to rerun");
command.requiredOption(
  "--model-list <modelList>",
  "The list of models to rerun",
  AI_BRIEF_MODELS.join(",")
);
command.option("--parallel", "Run the reruns in parallel", false);
command.option("--blind-test", "Whether to run a blind test of the comparison", false);
command.option(
  "--show-existing",
  "Whether to include the existing summary for each patient",
  false
);
command.action(rerunComparison);

async function rerunComparison({
  comparisonId,
  cxId,
  modelList,
  parallel,
  blindTest,
  showExisting,
}: {
  comparisonId: string;
  cxId: string;
  modelList: string;
  blindTest?: boolean;
  parallel: boolean;
  showExisting?: boolean;
}) {
  console.log(`Rerunning comparison ${comparisonId}...`);
  const models = parseModelList(modelList);
  const outputModels = models.concat(showExisting ? ["claude-sonnet-3.5"] : []);
  const rerunPromises: Promise<void>[] = [];

  for await (const { patientId, nextPatientId, previousPatientId } of eachPatientInComparison(
    comparisonId
  )) {
    console.log(`Rerunning comparison for patient ${patientId}...`);
    const consolidatedBundle = await getConsolidatedBundle(cxId, patientId);
    if (!consolidatedBundle) {
      console.log(`No consolidated bundle found for patient ${patientId}`);
      generateEmptyPatientHTML({ comparisonId, cxId, patientId, nextPatientId, previousPatientId });
      continue;
    }
    const rerunPromise = Promise.all(
      models
        .map(model =>
          generateAiSummary({
            bundle: consolidatedBundle,
            cxId,
            patientId,
            model,
          })
        )
        .concat(
          showExisting
            ? [
                Promise.resolve({
                  summary: getAiSummary(consolidatedBundle) ?? "",
                  durationInMs: 0,
                  inputTokensUsed: 0,
                  outputTokensUsed: 0,
                }),
              ]
            : []
        )
    ).then(summaries => {
      addToComparisonOutput(comparisonId, patientId, outputModels, summaries);
      generatePatientHTML({
        comparisonId,
        cxId,
        patientId,
        nextPatientId,
        previousPatientId,
        models: outputModels,
        summaries,
        blindTest,
      });
    });

    if (parallel) {
      rerunPromises.push(rerunPromise);
    } else {
      await rerunPromise;
    }
  }
  if (parallel) {
    await Promise.allSettled(rerunPromises);
  }
}

export default command;
