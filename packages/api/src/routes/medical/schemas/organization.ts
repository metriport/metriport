import { z } from "zod";
import { OrgType, OrganizationBizType } from "@metriport/core/domain/organization";
import { addressStrictSchema } from "./address";

export const orgTypeSchema = z.nativeEnum(OrgType);

export const organizationBizTypeSchema = z.nativeEnum(OrganizationBizType);

export const organizationCreateSchema = z.object({
  name: z.string().min(1),
  type: orgTypeSchema,
  location: addressStrictSchema,
});

export const organizationUpdateSchema = organizationCreateSchema;

export const organiationInternalDetailsSchema = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string().min(1),
    businessType: organizationBizTypeSchema,
    type: orgTypeSchema,
    shortcode: z.string().optional(),
    // CQ
    cqApproved: z.boolean().optional(),
    cqActive: z.boolean().optional(),
    // CW
    cwApproved: z.boolean().optional(),
    cwActive: z.boolean().optional(),
  })
  .merge(addressStrictSchema);
