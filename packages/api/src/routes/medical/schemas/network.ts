import { z } from "zod";
import { queryMetaSchema } from "../../pagination";

export const networkGetSchema = z
  .object({
    filter: z.string().optional(),
  })
  .and(queryMetaSchema);

export type NetworkGetParams = z.infer<typeof networkGetSchema>;
