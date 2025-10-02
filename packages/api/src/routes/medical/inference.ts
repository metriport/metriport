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
  context: z.string(),
});

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
    const { context } = sidePanelInferenceSchema.parse(req.body);

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
      region: "us-east-1",
      systemPrompt: `You are a helpful assistant that can answer questions about the user's context.`,
      maxTokens: 1024,
      temperature: 0,
      tools: [],
    });

    sse.push({
      message: "Request received!",
      eventName: "side-panel-request",
      eventId: uuidv7(),
    });

    agent.addUserMessageText(context);
    const response = await agent.continueConversation();

    sse.push({
      message: (response.content[response.content.length - 1] as AnthropicMessageText).text,
      eventName: "side-panel-response",
      eventId: uuidv7(),
    });
  })
);

export default router;
