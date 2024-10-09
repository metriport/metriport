import { Request } from "express";
import { z } from "zod";
import { BadRequestError } from "@metriport/shared";
import { ResourceTypeForConsolidation, resourceSchema } from "@metriport/api-sdk";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { getFrom } from "../../util";

const typeSchema = z.enum(["collection"]);

const bundleEntrySchema = z.array(
  z.object({
    resource: z.any().refine(value => value !== undefined, { message: "Resource is required" }),
  })
);

export const bundleSchema = z.object({
  resourceType: z.enum(["Bundle"]),
  type: typeSchema,
  entry: bundleEntrySchema,
});

export type BundleEntry = z.infer<typeof bundleEntrySchema>;
export type Bundle = z.infer<typeof bundleSchema>;

export function getResourcesQueryParam(req: Request): ResourceTypeForConsolidation[] {
  const resourcesRaw = getFrom("query").optional("resources", req);
  let resourcesUnparsed: string[];
  try {
    resourcesUnparsed = resourcesRaw
      ? resourcesRaw
          .replaceAll('"', "")
          .replaceAll("'", "")
          .split(",")
          .map(r => r.trim())
          .flatMap(filterTruthy)
      : [];
  } catch (err) {
    throw new BadRequestError(`Invalid resources: it must be a comma-separated list of resources`);
  }
  return resourceSchema.parse(resourcesUnparsed);
}
