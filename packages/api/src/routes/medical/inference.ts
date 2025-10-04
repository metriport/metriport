import { Resource } from "@medplum/fhirtypes";
import { summarizeResource } from "@metriport/core/command/llm/inference/resources";
import { out } from "@metriport/core/util/log";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util";
import { createSession } from "better-sse";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { z } from "zod";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).send("OK");
  })
);

const sidePanelInferenceSchema = z.object({
  resourceType: z.string(),
  resourceDisplays: z.array(z.string()),
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
    const { log } = out(`side-panel`);

    // const cxId = getCxIdOrFail(req);
    const { resourceType, resourceDisplays, context } = sidePanelInferenceSchema.parse(req.body);

    const resources = JSON.parse(context);
    let resourcesAsArray: Resource[] = [];
    if (Array.isArray(resources)) {
      resourcesAsArray = resources;
    } else if (typeof resources === "object" && "entry" in resources) {
      resourcesAsArray = resources.entry;
    } else {
      throw new BadRequestError("Invalid resources");
    }
    log(
      `resourceType: ${resourceType}, resourceDisplays: ${resourceDisplays.join(
        ", "
      )}, res count: ${resourcesAsArray.length}`
    );

    const sse = await createSession(req, res, {
      state: {
        id: uuidv7(),
        name: "Side Panel Inference",
        description: "Side Panel Inference",
        startTimeMillis: Date.now().toString(),
        endTimeMillis: Date.now().toString(),
      },
    });

    sse.push({
      message: "Request received!",
      eventName: "side-panel-request",
      eventId: uuidv7(),
    });

    // askOllama({ system: systemPrompt, userPrompt: prompt });
    const message = await summarizeResource({
      resourceType,
      resourceDisplays,
      resources: resourcesAsArray,
    });

    sse.push({
      message,
      eventName: "side-panel-response",
      eventId: uuidv7(),
    });
  })
);

async function askOllama({ system, userPrompt }: { system: string; userPrompt: string }) {
  const baseUrl = "http://0.0.0.0:11434";
  const model = "medllama2:7b";
  try {
    const result = await generateWithOllama({
      baseUrl,
      model,
      system,
      prompt: userPrompt,
      // messages: [
      //   {
      //     role: "system",
      //     content: `You are seasoned physician who answers questions given a patient's comprehensive medical record.`,
      //   },
      //   {
      //     role: "user",
      //     content: userPrompt,
      //   },
      // ],
      stream: false,
      options: { temperature: 0 },
    });
    const message = result.response;
    // const result = await chatWithOllama({
    //   baseUrl,
    //   model,
    //   system,
    //   messages: [
    //     {
    //       role: "user",
    //       content: userPrompt,
    //     },
    //   ],
    //   stream: false,
    //   options: { temperature: 0 },
    // });
    // const message = result.message.content;
    console.log(`>>> Ollama response:\n${message}\n`);
    return message;
  } catch (error) {
    console.error(`>>> Ollama error:`, error);
    return null;
  }
}

interface GenerateRequest {
  baseUrl: string;
  model: string;
  prompt: string;
  system: string;
  stream?: boolean;
  options?: {
    temperature?: number;
  };
}
interface ChatRequest {
  baseUrl: string;
  model: string;
  system: string;
  messages: {
    role: string;
    content: string;
  }[];
  stream?: boolean;
  options?: {
    temperature?: number;
  };
}

interface GenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}
interface ChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

async function generateWithOllama(req: GenerateRequest): Promise<GenerateResponse> {
  const { baseUrl, ...llmParams } = req;
  const endpoint = "/api/generate";
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(llmParams),
  });
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText} - ${await response.text()}`);
  }
  return (await response.json()) as GenerateResponse;
}

async function chatWithOllama(req: ChatRequest): Promise<ChatResponse> {
  const { baseUrl, ...llmParams } = req;
  const endpoint = "/api/chat";
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(llmParams),
  });
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText} - ${await response.text()}`);
  }
  return (await response.json()) as ChatResponse;
}

export default router;
