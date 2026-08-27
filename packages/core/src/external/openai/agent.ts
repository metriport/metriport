import { OpenAIClient, buildOpenAIClient } from "./client";
import { OpenAITool } from "./tool";
import { getToolCallsFromResponse, buildToolExecutions, executeAllTools } from "./gpt/tools";
import {
  OpenAIAgentConfig,
  OpenAIMessage,
  OpenAIUserContent,
  OpenAIResponse,
  OpenAIUsage,
} from "./types";
import { DEFAULT_PROVIDER, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from "./constants";
import { buildInitialUsage, incrementUsage } from "./gpt/usage";

/**
 * An agent manages conversations, memory, and tool calls with the underlying OpenAI model.
 */
export class OpenAIAgent {
  private readonly config: OpenAIAgentConfig;
  private client?: OpenAIClient;
  private messages: OpenAIMessage[] = [];
  private tools?: OpenAITool[] | undefined;
  private usage: OpenAIUsage = buildInitialUsage();

  constructor(config: OpenAIAgentConfig) {
    this.config = config;
    this.tools = config.tools;
    this.messages.push({
      role: "system",
      content: this.config.systemPrompt,
    });
  }

  /**
   * Adds a user message to the agent's conversation thread. This is usually the first step in starting
   * a conversation with the agent.
   * @param content - The content of the user message, either a string or an array of content objects.
   */
  addUserMessage(content: OpenAIUserContent): void {
    this.messages.push({
      role: "user",
      content,
    });
  }

  /**
   * Starts model invocation with the given user message. This is a more convenient method and most common pattern for
   * starting a conversation with an OpenAI model.
   * @param messageText - The text of the user message - usually, whatever follows the system prompt.
   * @returns The response from the OpenAI model.
   */
  async startConversation(messageText: string): Promise<OpenAIResponse> {
    this.addUserMessage(messageText);
    return await this.continueConversation();
  }

  /**
   * Performs a single model invocation for this agent's conversation thread, and adds the response
   * content onto the conversation thread.
   * @returns The response from the OpenAI model.
   */
  async continueConversation(): Promise<OpenAIResponse> {
    const client = await this.getClient();
    const response = await client.invokeModel({
      messages: this.messages,
      max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
      ...(this.hasTools() ? { tools: this.tools?.map(tool => tool.getRequestTool()) ?? [] } : {}),
    });
    this.messages.push(...response.choices.map(choice => choice.message));
    this.usage = incrementUsage(this.usage, response);
    return response;
  }

  /**
   * After continuing a conversation, check the response object to see if the model has invoked any tools.
   * @param response - The response from the model.
   * @returns True if the model has invoked any tools.
   */
  shouldExecuteTools(response: OpenAIResponse): boolean {
    const toolCalls = getToolCallsFromResponse(response);
    return this.hasTools() && toolCalls.length > 0;
  }

  /**
   * If a model response contains tool calls, execute the tools and add the results to as a new user message
   * on the agent's conversation thread.
   * @param response - The response from the model.
   */
  async executeTools(response: OpenAIResponse): Promise<void> {
    const toolCalls = getToolCallsFromResponse(response);
    if (!this.tools || toolCalls.length === 0) return;

    const { toolExecutions, toolErrors } = buildToolExecutions(this.tools, toolCalls);
    const toolResults = await executeAllTools(toolExecutions);
    this.messages.push(...toolResults, ...toolErrors);
  }

  /**
   * Builds an OpenAIClient instance from environment variables and possible secret manager values.
   * @returns An OpenAIClient instance.
   */
  private async getClient(): Promise<OpenAIClient> {
    if (this.client) return this.client;
    this.client = await buildOpenAIClient(this.config.provider ?? DEFAULT_PROVIDER, this.config);
    return this.client;
  }

  /**
   * Adds a tool to the agent's tool set.
   * @param tool - The tool to add.
   */
  addTool<I, O>(tool: OpenAITool<I, O>): void {
    if (!this.tools) {
      this.tools = [];
    }
    this.tools.push(tool as OpenAITool<unknown, unknown>);
  }

  /**
   * @returns True if the agent has tools configured.
   */
  hasTools(): boolean {
    return !!this.tools && this.tools.length > 0;
  }

  /**
   * @returns The conversation thread for the agent.
   */
  getConversation(): OpenAIMessage[] {
    return [...this.messages];
  }

  /**
   * Sets the conversation thread for this agent. Used for testing agent methods.
   * @param messages The history of messages between the user and assistant.
   */
  setConversation(messages: OpenAIMessage[]): void {
    this.messages = [...messages];
  }

  /**
   * @returns The usage for this agent.
   */
  getUsage(): OpenAIUsage {
    return this.usage;
  }
}
