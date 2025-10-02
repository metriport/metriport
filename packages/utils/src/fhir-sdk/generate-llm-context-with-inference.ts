import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { FhirBundleSdk, LLMContextOptions } from "@metriport/fhir-sdk";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import axios from "axios";
import { initRunsFolder } from "../shared/folder";

/**
 * This script generates LLM context from a FHIR bundle resource and sends it to the inference endpoint.
 *
 * Given a FHIR bundle file and a resource ID, it will:
 * 1. Load the bundle into the FHIR SDK
 * 2. Find the specified resource
 * 3. Generate LLM-friendly context using the resource and its references
 * 4. Send the context to the inference API endpoint
 * 5. Handle server-sent events (SSE) to receive the inference response
 * 6. Output the results to stdout or save to a file
 *
 * Usage:
 * $ API_URL=http://localhost:8080 ts-node src/fhir-sdk/generate-llm-context-with-inference.ts \
 *     --bundle-path /path/to/bundle.json \
 *     --resource-id abc123 \
 *     --max-depth 3 \
 *     --format json \
 *     --output output-file
 *
 * Or override the API_URL with --api-url flag:
 * $ ts-node src/fhir-sdk/generate-llm-context-with-inference.ts \
 *     --bundle-path /path/to/bundle.json \
 *     --resource-id abc123 \
 *     --api-url http://localhost:8080 \
 *     --output output-file
 */

type ScriptParams = {
  bundlePath: string;
  resourceId: string;
  apiUrl: string;
  maxDepth: number;
  includeStartResource: boolean;
  format: "structured-text" | "json";
  output?: string;
};

async function main() {
  const program = new Command();
  program
    .name("generate-llm-context-with-inference")
    .description("Generate LLM context from a FHIR bundle and send to inference endpoint")
    .requiredOption("-b, --bundle-path <path>", "Path to FHIR bundle JSON file")
    .requiredOption("-r, --resource-id <id>", "Resource ID to generate context for")
    .option("-a, --api-url <url>", "Base API URL (defaults to API_URL env var)")
    .option(
      "-d, --max-depth <number>",
      "Maximum depth to traverse references",
      (val: string) => parseInt(val),
      2
    )
    .option("--no-include-start-resource", "Exclude the starting resource from output")
    .option("-f, --format <format>", "Output format (structured-text or json)", "structured-text")
    .option("-o, --output <filename>", "Save output to file (without extension)")
    .parse(process.argv);

  const options = program.opts();

  const apiUrl = options.apiUrl ?? process.env.API_URL;
  if (!apiUrl) {
    throw new Error("API URL is required. Provide --api-url or set API_URL environment variable");
  }

  const params: ScriptParams = {
    bundlePath: options.bundlePath,
    resourceId: options.resourceId,
    apiUrl,
    maxDepth: options.maxDepth,
    includeStartResource: options.includeStartResource,
    format: options.format,
    output: options.output,
  };

  try {
    await runScript(params);
    process.exit(0);
  } catch (error) {
    console.error(`>>> Error: ${error}`);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function logRunParams(params: ScriptParams): void {
  console.log(`>>> Starting LLM context generation with inference...`);
  console.log(`>>> Bundle file: ${params.bundlePath}`);
  console.log(`>>> Resource ID: ${params.resourceId}`);
  console.log(`>>> API URL: ${params.apiUrl}`);
  console.log(`>>> Max depth: ${params.maxDepth}`);
  console.log(`>>> Include start resource: ${params.includeStartResource}`);
  console.log(`>>> Format: ${params.format}`);
}

async function handleServerSentEvents(response: NodeJS.ReadableStream): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const messages: string[] = [];
    let buffer = "";

    response.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.substring(6);
          try {
            const parsed = JSON.parse(data);
            messages.push(parsed);
            console.log(`>>> SSE Event: ${parsed.eventName || "unknown"}`);
            if (parsed.message) {
              console.log(`>>> Message: ${parsed.message}`);
            }
          } catch (error) {
            console.log(`>>> Raw SSE data: ${data}`);
          }
        } else if (line.trim() === "") {
          // Empty line, end of event
          continue;
        }
      }
    });

    response.on("end", () => {
      console.log(`>>> SSE stream ended`);
      resolve(messages);
    });

    response.on("error", (error: Error) => {
      console.error(`>>> SSE stream error: ${error.message}`);
      reject(error);
    });
  });
}

