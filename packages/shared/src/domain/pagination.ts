import { z } from "zod";
import { numericValueSchema } from "../common/zod";
import { maxItemsPerPage } from "./pagination-v2";

export function createQueryMetaSchema(maxItems: number = maxItemsPerPage) {
  return z.intersection(
    z.union(
      [
        z.object({
          fromItem: z.string().optional(),
          toItem: z.never().optional(),
        }),
        z.object({
          fromItem: z.never().optional(),
          toItem: z.string().optional(),
        }),
      ],
      { errorMap: () => ({ message: "Either fromItem or toItem can be provided, but not both" }) }
    ),
    z.object({
      count: numericValueSchema
        .refine(count => count >= 0, {
          message: `Count has to be greater than or equal to 0`,
        })
        .refine(count => count <= maxItems, {
          message: `Count has to be less than or equal to ${maxItems}`,
        })
        .optional(),
    })
  );
}

const queryMetaSchema = createQueryMetaSchema();
export type HttpMeta = z.infer<typeof queryMetaSchema>;

export const paginationMetaSchema = z.object({
  itemsInTotal: z.number(),
  itemsOnPage: z.number(),
  nextPage: z.string().optional(),
  prevPage: z.string().optional(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
