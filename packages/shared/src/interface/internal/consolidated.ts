import { z } from "zod";
import { consolidationConversionType, resourceTypeForConsolidation } from "../../medical";

export const internalSendConsolidatedSchema = z.object({
  bundleLocation: z.string(),
  bundleFilename: z.string(),
  requestId: z.string(),
  conversionType: z.enum(consolidationConversionType),
  resources: z.array(z.enum(resourceTypeForConsolidation)).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  fromDashboard: z.boolean().optional(),
});

export type InternalSendConsolidated = z.infer<typeof internalSendConsolidatedSchema>;
