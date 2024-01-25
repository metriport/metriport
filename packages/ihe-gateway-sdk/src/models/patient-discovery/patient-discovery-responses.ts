import * as z from "zod";
import {
  baseResponseSchema,
  baseErrorResponseSchema,
  externalGatewayPatientSchema,
  XCPDGatewaySchema,
} from "../shared";

const patientDiscoveryRespSuccessfulDefaultSchema = baseResponseSchema.extend({
  patientMatch: z.literal(true),
  patientResource: z.object({}),
  xcpdHomeCommunityId: z.string(),
});

// TO EXTERNAL GATEWAY
const patientDiscoveryRespToExternalGWSuccessfulSchema =
  patientDiscoveryRespSuccessfulDefaultSchema.extend({
    patientMatchDegree: z.number().optional(),
    externalGatewayPatient: externalGatewayPatientSchema,
  });

const patientDiscoveryRespToExternalGWSuccessfulNoMatchSchema = baseResponseSchema.extend({
  patientMatch: z.literal(false),
  xcpdHomeCommunityId: z.string(),
});

const patientDiscoveryRespToExternalGWFaultSchema = baseErrorResponseSchema.extend({
  patientMatch: z.literal(null),
  xcpdHomeCommunityId: z.string(),
});

export const patientDiscoveryRespToExternalGWSchema = z.union([
  patientDiscoveryRespToExternalGWSuccessfulSchema,
  patientDiscoveryRespToExternalGWSuccessfulNoMatchSchema,
  patientDiscoveryRespToExternalGWFaultSchema,
]);

export type PatientDiscoveryRespToExternalGW = z.infer<
  typeof patientDiscoveryRespToExternalGWSchema
>;

// FROM EXTERNAL GATEWAY
const patientDiscoveryRespFromExternalGWDefaultSchema = baseResponseSchema.extend({
  gateway: XCPDGatewaySchema,
  patientResourceId: z.string(),
});

const patientDiscoveryRespFromExternalGWSuccessfulSchema =
  patientDiscoveryRespFromExternalGWDefaultSchema.merge(
    patientDiscoveryRespSuccessfulDefaultSchema
  );

const patientDiscoveryRespFromExternalGWFaultSchema =
  patientDiscoveryRespFromExternalGWDefaultSchema.extend({
    patientMatch: z.literal(false).or(z.literal(null)),
  });

export const patientDiscoveryRespFromExternalGWSchema = z.union([
  patientDiscoveryRespFromExternalGWSuccessfulSchema,
  patientDiscoveryRespFromExternalGWFaultSchema,
]);

export type PatientDiscoveryRespFromExternalGW = z.infer<
  typeof patientDiscoveryRespFromExternalGWSchema
>;
