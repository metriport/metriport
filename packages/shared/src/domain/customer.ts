import { z } from "zod";

export const customerDataSchema = z.object({
  cxId: z.string(),
  facilities: z.array(
    z.object({
      id: z.string(),
      oid: z.string(),
      name: z.string(),
      npi: z.string(),
    })
  ),
});

export type CustomerData = z.infer<typeof customerDataSchema>;
export type FacilityData = CustomerData["facilities"][number];
