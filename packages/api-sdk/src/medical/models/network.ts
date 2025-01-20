import { z } from "zod";

export const networkSchema = z.object({
  name: z.string().optional(),
  oid: z.string().optional(),
  address_line: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  managingOrg: z.string().optional(),
  managingOrgOid: z.string().optional(),
});

export const networkListSchema = z.object({
  networks: z.array(networkSchema),
});
export type Network = z.infer<typeof networkSchema>;
export type NetworkList = z.infer<typeof networkListSchema>;
