import { BedrockClient } from "../client";
import { BedrockAgentConfig, BedrockAgentResponse } from "./types";
import { BedrockAgentThread } from "./thread";
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from "../constants";
import { getToolCallOrFail } from "./util";
import { BedrockTool } from "./tool";

/**
 * An agent creates BedrockAgentThread instances to manage conversations, memory, and tool calls with the underlying BedrockClient.
 */
export class BedrockAgent {
  private config: BedrockAgentConfig;
  private client: BedrockClient;
  private tools?: BedrockTool[] | undefined;

  constructor(client: BedrockClient, config: BedrockAgentConfig) {
    this.client = client;
    this.config = config;
    this.tools = config.tools;
  }

  async invokeWithUserMessage(messageText: string): Promise<BedrockAgentResponse> {
    const thread = new BedrockAgentThread();
    thread.addUserMessage(messageText);
    return this.invokeThread(thread);
  }

  async invokeThread(thread: BedrockAgentThread): Promise<BedrockAgentResponse> {
    const response = await this.client.invokeModel({
      system: this.config.systemPrompt,
      messages: thread.getMessages(),
      ...(this.tools ? { tools: this.tools.map(tool => tool.getInvocation()) } : {}),
      max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
    });

    if (this.tools && response.stop_reason === "tool_use") {
      const toolCall = getToolCallOrFail(response);
      const tool = this.tools.find(tool => tool.getName() === toolCall.name);
      if (!tool) throw new Error(`Tool ${toolCall.name} not found`);

      thread.addToolCall(toolCall);
      try {
        const result = await tool.execute(toolCall.input);
        thread.addToolResult(toolCall, result);
        return { response, toolCall };
      } catch (error) {
        thread.addToolError(toolCall, error);
        return { response, toolCall };
      }
    }

    return { response };
  }
}
