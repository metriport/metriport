import { z } from "zod";

export const baseUpdateSchema = z.object({
  eTag: z.string().optional(),
});
export type BaseUpdateSchema = z.infer<typeof baseUpdateSchema>;

export function baseUpdateSchemaToCmd(input: BaseUpdateSchema): { version?: number } {
  return {
    version: input.eTag ? Number.parseInt(input.eTag) : undefined,
  };
}
