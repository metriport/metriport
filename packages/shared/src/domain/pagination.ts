import { z } from "zod";
import { numericValueSchema } from "../common/zod";
import { decodeCursor } from "./cursor-utils";

export const defaultItemsPerPage = 50;
export const maxItemsPerPage = 500;

const sortItemSchema = z.string().transform((val, ctx) => {
  const [col, order] = val.split("=");
  if (!col || !order) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid sort format: ${val}. Expected: column=order`,
    });
    return z.NEVER;
  }

  if (order !== "asc" && order !== "desc") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid sort order: ${order}. Must be 'asc' or 'desc'`,
    });
    return z.NEVER;
  }

  return { col, order: order as "asc" | "desc" };
});

export type SortItem = z.infer<typeof sortItemSchema>;

function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

function addIdSortIfNotExists(items: SortItem[]): SortItem[] {
  const hasIdSort = items.some(item => item.col === "id");
  return hasIdSort ? items : [...items, { col: "id", order: "desc" as const }];
}

const sortStringSchema = z
  .string()
  .optional()
  .transform(val => {
    if (!val) {
      return addIdSortIfNotExists([]);
    }

    const items = val.split(",").filter(item => item.trim());
    const parsedItems = items.map(item => sortItemSchema.parse(item));
    return addIdSortIfNotExists(parsedItems);
  })
  .refine(isNonEmptyArray, {
    message: "Sort array must have at least one item",
  });

const compositeCursorSchema = z.record(z.string(), z.string());
export type CompositeCursor = z.infer<typeof compositeCursorSchema>;

const cursorSchema = z.string().transform((val, ctx) => {
  try {
    return compositeCursorSchema.parse(decodeCursor(val));
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid cursor: " + val,
    });
    return z.NEVER;
  }
});

export function createQueryMetaSchema(maxItems: number = maxItemsPerPage) {
  return z
    .intersection(
      z.union(
        [
          z.object({
            fromItem: cursorSchema.optional(),
            toItem: z.never().optional(),
          }),
          z.object({
            fromItem: z.never().optional(),
            toItem: cursorSchema.optional(),
          }),
        ],
        { errorMap: () => ({ message: "Either fromItem or toItem can be provided, but not both" }) }
      ),
      z.object({
        sort: sortStringSchema,
        count: numericValueSchema
          .refine(count => count >= 0, {
            message: `Count has to be greater than or equal to 0`,
          })
          .refine(count => count <= maxItems, {
            message: `Count has to be less than or equal to ${maxItems}`,
          })
          .optional(),
      })
    )
    .transform(data => {
      // Reorient ordering based on pagination direction
      const shouldReverseOrder = !!data.toItem;
      const reorientedSort = data.sort.map(({ col, order }) => ({
        col,
        order: shouldReverseOrder
          ? order === "asc"
            ? ("desc" as const)
            : ("asc" as const)
          : order,
      }));

      return {
        ...data,
        sort: reorientedSort,
        originalSort: data.sort,
      };
    })
    .refine(
      data => {
        const cursor = data.fromItem ?? data.toItem;
        const sort = data.sort;

        if (sort && cursor) {
          const sortColumnCount = sort.length;
          const cursorKeyCount = Object.keys(cursor).length;

          if (sortColumnCount !== cursorKeyCount) {
            return false;
          }
        }

        return true;
      },
      {
        message: "Number of sort columns should match the number of cursor keys",
      }
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
