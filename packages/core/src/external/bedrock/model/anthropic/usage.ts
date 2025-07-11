export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export function buildInitialUsage(): AnthropicUsage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
}

export function incrementUsage(
  usage: AnthropicUsage,
  incrementUsage: AnthropicUsage
): AnthropicUsage {
  return {
    input_tokens: usage.input_tokens + incrementUsage.input_tokens,
    output_tokens: usage.output_tokens + incrementUsage.output_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens + incrementUsage.cache_read_input_tokens,
    cache_creation_input_tokens:
      usage.cache_creation_input_tokens + incrementUsage.cache_creation_input_tokens,
  };
}
