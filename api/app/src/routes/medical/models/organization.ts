import { z } from "zod";
import { addressSchema } from "./address";

export enum OrgType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
  testing = "testing",
}

export const orgTypeSchema = z.nativeEnum(OrgType);

export const organizationSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(1),
  type: orgTypeSchema,
  locations: z.array(addressSchema),
});

export type Organization = z.infer<typeof organizationSchema>;
