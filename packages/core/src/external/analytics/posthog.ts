import { PostHog } from "posthog-node";
import { Config } from "../../util/config";

// TEMPORARY FIX - CANT EXPORT THE TYPE FROM MODULE
export interface IdentifyMessageV1 {
  distinctId: string;
  properties?: Record<string | number, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  disableGeoip?: boolean;
}

// TEMPORARY FIX - CANT EXPORT THE TYPE FROM MODULE
export interface EventMessageV1 extends IdentifyMessageV1 {
  event: string;
  groups?: Record<string, string | number>; // Mapping of group type to group id
  sendFeatureFlags?: boolean;
  timestamp?: Date;
}

export type AnalyticsParams = Omit<EventMessageV1, "distinctId"> & { cxId: string };

const defaultPostHogApiKey = Config.getPostHogApiKey();

const POSTHOG_GROUP_ID = "customer";

export function analytics(params: AnalyticsParams, postApiKey?: string): PostHog | void {
  const apiKey = postApiKey ?? defaultPostHogApiKey;
  if (!apiKey) return;

  const posthog = new PostHog(apiKey);

  const updatedParams: EventMessageV1 = {
    ...params,
    distinctId: POSTHOG_GROUP_ID,
    groups: { company: params.cxId },
    properties: {
      ...(params.properties ? { ...params.properties } : undefined),
      environment: Config.getEnvType(),
      platform: "oss-api",
    },
  };

  posthog.capture(updatedParams);

  return posthog;
}

export async function analyticsAsync(params: AnalyticsParams, postApiKey?: string) {
  const posthog = analytics(params, postApiKey);

  if (!posthog) return;

  // Needed to send requests to PostHog in lambda
  // https://posthog.com/docs/libraries/node#using-in-a-short-lived-process-like-aws-lambda
  await posthog.shutdown();
}

export enum EventTypes {
  query = "query",
  webhook = "webhook",
  error = "error",
  addressRelevance = "addressRelevance",
  patientDiscovery = "patientDiscovery",
  rerunOnNewDemographics = "rerunOnNewDemographics",
  runScheduledPatientDiscovery = "runScheduledPatientDiscovery",
  documentQuery = "documentQuery",
  documentRetrieval = "documentRetrieval",
  documentConversion = "documentConversion",
  fhirDeduplication = "fhirDeduplication",
  consolidatedQuery = "consolidatedQuery",
  inboundPatientDiscovery = "inbound.patientDiscovery",
  inboundDocumentQuery = "inbound.documentQuery",
  inboundDocumentRetrieval = "inbound.documentRetrieval",
}

export enum EventErrMessage {
  no_access = "no access",
}
