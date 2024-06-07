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

export function analytics(params: EventMessageV1, postApiKey?: string): PostHog | void {
  const apiKey = postApiKey ?? defaultPostHogApiKey;
  if (!apiKey) return;

  const posthog = new PostHog(apiKey);

  params.properties = {
    ...(params.properties ? { ...params.properties } : undefined),
    environment: Config.getEnvType(),
    platform: "oss-api",
    $set_once: {
      cxId: params.distinctId,
    },
  };

  posthog.capture(params);

  return posthog;
}

export async function analyticsAsync(params: EventMessageV1, postApiKey?: string) {
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
  documentConversion = "documentConversion",
  consolidatedQuery = "consolidatedQuery",
  inboundPatientDiscovery = "inbound.patientDiscovery",
  inboundDocumentQuery = "inbound.documentQuery",
  inboundDocumentRetrieval = "inbound.documentRetrieval",
}

export enum EventErrMessage {
  no_access = "no access",
}
