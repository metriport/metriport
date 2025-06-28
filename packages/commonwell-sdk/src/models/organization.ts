import { z } from "zod";
import { linkSchema } from "./link";

const organizationBaseSchema = z.object({
  organizationId: z.string(),
  homeCommunityId: z.string(),
  name: z.string(),
  displayName: z.string(),
  memberName: z.string(),
  type: z.string(),
  patientIdAssignAuthority: z.string(),
  sendingFacility: z
    .object({
      namespaceId: z.string().nullish(),
      universalId: z.string().nullish(),
      universalIdType: z.string().nullish(),
    })
    .nullish(),
  sendingApplication: z
    .object({
      namespaceId: z.string().nullish(),
      universalId: z.string().nullish(),
      universalIdType: z.string().nullish(),
    })
    .nullish(),
  isActive: z.boolean(),
  locations: z.array(
    z.object({
      address1: z.string(),
      address2: z.string().nullish(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      country: z.string(),
      phone: z.string().nullish(),
      fax: z.string().nullish(),
      email: z.string().nullish(),
    })
  ),
  /** Gateway search radius in miles. One of: 50, 100, 150 */
  searchRadius: z.number(),
  technicalContacts: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      email: z.string(),
      phone: z.string(),
    })
  ),
  _links: z
    .object({
      self: linkSchema.nullish(),
      certificate: linkSchema.nullish(),
    })
    .nullish(),
});

export const organizationSchemaWithNetworkInfo = organizationBaseSchema.extend({
  securityTokenKeyType: z
    .union([z.literal("JWT"), z.literal("BEARER"), z.literal("HOLDER-OF-KEY")])
    .nullish(),
  networks: z.array(
    z.object({
      type: z.string(),
      purposeOfUse: z.array(
        z.object({
          id: z.string(),
          queryInitiatorOnly: z.boolean(),
          queryInitiator: z.boolean(),
          queryResponder: z.boolean(),
        })
      ),
      includes: z.array(z.string()).nullish(), // List of OIDs to always include in document query
      excludes: z.array(z.string()).nullish(), // List of OIDs to always exclude from document query
      doa: z.array(z.string()).nullish(), // OIDs this org has authority delegated from
    })
  ),
  gateways: z
    .array(
      z.object({
        serviceType: z.union([
          z.literal("R4_Base"),
          z.literal("XCA-ITI-38"),
          z.literal("XCA-ITI-39"),
        ]),
        gatewayType: z.union([z.literal("FHIR"), z.literal("XCA")]),
        isAsync: z.boolean().nullish(),
        gatewayTimeout: z.number().nullish(),
        endpointLocation: z.string().nullish(),
      })
    )
    .nullish(),
  authorizationInformation: z
    .object({
      authorizationServerEndpoint: z.string().nullish(),
      clientId: z.string().nullish(),
      clientSecret: z.string().nullish(),
      documentReferenceScope: z.string().nullish(),
      binaryScope: z.string().nullish(),
    })
    .nullish(),
});
export type OrganizationWithNetworkInfo = z.infer<typeof organizationSchemaWithNetworkInfo>;

export const organizationSchemaWithoutNetworkInfo = organizationSchemaWithNetworkInfo.omit({
  securityTokenKeyType: true,
  networks: true,
  gateways: true,
  authorizationInformation: true,
});
export type OrganizationWithoutNetworkInfo = z.infer<typeof organizationSchemaWithoutNetworkInfo>;

export const organizationSchema = z.union([
  organizationSchemaWithNetworkInfo,
  organizationSchemaWithoutNetworkInfo,
]);
export type Organization = z.infer<typeof organizationSchema>;

export const organizationListSchema = z.object({
  count: z.number(),
  from: z.number(),
  to: z.number(),
  organizations: z.array(organizationSchema),
  _links: linkSchema,
});

export type OrganizationList = z.infer<typeof organizationListSchema>;
