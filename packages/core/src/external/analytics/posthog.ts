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

const defaultPostHogApiKey = Config.getPostHogApiKey();
const groupType = "customer";
let posthogClient: PostHog | undefined;

export function initPostHog(apiKey?: string): PostHog | undefined {
  const postHogApiKey = apiKey ?? defaultPostHogApiKey;
  if (!postHogApiKey) return undefined;

  return new PostHog(postHogApiKey);
}

function getPosthogClientInstance(): PostHog | undefined {
  return posthogClient ?? initPostHog(defaultPostHogApiKey);
}

export function captureAnalytics(params: EventMessageV1): void {
  const posthogClient = getPosthogClientInstance();
  if (!posthogClient) return;

  const enrichedParams = {
    ...params,
    properties: {
      ...(params.properties ?? {}),
      environment: Config.getEnvType(),
      platform: "oss-api",
    },
    groups: { [groupType]: params.distinctId },
  };

  posthogClient.capture(enrichedParams);
}

export async function captureAnalyticsAsync(params: EventMessageV1): Promise<void> {
  if (!posthogClient) return;

  captureAnalytics(params);

  // Needed to send requests to PostHog in lambda
  // https://posthog.com/docs/libraries/node#using-in-a-short-lived-process-like-aws-lambda
  await posthogClient.shutdown();
}

/**
 * @deprecated Use captureAnalytics() instead. This function creates a new PostHog instance on every call.
 */
export function analytics(params: EventMessageV1, postApiKey?: string): PostHog | void {
  const apiKey = postApiKey ?? defaultPostHogApiKey;

  if (!apiKey) return;

  const posthog = new PostHog(apiKey);

  params.properties = {
    ...(params.properties ? { ...params.properties } : undefined),
    environment: Config.getEnvType(),
    platform: "oss-api",
  };
  params.groups = { [groupType]: params.distinctId };
  posthog.capture(params);

  return posthog;
}

/**
 * @deprecated Use captureAnalyticsAsync() instead. This function creates a new PostHog instance on every call.
 */
export async function analyticsAsync(params: EventMessageV1, postApiKey: string) {
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
  aiBriefGeneration = "aiBriefGeneration",
  patientDiscovery = "patientDiscovery",
  rerunOnNewDemographics = "rerunOnNewDemographics",
  runScheduledPatientDiscovery = "runScheduledPatientDiscovery",
  documentQuery = "documentQuery",
  documentRetrieval = "documentRetrieval",
  documentConversion = "documentConversion",
  fhirDeduplication = "fhirDeduplication",
  fhirNormalization = "fhirNormalization",
  conversionPostProcess = "conversionPostProcess",
  consolidatedPostProcess = "consolidatedPostProcess",
  fhirHydration = "fhirHydration",
  consolidatedQuery = "consolidatedQuery",
  inboundPatientDiscovery = "inbound.patientDiscovery",
  inboundDocumentQuery = "inbound.documentQuery",
  inboundDocumentRetrieval = "inbound.documentRetrieval",
}

export enum EventErrMessage {
  no_access = "no access",
}
