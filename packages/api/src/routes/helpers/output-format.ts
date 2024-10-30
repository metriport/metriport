import { Request } from "express";
import { z } from "zod";
import { getFromQuery } from "../util";

export const outputFormatParamName = "output";
export const outputFormatSchema = z.enum(["fhir", "dto"]);
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export function getOutputFormatFromRequest(req: Request): OutputFormat | undefined {
  const formatParam = getFromQuery(outputFormatParamName, req);
  return outputFormatSchema.optional().parse(formatParam);
}
