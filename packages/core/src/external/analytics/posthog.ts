import { errorToString } from "@metriport/shared";
import { PostHog } from "posthog-node";
import { out } from "../../util";
import { Config } from "../../util/config";
import { MetriportError } from "../../util/error/metriport-error";

const GROUP_TYPE = "customer";
const { log } = out("posthog-analytics");
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

// TODO: 2731 - Create helper functions to create analytics events

class PostHogAnalytics {
  private static instance: PostHogAnalytics;
  private client?: PostHog;
  private platform: "oss-api" | "lambda";

  private constructor(apiKey: string, platform: "oss-api" | "lambda") {
    this.client = new PostHog(apiKey);
    this.platform = platform;
  }

  /**
   * Initialize PostHog analytics - should be called once on API startup or Lambda init
   */
  static init(apiKey: string, platform: "oss-api" | "lambda"): PostHogAnalytics {
    if (!this.instance) {
      this.instance = new PostHogAnalytics(apiKey, platform);
    }
    return this.instance;
  }

  static getInstance(): PostHogAnalytics {
    if (!this.instance) {
      throw new MetriportError("PostHog instance not initialized - call init() first");
    }
    return this.instance;
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
export function initPostHog(apiKey: string, platform: "oss-api" | "lambda"): PostHogAnalytics {
  PostHogAnalytics.init(apiKey, platform);
  return PostHogAnalytics.getInstance();
}

/**
 * Capture a single analytics event
 */
export function analytics(params: EventMessageV1): void {
  try {
    PostHogAnalytics.getInstance().capture(params);
  } catch (error) {
    log(`Failed to capture analytics: ${errorToString(error)}`);
  }
}
