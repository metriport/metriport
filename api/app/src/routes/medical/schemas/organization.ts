import { z } from "zod";
import { OrgType } from "../../../models/medical/organization";
import { addressSchema } from "./address";

export const orgTypeSchema = z.nativeEnum(OrgType);

export const organizationSchema = z.object({
  name: z.string().min(1),
  type: orgTypeSchema,
  location: addressSchema,
});

export type Organization = z.infer<typeof organizationSchema>;
