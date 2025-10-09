import { Command } from "commander";
import { OrchestratorAgent } from "@metriport/core/external/comprehend/agent/orchestrator-agent";
import type { ComprehendContext } from "@metriport/core/external/comprehend/types";

import { startInteractive, promptUser } from "../anthropic/shared";

/**
 * Tests the orchestrator agent.
 */
const command = new Command();
command.name("test-agent");
command.description("Test the agent");
command.action(runInteractive);

async function runInteractive() {
  const context: ComprehendContext = {
    patientId: "abc-123-456",
    dateNoteWritten: "2025-01-01",
    encounterId: "abc-123-def",
  };

  const aggregateInput: string[] = [];

  startInteractive();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Get user input, and
    const input = await promptUser();
    if (input === "") {
      await runExtraction(aggregateInput.join("\n"), context);
      console.log("Done");
    } else {
      aggregateInput.push(input);
    }
  }
}

async function runExtraction(input: string, context: ComprehendContext) {
  console.log("Running extraction", input);
  const agent = new OrchestratorAgent(context);
  const bundle = await agent.extractFhirBundle(input);
  console.log(JSON.stringify(bundle, null, 2));
}

export default command;
