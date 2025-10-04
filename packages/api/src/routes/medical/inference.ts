import { summarizeResource } from "@metriport/core/command/llm/inference/resources";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../util";
import { AnthropicAgent } from "@metriport/core/external/bedrock/agent/anthropic";
import { AnthropicMessageText } from "@metriport/core/external/bedrock/model/anthropic/messages";
import { reportMetric } from "@metriport/core/external/aws/cloudwatch";
import { initTimer } from "@metriport/shared/common/timer";

const router = Router();

const resourceSummaryInferenceSchema = z.object({
  resourceType: z.string(),
  resourceDisplays: z.array(z.string()),
  resourceRowData: z.record(z.unknown()).optional(),
  context: z.string(),
  suspectsContext: z.string().optional(),
});

const questionsByResourceType = {
  AllergyIntolerance: [
    "- What type of reaction occurred (symptoms/manifestations)?",
    "- How severe was the reaction, and is this life-threatening?",
    "- When was this allergy first identified?",
    "- Are there any related allergies or cross-reactivities to be aware of?",
  ],
  Condition: [
    "- How was this diagnosed?",
    "- How did this come to be?",
    "- Where, when, and by whom was this diagnosed?",
    "- Is there any documentation (notes, reports, imaging) associated with this condition? If so, what are they?",
    "- If present, what is the plan to treat this resource in the future? Are there any follow-up appointments, medications, or other plans in the source document?",
  ],
  MedicationStatement: [
    "- What condition is this medication treating (indication)?",
    "- What is the dosage, frequency, and duration?",
    "- Is the patient currently taking this medication, or has it been discontinued?",
    "- Who prescribed this medication and when?",
  ],
  Procedure: [
    "- Why was this procedure performed (indication)?",
    "- When and where was it performed, and by whom?",
    "- Were there any complications or adverse events?",
    "- What were the outcomes or findings from this procedure?",
  ],
  Encounter: [
    "- What was the reason for this visit (chief complaint)?",
    "- What diagnoses were made or conditions addressed during this encounter?",
    "- What treatments or interventions were provided?",
    "- What was the disposition (admitted, discharged home, follow-up plans)?",
  ],
  Immunization: [
    "- What vaccine was administered and for which disease?",
    "- When was it given, and which dose in the series is this?",
    "- Were there any adverse reactions or side effects?",
    "- When is the next dose due, if applicable?",
  ],
  DiagnosticReport: [
    "- If a test, why was this test ordered?",
    "- What were the key findings or results?",
    "- Are there any abnormal values that require attention?",
    "- What clinical notes or interpretation are provided?",
  ],
  Observation: [
    "- What was measured and what is the value?",
    "- Is this value normal, or does it indicate an abnormality?",
    "- Why was this observation made (clinical context)?",
    "- How does this compare to previous measurements (trend)?",
  ],
  Suspects: [
    "- Why was this suspect created?",
    "- What are the related resources that are responsible for this suspect?",
    "- Other key observations related to this suspect?",
  ],
};

const defaultQuestions = [
  "Why is this important?",
  "Are there any related notes?",
  "What is the important context surrounding this?",
];

/** ---------------------------------------------------------------------------
 * POST /internal/inference/resource/summary
 *
 * Runs a Q&A style summary over some context surrounding a resource.
 * Returns a JSON response with the AI-generated summary.
 */
router.post(
  "/resource/summary",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const { resourceType, resourceDisplays, resourceRowData, context, suspectsContext } =
      resourceSummaryInferenceSchema.parse(req.body);
    console.log(`resourceType: ${resourceType}, resourceDisplays: ${resourceDisplays.join(", ")}`);

    const agent = new AnthropicAgent({
      version: "claude-sonnet-3.7",
      region: "us-west-2",
      systemPrompt: `You are seasoned physician who answers questions given a patient's comprehensive medical record.`,
      maxTokens: 1024,
      temperature: 0,
      tools: [],
    });

    const questions =
      questionsByResourceType[resourceType as keyof typeof questionsByResourceType] ??
      defaultQuestions;

    const resourceRowDataString = resourceRowData
      ? `The core data for the resource we are asking about is: ${JSON.stringify(
          resourceRowData,
          null,
          2
        )}`
      : "";

    // Build context based on resource type
    let finalContext = context;
    if (resourceType === "Suspects" && suspectsContext) {
      finalContext = `
## Suspect Analysis Context

The following FHIR resources were identified as responsible for creating this suspect:

${suspectsContext}

---

## Patient's Medical Record Context
${context}
`;
    }

    agent.addUserMessageText(
      `
      This is about a patient.
      The resource type is: ${resourceType}
      The resource displays are: ${resourceDisplays.join(", ")}
      ${resourceRowDataString}

      ---

      ### Citing claims
      In your response, create a source list at the bottom. These sources MUST use markdown link syntax, but have the link point to the UUID of the resource that contains proof of the claim.
      Each source should look like: \`[{source-index} - {phrase}](uuid-of-source-resource)\` where {source-index} is a number, {phrase} is a short two or three wordphrase that describes the source, such as "glucose measurement", "urinalysis", "", etc.

      If a source is referenced multiple times, include it exactly once, and no more, in the source list.

      \`\`\`
      Sources:
      - [1 - {phrase}](uuid-of-source-resource1)
      - [2 - {phrase}](uuid-of-source-resource2)
      - [3 - {phrase}](uuid-of-source-resource3)
      ... etc.
      \`\`\`

      Then, ensure to include a source for each and every claim you make, using syntax \`_({source-index})_\` at the end of each claim.

      ### Questions

      Answer the following question(s):
      ${questions.join("\n")}

      If you ever don't know the a piece of information, instead of saying so, simply say nothing about it.

      Keep your answer concise, in bullet point form.

      The patient's medical record is:
      ${finalContext}
      `
    );

    const timer = initTimer();
    const response = await agent.continueConversation();
    const duration = timer.getElapsedTime();

    await Promise.all([
      reportMetric({
        name: "LLM.ResourceSummary.Duration",
        unit: "Milliseconds",
        value: duration,
        additionalDimension: `ResourceType=${resourceType},cxId=${cxId}`,
      }),
      reportMetric({
        name: "LLM.ResourceSummary.InputTokens",
        unit: "Count",
        value: response.usage.input_tokens,
        additionalDimension: `ResourceType=${resourceType},cxId=${cxId}`,
      }),
      reportMetric({
        name: "LLM.ResourceSummary.OutputTokens",
        unit: "Count",
        value: response.usage.output_tokens,
        additionalDimension: `ResourceType=${resourceType},cxId=${cxId}`,
      }),
    ]);

    const message = await summarizeResource({
      resourceType,
      resourceDisplays,
      resources: resourcesAsArray,
    });
    console.log(`>>> summarizeResource response:\n${message}\n`);

    const responseText = (response.content[response.content.length - 1] as AnthropicMessageText)
      .text;

    return res.status(status.OK).json({ summary: responseText });
  })
);

export default router;
