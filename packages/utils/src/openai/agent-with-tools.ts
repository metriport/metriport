import { z } from "zod";
import { Command } from "commander";
import { OpenAIAgent } from "@metriport/core/external/openai/agent";
import { OpenAITool } from "@metriport/core/external/openai/tool";
import { logResponse, promptUser, startInteractive } from "./shared";

/**
 * This command allows you to run an OpenAI agent with tools. The agent will first call the `cityLocation` tool to get the location of a city,
 * then call the `weather` tool to get the weather at that location. The agent will continue to call tools until it has enough information to answer the user's question.
 *
 * Usage:
 * npm run openai -- agent-with-tools
 */
const command = new Command();
command.name("agent-with-tools");
command.description("Example of an OpenAI agent with tools");
command.action(runAgentWithTools);

const exitCommand = "bye";

/**
 * Example of an OpenAI agent with tools. The agent first calls the `cityLocation` tool to get the location of a city,
 * then calls the `weather` tool to get the weather at that location. The agent will continue to call tools until it has
 * enough information to answer the user's question.
 */
async function runAgentWithTools() {
  const cityLocationTool = new OpenAITool({
    name: "cityLocation",
    description: "Get the location of a city",
    inputSchema: z.object({
      city: z.string(),
      state: z.string().optional(),
    }),
    outputSchema: z.object({ latitude: z.number(), longitude: z.number() }),
    // The handler should usually be defined as a regular function declaration, and referenced by name in the tool setup
    handler: async input => {
      console.log(`Getting location of ${input.city} ${input.state ? `, ${input.state}` : ""}`);
      return { latitude: 1.2345, longitude: 2.3456 };
    },
  });

  const weatherTool = new OpenAITool({
    name: "weather",
    description: "Get the weather of a city",
    inputSchema: z.object({ latitude: z.number(), longitude: z.number() }),
    outputSchema: z.object({ temperature: z.number(), units: z.string(), humidity: z.number() }),
    handler: async input => {
      console.log(`Getting weather for (${input.latitude}, ${input.longitude})`);
      return {
        temperature: 20 + Math.floor(Math.random() * 15),
        units: "C",
        humidity: Math.floor(Math.random() * 100),
      };
    },
  });

  const agent = new OpenAIAgent({
    systemPrompt: `You are a helpful assistant that can get the location of a city (latitude and longitude), and the weather at a particular location.
    Use the provided tools to answer the user's question. Try to infer the state from the city name if it is not provided.`,
    maxTokens: 1024,
    temperature: 0,
    tools: [cityLocationTool, weatherTool],
  });

  startInteractive();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = await promptUser();
    if (input.toLowerCase() === exitCommand) {
      process.exit(0);
    }
    // Add the user message to the conversation history
    agent.addUserMessage(input);
    let response = await agent.continueConversation();
    while (agent.shouldExecuteTools(response)) {
      await agent.executeTools(response);
      response = await agent.continueConversation();
    }
    logResponse(response);
  }
}

export default command;
