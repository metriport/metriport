import { z } from "zod";
import { addressSchema } from "./address";

export enum OrgType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}

export const orgTypeSchema = z.nativeEnum(OrgType);

export const organizationSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(1),
  type: orgTypeSchema,
  location: addressSchema,
});

export type Organization = z.infer<typeof organizationSchema>;
