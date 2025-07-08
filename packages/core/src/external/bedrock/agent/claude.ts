import { BedrockAgentConfig, BedrockAgentResponse } from "./types";
import { BedrockAgentThread } from "./thread";
import { BedrockTool } from "./tool";
import { ClaudeSonnet, ClaudeSonnetResponse, ClaudeSonnetVersion } from "../model/claude-sonnet";
import { InvokeToolCall } from "../types";

export interface ClaudeAgentConfig extends BedrockAgentConfig {
  version: ClaudeSonnetVersion;
}

// Default parameters for Claude requests
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0;

/**
 * An agent creates BedrockAgentThread instances to manage conversations, memory, and tool calls with the underlying BedrockClient.
 */
export class ClaudeAgent {
  private model: ClaudeSonnet;
  private config: BedrockAgentConfig;
  private tools?: BedrockTool[] | undefined;

  constructor(config: ClaudeAgentConfig) {
    this.model = new ClaudeSonnet(config.version, config.region);
    this.config = config;
    this.tools = config.tools;
  }

  async invokeWithUserMessage(messageText: string): Promise<BedrockAgentResponse> {
    const thread = new BedrockAgentThread();
    thread.addUserMessage(messageText);
    return this.invokeThread(thread);
  }

  async invokeThread(thread: BedrockAgentThread): Promise<BedrockAgentResponse> {
    const response = await this.model.invoke({
      system: this.config.systemPrompt,
      messages: thread.getMessages(),
      ...(this.tools ? { tools: this.tools.map(tool => tool.getInvocation()) } : {}),
      max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
    });

    // Execute the tool call and push the tool result onto the thread
    if (this.tools && response.stop_reason === "tool_use") {
      const toolCall = getToolCallOrFail(response);
      const tool = this.tools.find(tool => tool.getName() === toolCall.name);
      if (!tool) throw new Error(`Tool ${toolCall.name} not found`);

      thread.addToolCall(toolCall);
      try {
        const toolResult = await tool.execute(toolCall.input);
        thread.addToolResult(toolCall, toolResult);
        return { response, toolCall, toolResult };
      } catch (toolError) {
        thread.addToolError(toolCall, toolError);
        return { response, toolCall, toolError };
      }
    }

    return { response };
  }
}

// Validate a tool call
function getToolCallOrFail(response: ClaudeSonnetResponse): InvokeToolCall {
  const latestMessage = response.content[response.content.length - 1];
  if (!latestMessage) throw new Error("Unexpected empty response");

  if (latestMessage.type !== "tool_use") {
    throw new Error(`Expected tool call, but got ${latestMessage.type}`);
  }

  return latestMessage as InvokeToolCall;
}
