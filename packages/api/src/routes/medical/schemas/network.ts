import { z } from "zod";
import { queryMetaSchema } from "../../pagination";

const defaultPageSize = 100;
export const networkGetSchema = z
  .object({
    filter: z.string().optional(),
  })
  .and(queryMetaSchema)
  .transform(data => ({
    ...data,
    count: data.count ?? defaultPageSize,
  }));

export type NetworkGetParams = z.infer<typeof networkGetSchema>;
