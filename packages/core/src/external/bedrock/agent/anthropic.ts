import { BedrockAgentConfig, BedrockAgentResponse } from "./types";
import { AgentTool } from "./tool";
import { AnthropicModel } from "../model/anthropic";
import { AnthropicResponse } from "../model/anthropic/response";
import { AnthropicModelVersion } from "../model/anthropic/version";
import { AnthropicMessageThread, AnthropicAssistantContent } from "../model/anthropic/messages";

export interface AnthropicAgentConfig<V extends AnthropicModelVersion> extends BedrockAgentConfig {
  version: V;
}

// Default parameters for Claude requests
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0;

/**
 * An agent creates BedrockAgentThread instances to manage conversations, memory, and tool calls with the underlying BedrockClient.
 */
export class AnthropicAgent<V extends AnthropicModelVersion> {
  private model: AnthropicModel<V>;
  private config: AnthropicAgentConfig<V>;
  private messages: AnthropicMessageThread = [];
  private tools?: AgentTool[] | undefined;

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
   * Starts model invocation with the given user message.
   * @param messageText
   * @returns
   */
  async invokeWithUserMessage(messageText: string): Promise<BedrockAgentResponse> {
    this.addUserMessage(messageText);
    return this.invokeThread();
  }

  /**
   * Performs a single model invocation for this agent's conversation thread, and adds the response
   * content onto the conversation thread.
   * @returns
   */
  async invokeThread(): Promise<BedrockAgentResponse> {
    // Invoke the underlying Claude Sonnet model
    const response = await this.model.invoke({
      system: this.config.systemPrompt,
      messages: this.messages,
      ...(this.tools ? { tools: this.tools.map(tool => tool.getInvocation()) } : {}),
      max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
    });

    this.messages.push({
      role: "assistant",
      content: response.content as AnthropicAssistantContent,
    });

    // Add the response to the thread
    // this.thread.addAssistantMessage(response.content);

    // If stopped for a tool call, execute the tool call and push the tool result onto the thread
    if (this.tools && response.stop_reason === "tool_use") {
      const toolCall = getToolCallOrFail(response);
      const tool = this.tools.find(tool => tool.getName() === toolCall.name);
      if (!tool) throw new Error(`Tool ${toolCall.name} not found`);

      this.messages.push({
        role: "assistant",
        content: [toolCall],
      });
      try {
        const toolResult = await tool.execute(toolCall.input);
        this.thread.addToolResult(toolCall, toolResult);
        return { response, toolCall, toolResult };
      } catch (toolError) {
        this.thread.addToolError(toolCall, toolError);
        return { response, toolCall, toolError };
      }
    }

    return { response };
  }

  getConversation(): InvokeMessage[] {
    return this.messages;
  }
}

// Validate a tool call
function getToolCallOrFail(response: AnthropicResponse): InvokeToolCall {
  const latestMessage = response.content[response.content.length - 1];
  if (!latestMessage) throw new Error("Unexpected empty response");

  if (latestMessage.type !== "tool_use") {
    throw new Error(`Expected tool call, but got ${latestMessage.type}`);
  }

  return latestMessage as InvokeToolCall;
}
