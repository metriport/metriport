import { z } from "zod";

export const schemaOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.literal("")]);
export const schemaOrArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema)]);
export const schemaOrArrayOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema), z.literal("")]);
export const textSchema = z.union([
  z.string(),
  z.object({
    _text: z.string(),
  }),
]);
export type TextOrTextObject = z.infer<typeof textSchema>;

export const stringOrNumberSchema = z.union([z.string(), z.number()]);