async function sendToInferenceEndpoint(
  apiUrl: string,
  context: string
): Promise<{ messages: string[]; rawResponse: string }> {
  const endpoint = `${apiUrl}/internal/inference/side-panel`;
  console.log(`>>> Sending context to inference endpoint: ${endpoint}`);

  const response = await axios.post(
    endpoint,
    { context },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      responseType: "stream",
    }
  );

  const messages = await handleServerSentEvents(response.data);

  // Extract the final response message
  const lastMessage = messages[messages.length - 1];
  const rawResponse =
    typeof lastMessage === "object" && "message" in lastMessage
      ? String(lastMessage.message)
      : JSON.stringify(messages);

  return { messages, rawResponse };
}

async function runScript(params: ScriptParams) {
  initRunsFolder();
  const startedAt = Date.now();

  logRunParams(params);

  // Load the bundle
  console.log(`>>> Loading bundle from file...`);
  const bundleContent = fs.readFileSync(params.bundlePath, "utf-8");
  const bundle = JSON.parse(bundleContent) as Bundle;
  const sdk = await FhirBundleSdk.create(bundle);

  console.log(`>>> Bundle loaded successfully with ${sdk.total} entries`);

  // Find the resource
  console.log(`>>> Looking for resource with ID: ${params.resourceId}...`);
  const resource = sdk.getResourceById(params.resourceId);

  if (!resource) {
    throw new Error(`Resource with ID ${params.resourceId} not found in bundle`);
  }

  console.log(`>>> Generating LLM context...`);
  const llmOptions: LLMContextOptions = {
    maxDepth: params.maxDepth,
    includeStartResource: params.includeStartResource,
    format: params.format,
  };

  const llmContext = sdk.generateLLMContext(resource, llmOptions);

  console.log(`\n>>> LLM Context Generated (${llmContext.length} characters)`);
  console.log("=".repeat(80));
  console.log(llmContext.substring(0, 500) + "...\n");
  console.log("=".repeat(80));

  // Send to inference endpoint
  console.log(`\n>>> Sending to inference endpoint...`);
  const { messages, rawResponse } = await sendToInferenceEndpoint(params.apiUrl, llmContext);

  // Output the results
  if (params.output) {
    const outputDir = path.resolve("./runs");

    // Save the LLM context
    const contextExtension = params.format === "json" ? "json" : "txt";
    const contextPath = path.resolve(outputDir, `${params.output}-context.${contextExtension}`);
    fs.writeFileSync(contextPath, llmContext, "utf-8");
    console.log(`\n>>> Context saved to: ${contextPath}`);

    // Save the inference response
    const responsePath = path.resolve(outputDir, `${params.output}-inference.json`);
    fs.writeFileSync(responsePath, JSON.stringify(messages, null, 2), "utf-8");
    console.log(`>>> Inference response saved to: ${responsePath}`);

    // Save the raw response text
    const rawResponsePath = path.resolve(outputDir, `${params.output}-inference-text.txt`);
    fs.writeFileSync(rawResponsePath, rawResponse, "utf-8");
    console.log(`>>> Inference text saved to: ${rawResponsePath}`);
  } else {
    console.log("\n" + "=".repeat(80));
    console.log("INFERENCE RESPONSE");
    console.log("=".repeat(80) + "\n");
    console.log(rawResponse);
  }

  const elapsed = Date.now() - startedAt;
  console.log(`\n>>> Done in ${elapsed} ms`);
}

main();
