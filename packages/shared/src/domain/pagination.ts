import { z } from "zod";
import { numericValueSchema } from "../common/zod";

export const defaultItemsPerPage = 50;
export const maxItemsPerPage = 500;

export const queryMetaSchema = z.intersection(
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
      .refine(count => count <= maxItemsPerPage, {
        message: `Count has to be less than or equal to ${maxItemsPerPage}`,
      })
      .optional(),
  })
);

export type HttpMeta = z.infer<typeof queryMetaSchema>;
