import { z } from "zod";

export const docConversionTypeSchema = z.enum(["html", "pdf"]);

export type DocConversionType = z.infer<typeof docConversionTypeSchema>;
