import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Command } from "commander";
import { ComprehendClient } from "@metriport/core/external/comprehend/client";

/**
 * Build a test artifact for the Comprehend API.
 */
const command = new Command();
command.name("build-test");
command.description("Build a test artifact for the Comprehend API");
command.option("--name <name>", "The name of the test artifact");
command.argument("<input-text>", "The input text for the test artifact");

const TEST_DIR = path.join(process.cwd(), "../core/src/external/comprehend/__tests__/artifacts");

command.action(async (inputText: string, { name }: { name?: string }) => {
  await buildRxNormArtifact({ name, inputText });
});

async function buildRxNormArtifact({ name, inputText }: { name?: string; inputText: string }) {
  const client = new ComprehendClient();
  const response = await client.inferRxNorm(inputText);
  const artifactId = crypto.randomBytes(8).toString("hex");
  const artifactPath = path.join(TEST_DIR, `${name ?? artifactId}.json`);
  if (!fs.existsSync(artifactPath)) {
    fs.writeFileSync(artifactPath, JSON.stringify({ inputText, response }, null, 2));
  }
}

export default command;
