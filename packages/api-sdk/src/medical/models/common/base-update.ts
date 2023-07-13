import { z } from "zod";

export const baseUpdateSchema = z.object({
  id: z.string(),
  eTag: z.string().optional(),
});
export type BaseUpdate = z.infer<typeof baseUpdateSchema>;

export function getETagHeader(entity: Pick<BaseUpdate, "eTag">) {
  return entity.eTag ? { "If-Match": entity.eTag } : undefined;
}
