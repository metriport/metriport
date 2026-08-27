/**
 * A minimal prompt templating library for LLM applications.
 * Supports {{ variable }} syntax with Zod-powered runtime validation.
 */

import { z } from "zod";

const VARIABLE_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Extracts all variable names from a template string.
 */
function extractVariables(template: string): Set<string> {
  const variables = new Set<string>();
  let match;

  VARIABLE_REGEX.lastIndex = 0;
  while ((match = VARIABLE_REGEX.exec(template)) !== null) {
    const variable = match[1];
    if (variable) variables.add(variable);
  }

  return variables;
}

/**
 * Creates a typed prompt function from a markdown template with Zod schema validation.
 * Validates both the presence of variables and their runtime types.
 */
export function createPromptBuilder<T extends z.ZodRawShape>(
  template: string,
  schema: z.ZodObject<T>
): (variables: z.infer<typeof schema>) => string {
  const requiredVars = extractVariables(template);
  const schemaKeys = new Set(Object.keys(schema.shape));

  // Validate that schema covers all template variables
  const missingInSchema = [...requiredVars].filter(v => !schemaKeys.has(v));
  if (missingInSchema.length > 0) {
    throw new Error(`Template variables not in schema: ${missingInSchema.join(", ")}`);
  }

  return (variables: z.infer<typeof schema>): string => {
    // Runtime validation with Zod
    const validated = schema.parse(variables);

    // Substitute variables
    return template.replace(VARIABLE_REGEX, (_, varName) => {
      return String(validated[varName]);
    });
  };
}
