import { Resource } from "@medplum/fhirtypes";
import {
  defaultQuestions,
  getPrompt,
  questionsByResourceType,
  systemPrompt,
} from "@metriport/core/command/llm/inference/prompts";
import { summarizeResource } from "@metriport/core/command/llm/inference/resources";
import { escapeCsvValue } from "@metriport/core/command/patient-import/csv/shared";
import { out } from "@metriport/core/util/log";
import { BadRequestError, errorToString } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util";
import { createSession } from "better-sse";
import { Request, Response } from "express";
import Router from "express-promise-router";
import fs from "fs";
import { Groq } from "groq-sdk";
import path from "path";
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

let lastRequestTime = 0;

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

    // TODO REMOVE THIS: avoiding duplicate requests from FE on local
    // TODO REMOVE THIS: avoiding duplicate requests from FE on local
    // TODO REMOVE THIS: avoiding duplicate requests from FE on local
    const now = Date.now();
    if (now - lastRequestTime < 3_000) {
      return;
    }
    lastRequestTime = now;

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

    const questions =
      questionsByResourceType[resourceType as keyof typeof questionsByResourceType] ??
      defaultQuestions;
    const prompt = getPrompt({
      resourceType,
      resourceDisplays,
      resourcesAsString: context,
      questions,
    });
    log(`Input (${prompt.length} chars):\n\n${prompt}\n`);

    appendToCsv({ type: "", content: "" });
    appendToCsv({ type: "", content: "" });
    appendToCsv({ type: "", content: "" });
    appendToCsv({
      type: resourceDisplays.join(", "),
      content: prompt,
      duration: 0,
      inputTokens: 0,
      outputTokens: 0,
    });

    const prefix = "+++++++++++++++++";
    const separator = `>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`;
    console.log(separator);

    const startTimeGroq = Date.now();
    const {
      output: message,
      inputTokens,
      outputTokens,
    } = await askGroq({
      context,
      resourceType,
      resourceDisplays,
      model: "openai/gpt-oss-20b",
    });
    console.log(
      `${prefix} Groq 20b (duration ${
        Date.now() - startTimeGroq
      }ms, input ${inputTokens}, output ${outputTokens}):\n\n${message}\n${separator}`
    );
    appendLlmResponseToCsv({
      model: "openai/gpt-oss-20b",
      response: message,
      duration: Date.now() - startTimeGroq,
      inputTokens,
      outputTokens,
      resourceType,
      resourceDisplays,
    });

    const startTimeGroq120b = Date.now();
    askGroq({
      context,
      resourceType,
      resourceDisplays,
      model: "openai/gpt-oss-120b",
    }).then(({ output: message, inputTokens, outputTokens }) => {
      console.log(
        `${prefix} Groq 120b (duration ${
          Date.now() - startTimeGroq120b
        }ms, input ${inputTokens}, output ${outputTokens}):\n\n${message}\n${separator}`
      );
      appendLlmResponseToCsv({
        model: "openai/gpt-oss-120b",
        response: message,
        duration: Date.now() - startTimeGroq120b,
        inputTokens,
        outputTokens,
        resourceType,
        resourceDisplays,
      });
    });

    // askOllama({ system: systemPrompt, userPrompt: prompt });

    const startTimeClaude4 = Date.now();
    summarizeResource({
      resourceType,
      resourceDisplays,
      resources: resourcesAsArray,
      model: "claude-sonnet-4",
    })
      .then(msg => {
        console.log(
          `${prefix} Claude 4 (duration ${
            Date.now() - startTimeClaude4
          }ms):\n\n${msg}\n${separator}`
        );
        appendLlmResponseToCsv({
          model: "claude-sonnet-4",
          response: msg,
          duration: Date.now() - startTimeClaude4,
          inputTokens: 0,
          outputTokens: 0,
          resourceType,
          resourceDisplays,
        });
      })
      .catch(error => {
        console.error(`>>> Claude 4 error: ${errorToString(error)}`);
      });

    const startTimeClaude3_7 = Date.now();
    summarizeResource({
      resourceType,
      resourceDisplays,
      resources: resourcesAsArray,
      model: "claude-sonnet-3.7",
    })
      .then(msg => {
        console.log(
          `${prefix} Claude 3.7 (duration ${
            Date.now() - startTimeClaude3_7
          }ms):\n\n${msg}\n${separator}`
        );
        appendLlmResponseToCsv({
          model: "claude-sonnet-3.7",
          response: msg,
          duration: Date.now() - startTimeClaude3_7,
          inputTokens: 0,
          outputTokens: 0,
          resourceType,
          resourceDisplays,
        });
      })
      .catch(error => {
        console.error(`>>> Claude 3.7 error: ${errorToString(error)}`);
      });

    // const message = await summarizeResource({
    //   resourceType,
    //   resourceDisplays,
    //   resources: resourcesAsArray,
    // });

    sse.push({
      message,
      eventName: "side-panel-response",
      eventId: uuidv7(),
    });

    // return res.status(200).send(message);
  })
);

function appendLlmResponseToCsv(data: {
  resourceType: string;
  resourceDisplays: string[];
  model: string;
  response: string | undefined;
  duration: number;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}): void {
  appendToCsv({
    type: data.model,
    content: data.response,
    duration: data.duration,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
  });
}
function appendToCsv(data: {
  type: string;
  content: string | undefined;
  duration?: number | undefined;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}): void {
  const csvHeader = ["type", "content", "duration", "inputTokens", "outputTokens"];
  // const csvHeader = ["resourceType", "resourceDisplays", "model", "inputTokens", "outputTokens"];

  const csvFilePath = path.join(__dirname, "inference.csv");
  if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, csvHeader.join(",") + "\n");
  }
  const csvContentRaw = [
    data.type,
    data.content,
    data.duration,
    data.inputTokens,
    data.outputTokens,
  ];
  const csvContent: (string | undefined)[] = [];
  for (const content of csvContentRaw) {
    const theContent = content?.toString() ?? "";
    csvContent.push(escapeCsvValue(theContent));
  }
  //   data.resourceType,
  //   data.resourceDisplays,
  //   data.model,
  //   data.inputTokens,
  //   data.outputTokens,
  // ];
  fs.appendFileSync(csvFilePath, csvContent.join(",") + "\n");
}

async function askGroq({
  context,
  resourceType,
  resourceDisplays,
  model,
}: {
  context: string;
  resourceType: string;
  resourceDisplays: string[];
  model: string;
}): Promise<{
  output: string | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}> {
  // const baseUrl = "http://0.0.0.0:11434";
  // const model = "medllama2:7b";
  const questions =
    questionsByResourceType[resourceType as keyof typeof questionsByResourceType] ??
    defaultQuestions;
  const prompt = getPrompt({
    resourceType,
    resourceDisplays,
    resourcesAsString: context,
    questions,
  });

  try {
    const groq = new Groq();

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model,
      temperature: 0,
      max_completion_tokens: 8192,
      top_p: 1,
      stream: false,
      reasoning_effort: "medium",
      stop: null,
    });

    chatCompletion.usage?.completion_tokens;
    const message = chatCompletion.choices[0]?.message.content ?? undefined;
    return {
      output: message,
      inputTokens: chatCompletion.usage?.prompt_tokens,
      outputTokens: chatCompletion.usage?.completion_tokens,
    };
  } catch (error) {
    console.error(`>>> Groq error:`, error);
    return { output: undefined, inputTokens: undefined, outputTokens: undefined };
  }
}

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
