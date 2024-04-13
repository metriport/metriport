import { PostHog } from "posthog-node";
import { Product } from "../domain/product";
import { Config } from "./config";

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

const postApiKey = Config.getPostHogApiKey();

export const analytics = (params: EventMessageV1 & { apiType: Product | "internal" }) => {
  if (postApiKey) {
    const posthog = new PostHog(postApiKey);

    params.properties = {
      ...(params.properties ? { ...params.properties } : undefined),
      environment: Config.getEnvType(),
      platform: "oss-api",
      apiType: params.apiType,
      $set_once: {
        cxId: params.distinctId,
      },
    };

    posthog.capture(params);
  }
};

export enum EventTypes {
  query = "query",
  webhook = "webhook",
  error = "error",
  addressRelevance = "addressRelevance",
  patientDiscovery = "patientDiscovery",
  documentQuery = "documentQuery",
  documentConversion = "documentConversion",
  consolidatedQuery = "consolidatedQuery",
}

export enum EventErrMessage {
  no_access = "no access",
}
