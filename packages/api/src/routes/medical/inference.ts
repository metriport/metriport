import { uuidv7 } from "@metriport/shared/util";
import { createSession } from "better-sse";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { z } from "zod";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";
import { AnthropicAgent } from "@metriport/core/external/bedrock/agent/anthropic";
import { AnthropicMessageText } from "@metriport/core/external/bedrock/model/anthropic/messages";

const router = Router();

const sidePanelInferenceSchema = z.object({
  resourceType: z.string(),
  resourceDisplays: z.array(z.string()),
  context: z.string(),
});

router.get(
  "/health",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).send("OK");
  })
);

const questionsByResourceType = {
  DiagnosticReport: [
    "Why was this done?",
    "Are there any notes associated?",
    "What was the context in which this lab was taken?",
  ],
  Condition: [
    "When was this diagnosed and by who?",
    "What is the reasoning for the diagnosis",
    "Are there any related notes on the diagnosis",
  ],
};

const defaultQuestions = [
  "Why is this important?",
  "Are there any related notes?",
  "What is the important context surrounding this?",
];

/** ---------------------------------------------------------------------------
 * POST /internal/inference/side-panel
 *
 * Creates or updates a feedback (group of multiple feedback entries).
 */
router.post(
  "/side-panel",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    // const cxId = getCxIdOrFail(req);
    const { resourceType, resourceDisplays, context } = sidePanelInferenceSchema.parse(req.body);
    console.log(`resourceType: ${resourceType}, resourceDisplays: ${resourceDisplays.join(", ")}`);

    const sse = await createSession(req, res, {
      state: {
        id: uuidv7(),
        name: "Side Panel Inference",
        description: "Side Panel Inference",
        startTimeMillis: Date.now().toString(),
        endTimeMillis: Date.now().toString(),
      },
    });

    const agent = new AnthropicAgent<"claude-sonnet-3.7">({
      version: "claude-sonnet-3.7",
      region: "us-west-2",
      systemPrompt: `You are seasoned physician who answers questions given a patient's comprehensive medical record.`,
      maxTokens: 1024,
      temperature: 0,
      tools: [],
    });

    sse.push({
      message: "Request received!",
      eventName: "side-panel-request",
      eventId: uuidv7(),
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

    const response = await agent.continueConversation();
    sse.push({
      message: (response.content[response.content.length - 1] as AnthropicMessageText).text,
      eventName: "side-panel-response",
      eventId: uuidv7(),
    });
  })
);

export default router;
