import { PostHog } from "posthog-node";
import { Config } from "../../util/config";

const GROUP_TYPE = "customer";

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
  fhirHydration = "fhirHydration",
  consolidatedQuery = "consolidatedQuery",
  inboundPatientDiscovery = "inbound.patientDiscovery",
  inboundDocumentQuery = "inbound.documentQuery",
  inboundDocumentRetrieval = "inbound.documentRetrieval",
}

export enum EventErrMessage {
  no_access = "no access",
}

class PostHogAnalytics {
  private static instance: PostHogAnalytics;
  private client?: PostHog;
  private platform: "oss-api" | "lambda" = "oss-api";

  /**
   * Initialize PostHog analytics - should be called once on API startup or Lambda init
   */
  static init(apiKey: string, platform: "oss-api" | "lambda" = "oss-api"): PostHogAnalytics {
    if (!PostHogAnalytics.instance) {
      PostHogAnalytics.instance = new PostHogAnalytics();
      PostHogAnalytics.instance.client = new PostHog(apiKey);
      PostHogAnalytics.instance.platform = platform;
    }
    return PostHogAnalytics.instance;
  }

  static getInstance(): PostHogAnalytics {
    if (!PostHogAnalytics.instance) {
      const apiKey = Config.getPostHogApiKey();
      if (!apiKey) throw new Error("PostHog API key not configured");
      return PostHogAnalytics.init(apiKey);
    }
    return PostHogAnalytics.instance;
  }

  capture(params: EventMessageV1): void {
    if (!this.client) return;

    const enrichedParams = {
      ...params,
      properties: {
        ...(params.properties ?? {}),
        environment: Config.getEnvType(),
        platform: this.platform,
      },
      groups: { [GROUP_TYPE]: params.distinctId },
    };

    this.client.capture(enrichedParams);
  }

  async shutdown(): Promise<void> {
    // Necessary for calls within an AWS Lambda
    await this.client?.shutdown();
  }
}

/**
 * Initialize PostHog analytics - should be called once on API startup or Lambda init
 */
export function initPostHog(apiKey: string, platform: "oss-api" | "lambda"): void {
  PostHogAnalytics.init(apiKey, platform);
}

/**
 * Capture a single analytics event
 */
export function analytics(params: EventMessageV1): void {
  PostHogAnalytics.getInstance().capture(params);
}

/**
 * Allows to send bulk analytics requests from the AWS Lambdas
 */
export function shutdown(): Promise<void> {
  return PostHogAnalytics.getInstance().shutdown();
}
