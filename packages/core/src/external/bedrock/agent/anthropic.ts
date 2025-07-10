import { AnthropicAgentConfig } from "./anthropic/types";
import { AnthropicTool } from "./anthropic/tool";
import { AnthropicModel } from "../model/anthropic";
import { AnthropicResponse } from "../model/anthropic/response";
import { AnthropicModelVersion } from "../model/anthropic/version";
import { AnthropicMessageThread } from "../model/anthropic/messages";
import { AnthropicToolCall, AnthropicToolResult } from "../model/anthropic/tools";

// Default parameters for Claude requests
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0;

/**
 * An agent creates BedrockAgentThread instances to manage conversations, memory, and tool calls with the underlying BedrockClient.
 */
export class AnthropicAgent<V extends AnthropicModelVersion> {
  private model: AnthropicModel<V>;
  private config: AnthropicAgentConfig<V>;
  private messages: AnthropicMessageThread<V> = [];
  private tools: AnthropicTool[] = [];

  constructor(config: AnthropicAgentConfig<V>) {
    this.model = new AnthropicModel<V>(config.version, config.region);
    this.config = config;
    this.tools = config.tools ?? [];
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

    this.messages.push({
      role: "assistant",
      content: response.content,
    });

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
    if (!this.tools || response.stop_reason !== "tool_use") return;
    const toolCalls = response.content.filter(
      content => content.type === "tool_use"
    ) as AnthropicToolCall[];
    if (toolCalls.length === 0) return;

    const toolResults: AnthropicToolResult[] = [];
    for (const toolCall of toolCalls) {
      const tool = this.tools.find(tool => tool.getName() === toolCall.name);
      if (!tool) continue;

      try {
        const toolResultContent = await tool.safelyExecute(toolCall.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: toolResultContent,
        });
      } catch (error) {
        console.error(`Error executing tool ${toolCall.name}:`, error);
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

  /**
   * Returns the conversation thread for this agent.
   * @returns The history of messages between the user and assistant.
   */
  getConversation(): AnthropicMessageThread<V> {
    return this.messages;
  }
}
