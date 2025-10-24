import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { FhirBundleSdk, LLMContextOptions } from "@metriport/fhir-sdk";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { initRunsFolder } from "../shared/folder";

/**
 * This script generates LLM context from a FHIR bundle resource.
 *
 * Given a FHIR bundle file and a resource ID, it will:
 * 1. Load the bundle into the FHIR SDK
 * 2. Find the specified resource
 * 3. Generate LLM-friendly context using the resource and its references
 * 4. Output the context to stdout or save to a file
 *
 * Usage:
 * $ ts-node src/fhir-sdk/generate-llm-context.ts \
 *     --bundle-path /path/to/bundle.json \
 *     --resource-id abc123 \
 *     --max-depth 3 \
 *     --format json \
 *     --output output-file
 */

type ScriptParams = {
  bundlePath: string;
  resourceId: string;
  maxDepth: number;
  includeStartResource: boolean;
  format: "structured-text" | "json";
  output?: string;
};

async function main() {
  const program = new Command();
  program
    .name("generate-llm-context")
    .description("Generate LLM context from a FHIR bundle resource")
    .requiredOption("-b, --bundle-path <path>", "Path to FHIR bundle JSON file")
    .requiredOption("-r, --resource-id <id>", "Resource ID to generate context for")
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

  const params: ScriptParams = {
    bundlePath: options.bundlePath,
    resourceId: options.resourceId,
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
  console.log(`>>> Starting LLM context generation...`);
  console.log(`>>> Bundle file: ${params.bundlePath}`);
  console.log(`>>> Resource ID: ${params.resourceId}`);
  console.log(`>>> Max depth: ${params.maxDepth}`);
  console.log(`>>> Include start resource: ${params.includeStartResource}`);
  console.log(`>>> Format: ${params.format}`);
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

  // Output the result
  if (params.output) {
    const extension = params.format === "json" ? "json" : "txt";
    const outputPath = path.resolve("./runs", `${params.output}.${extension}`);
    fs.writeFileSync(outputPath, llmContext, "utf-8");
    console.log(`>>> Output saved to: ${outputPath}`);
  } else {
    console.log("\n" + "=".repeat(80));
    console.log("LLM CONTEXT OUTPUT");
    console.log("=".repeat(80) + "\n");
    console.log(llmContext);
  }

  const elapsed = Date.now() - startedAt;
  console.log(`\n>>> Done in ${elapsed} ms`);
}

main();
