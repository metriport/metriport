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
  context: z.string(),
});

const questionsByResourceType = {
  DiagnosticReport: [
    "Why was this done?",
    "Are there any notes associated?",
    "What was the context in which this lab was taken?",
  ],
  Condition: [
    "- How was this diagnosed?",
    "- How did this come to be?",
    "- Where, when, and by whom was this diagnosed?",
    "- Is there any documentation (notes, reports, imaging) associated with this condition? If so, what are they?",
    "- If present, what is the plan to treat this resource in the future? Are there any follow-up appointments, medications, or other plans in the source document?",
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
    const { resourceType, resourceDisplays, context } = resourceSummaryInferenceSchema.parse(
      req.body
    );
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

    agent.addUserMessageText(
      `
      This is about a patient - ${resourceType}: ${resourceDisplays.join(", ")}
      Answer the following question(s):
      ${questions.join("\n")}

      In your response, please include a source for each and every claim. These sources should use markdown link syntax, but refer to the UUID of the resource that contains proof of the claim. Each reference should look like: [view](uuid-of-source-resource). Keep your answer concise, in bullet point form.

      The patient's medical record is:
      ${context}
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

    const responseText = (response.content[response.content.length - 1] as AnthropicMessageText)
      .text;

    return res.status(status.OK).json({ summary: responseText });
  })
);

export default router;
