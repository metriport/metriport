import { OrganizationBizType } from "@metriport/core/domain/organization";
import { TreatmentType } from "@metriport/shared";
import { z } from "zod";
import { addressStrictSchema } from "./address";

export const orgTypeSchema = z.nativeEnum(TreatmentType);

export const organizationBizTypeSchema = z.nativeEnum(OrganizationBizType);

export const organizationCreateSchema = z.object({
  name: z.string().min(1),
  type: orgTypeSchema,
  location: addressStrictSchema,
});

export const organizationUpdateSchema = organizationCreateSchema;

export const organizationInternalDetailsSchema = z
  .object({
    id: z.string().optional(),
    businessType: organizationBizTypeSchema,
    type: orgTypeSchema,
    location: addressStrictSchema,
    shortcode: z.string().optional(),
    // CQ
    cqApproved: z.boolean().optional(),
    cqActive: z.boolean().optional(),
    principalOid: z.string().nullable().optional(),
    delegateOids: z.array(z.string()).default([]),
    // CW
    cwApproved: z.boolean().optional(),
    cwActive: z.boolean().optional(),
    // EHEX
    ehexApproved: z.boolean().optional(),
    ehexActive: z.boolean().optional(),
  })
  .and(
    z.union([
      z.object({
        nameInMetriport: z.string().min(1),
      }),
      z.object({
        name: z.string().min(1),
      }),
    ])
  );
