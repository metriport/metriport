import { BadRequestError } from "@metriport/shared";
import { AnthropicAgentConfig } from "./anthropic/types";
import { AnthropicTool, buildToolExecutions } from "./anthropic/tool";
import { AnthropicModel } from "../model/anthropic";
import { AnthropicResponse } from "../model/anthropic/response";
import { AnthropicUsage, buildInitialUsage, incrementUsage } from "../model/anthropic/usage";
import { AnthropicModelVersion } from "../model/anthropic/version";
import {
  AnthropicAssistantContent,
  AnthropicMessageThread,
  AnthropicUserContent,
} from "../model/anthropic/messages";
import {
  AnthropicToolResult,
  buildToolResult,
  buildToolResultError,
  getToolCallsFromResponse,
} from "../model/anthropic/tools";
import { executeAsynchronously } from "../../../util";

// Default parameters for Claude requests
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0;

/**
 * An agent creates AnthropicAgent instances to manage conversations, memory, and tool calls with the underlying Anthropic model.
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
  addUserMessage(content: AnthropicUserContent): void {
    this.messages.push({
      role: "user",
      content,
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
   * @param messageText - The text of the user message.
   * @returns The response from the Anthropic model.
   */
  async startConversation(messageText: string): Promise<AnthropicResponse<V>> {
    this.addUserMessage([
      {
        type: "text",
        text: messageText,
      },
    ]);
    return this.continueConversation();
  }

  /**
   * Performs a single model invocation for this agent's conversation thread, and adds the response
   * content onto the conversation thread.
   * @returns The response from the Anthropic model.
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
   * @param response - The response from the model.
   * @returns True if the model has invoked any tools.
   */
  shouldExecuteTools(response: AnthropicResponse<V>): boolean {
    if (!this.tools || response.stop_reason !== "tool_use") return false;
    return response.content.some(({ type }) => type === "tool_use");
  }

  /**
   * If a model response contains tool calls, execute the tools and add the results to as a new user message
   * on the agent's conversation thread.
   * @param response - The response from the model.
   */
  async executeTools(response: AnthropicResponse<V>): Promise<void> {
    const toolCalls = getToolCallsFromResponse(response);
    if (!this.tools || response.stop_reason !== "tool_use" || toolCalls.length === 0) {
      throw new BadRequestError("Not a valid tool call response");
    }

    const { toolExecutions, toolErrors } = buildToolExecutions(this.tools, toolCalls);
    const toolResults: AnthropicToolResult[] = [];
    await executeAsynchronously(toolExecutions, async ({ tool, toolCall, arg }) => {
      try {
        const result = await tool.execute(arg);
        toolResults.push(buildToolResult(toolCall, result));
      } catch (error) {
        toolResults.push(buildToolResultError(toolCall, error));
      }
    });
    toolResults.push(...toolErrors);
    // Add the tool results to the conversation thread
    this.addUserMessage(toolResults);
  }

  /**
   * @returns True if the agent has tools configured.
   */
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
