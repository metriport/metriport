import { z } from "zod";
import { linkSchema } from "./link";

export const organizationSchema = z.object({
  organizationId: z.string(),
  homeCommunityId: z.string(),
  name: z.string(),
  displayName: z.string(),
  memberName: z.string(),
  type: z.string(),
  patientIdAssignAuthority: z.string(),
  securityTokenKeyType: z.string(),
  sendingFacility: z
    .object({
      namespaceId: z.string().optional().nullable(),
      universalId: z.string().optional().nullable(),
      universalIdType: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  sendingApplication: z
    .object({
      namespaceId: z.string().optional().nullable(),
      universalId: z.string().optional().nullable(),
      universalIdType: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  isActive: z.boolean(),
  locations: z.array(
    z.object({
      address1: z.string(),
      address2: z.string().optional().nullable(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      country: z.string(),
      phone: z.string().optional().nullable(),
      fax: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
    })
  ),
  technicalContacts: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      email: z.string(),
      phone: z.string(),
    })
  ),
  gateways: z
    .array(
      z.object({
        serviceType: z.string(),
        gatewayType: z.string(),
        isAsync: z.boolean().optional(),
        gatewayTimeout: z.number().optional(),
        endpointLocation: z.string().optional(),
      })
    )
    .optional()
    .nullable(),
  authorizationInformation: z
    .object({
      authorizationServerEndpoint: z.string(),
      clientId: z.string(),
      clientSecret: z.string(),
      documentReferenceScope: z.string(),
      binaryScope: z.string(),
    })
    .optional()
    .nullable(),
  _links: z
    .object({
      self: linkSchema.optional().nullable(),
      certificate: linkSchema.optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type Organization = z.infer<typeof organizationSchema>;

export const organizationListSchema = z.object({
  count: z.number(),
  from: z.number(),
  to: z.number(),
  organizations: z.array(organizationSchema),
  _links: linkSchema,
});

export type OrganizationList = z.infer<typeof organizationListSchema>;
