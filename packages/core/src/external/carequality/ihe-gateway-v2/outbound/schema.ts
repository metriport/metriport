import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const emptyToUndefined = (v: any) =>
  typeof v === "string" && (v.length < 1 || v == undefined) ? undefined : v;

export const schemaOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.literal("")]).transform(emptyToUndefined);
export const schemaOrArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema)]);

export const schemaOrArrayOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema), z.literal("")]).transform(emptyToUndefined);

export const textSchema = z.union([
  z.string(),
  z.object({
    _text: z.string(),
  }),
]);
export type TextOrTextObject = z.infer<typeof textSchema>;

export const stringOrNumberSchema = z.union([z.string(), z.number()]);
