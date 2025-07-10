import { z } from "zod";
import { writeBackFiltersSchema } from "../shared";

export const canvasSecondaryMappingsSchema = z.object({}).merge(writeBackFiltersSchema).optional();
export type CanavsSecondaryMappings = z.infer<typeof canvasSecondaryMappingsSchema>;
