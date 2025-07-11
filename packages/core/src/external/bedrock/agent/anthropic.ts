import { BadRequestError } from "@metriport/shared";
import { AnthropicAgentConfig } from "./anthropic/types";
import { AnthropicTool } from "./anthropic/tool";
import { AnthropicModel } from "../model/anthropic";
import { AnthropicResponse } from "../model/anthropic/response";
import { AnthropicUsage, buildInitialUsage, incrementUsage } from "../model/anthropic/usage";
import { AnthropicModelVersion } from "../model/anthropic/version";
import { AnthropicAssistantContent, AnthropicMessageThread } from "../model/anthropic/messages";
import { AnthropicToolCall, AnthropicToolResult } from "../model/anthropic/tools";

// Default parameters for Claude requests
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0;

/**
 * An agent creates BedrockAgentThread instances to manage conversations, memory, and tool calls with the underlying BedrockClient.
 */
export class AnthropicAgent<V extends AnthropicModelVersion> {
  private readonly model: AnthropicModel<V>;
  private readonly config: AnthropicAgentConfig<V>;
  private readonly tools?: AnthropicTool[] | undefined;
  private readonly usage: AnthropicUsage = buildInitialUsage();
  private messages: AnthropicMessageThread<V> = [];

  constructor(config: AnthropicAgentConfig<V>) {
    this.model = new AnthropicModel<V>(config.version, config.region);
    this.config = config;
    this.tools = config.tools;
  }

  /**
   * Adds a user message to the agent's conversation thread. This is usually the first step in starting
   * a conversation with the agent.
   * @param messageText - The text of the user message.
   */
  addUserMessage(messageText: string): void {
    this.messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: messageText,
        },
      ],
    });
  }

  /**
   * Adds an assistant message to the agent's conversation thread.
   * @param content - The content of the assistant message.
   */
  private addAssistantMessage(content: AnthropicAssistantContent<V>): void {
    this.messages.push({
      role: "assistant",
      content,
    });
  }

  /**
   * Starts model invocation with the given user message.
   * @param messageText
   * @returns
   */
  async startConversation(messageText: string): Promise<AnthropicResponse<V>> {
    this.addUserMessage(messageText);
    return this.continueConversation();
  }

  /**
   * Performs a single model invocation for this agent's conversation thread, and adds the response
   * content onto the conversation thread.
   * @returns
   */
  async continueConversation(): Promise<AnthropicResponse<V>> {
    // Invoke the underlying Claude Sonnet model
    const response = await this.model.invokeModel({
      system: this.config.systemPrompt,
      messages: this.messages,
      ...(this.tools && this.tools.length > 0
        ? { tools: this.tools.map(tool => tool.getConfig()) }
        : {}),
      max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
    });

    // Update the internal state of the agent with the response
    this.addAssistantMessage(response.content);
    incrementUsage(this.usage, response.usage);
    return response;
  }

  /**
   * After continuing a conversation, check the response object to see if the model has invoked any tools.
   * @param response
   * @returns
   */
  shouldExecuteTools(response: AnthropicResponse<V>): boolean {
    if (!this.tools || response.stop_reason !== "tool_use") return false;
    return response.content.some(({ type }) => type === "tool_use");
  }

  /**
   * If a model response contains tool calls, execute the tools and add the results to as a new user message
   * on the agent's conversation thread.
   * @param response
   * @returns
   */
  async executeTools(response: AnthropicResponse<V>): Promise<void> {
    const toolCalls = response.content.filter(
      ({ type }) => type === "tool_use"
    ) as AnthropicToolCall[];
    if (!this.tools || response.stop_reason !== "tool_use" || toolCalls.length === 0) {
      throw new BadRequestError("Not a valid tool call response");
    }

    const toolResults: AnthropicToolResult[] = [];
    for (const toolCall of toolCalls) {
      const tool = this.tools.find(tool => tool.getName() === toolCall.name);
      if (!tool) continue;

      try {
        const toolResultContent = await tool.execute(toolCall.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: toolResultContent,
        });
      } catch (error) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    this.messages.push({ role: "user", content: toolResults });
  }

  hasTools(): boolean {
    return !!this.tools;
  }

  /**
   * Returns the conversation thread for this agent.
   * @returns The history of messages between the user and assistant.
   */
  getConversation(): AnthropicMessageThread<V> {
    return this.messages;
  }

  /**
   * Sets the conversation thread for this agent. Used for testing agent methods.
   * @param messages The history of messages between the user and assistant.
   */
  setConversation(messages: AnthropicMessageThread<V>): void {
    this.messages = [...messages];
  }
}
