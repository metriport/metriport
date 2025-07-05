import { BedrockClient } from "./client";
import { BedrockTool } from "./tool";
import { InvokeResponse, InvokeToolCall } from "./types";
import { BedrockThread } from "./thread";
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from "./constants";

interface BedrockAgentConfig {
  systemPrompt: string;
  tools?: BedrockTool[];
  maxTokens?: number;
  temperature?: number;
}

export class BedrockAgent {
  private config: BedrockAgentConfig;
  private client: BedrockClient;
  private tools: BedrockTool[] = [];

  constructor(client: BedrockClient, config: BedrockAgentConfig) {
    this.client = client;
    this.config = config;
  }

  async invokeWithUserMessage(
    messageText: string
  ): Promise<{ thread: BedrockThread; response: InvokeResponse; toolCall?: InvokeToolCall }> {
    const thread = new BedrockThread();
    thread.addUserMessage(messageText);

    const response = await this.client.invokeModel({
      system: this.config.systemPrompt,
      messages: thread.getMessages(),
      tools: this.tools.map(tool => tool.getInvocation()),
      max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
    });

    if (response.stop_reason === "tool_use") {
      const toolCall = response.content[response.content.length - 1] as InvokeToolCall;
      thread.addToolCall(toolCall);
      return { thread, response, toolCall };
    }

    return { thread, response };
  }
}
