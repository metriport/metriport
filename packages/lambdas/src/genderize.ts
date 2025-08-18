import { buildGenderizeHandler } from "@metriport/core/command/genderize/genderize-factory";
import { getEnvOrFail } from "./shared/env";
import { capture } from "./shared/capture";
import { z } from "zod";
import { MetriportError } from "@metriport/shared";

export const genderizeRequestSchema = z.object({
  name: z.string().trim().min(1, "Missing name"),
  // optional, if you ever want to pass it through
  threshold: z.number().min(0).max(1).optional(),
});

export type GenderizeRequest = z.infer<typeof genderizeRequestSchema>;

capture.init();

export function parseBody<T>(schema: z.Schema<T>, body?: unknown): T {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return schema.parse(bodyAsJson);
}

// Automatically set by AWS (kept for logging/telemetry context)
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

const direct = buildGenderizeHandler(lambdaName);

type EventShape = { body?: string };

export const handler = async (event: EventShape) => {
  const { name } = parseBody(genderizeRequestSchema, event.body);
  const gender = await direct.execute({ name });
  const resp = { statusCode: 200, body: JSON.stringify({ gender }) };
  return resp;
};
