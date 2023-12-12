import { PostHog } from "posthog-node";
// import { EventMessageV1 } from "posthog-node/src/types";
import { Config } from "./config";

export interface IdentifyMessageV1 {
  distinctId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string | number, any>;
}

// TEMPORARY FIX - CANT EXPORT THE TYPE FROM MODULE
export interface EventMessageV1 extends IdentifyMessageV1 {
  event: string;
  groups?: Record<string, string | number>; // Mapping of group type to group id
  sendFeatureFlags?: boolean;
  timestamp?: Date;
}

const postApiKey = Config.getPostHogApiKey();

export const analytics = (params: EventMessageV1) => {
  if (postApiKey) {
    const posthog = new PostHog(postApiKey);

    params.properties = {
      ...params.properties,
      environment: Config.getEnvType(),
      platform: "oss-api",
    };

    posthog.capture(params);
  }
};

export enum EventTypes {
  query = "query",
  webhook = "webhook",
  error = "error",
  addressRelevance = "addressRelevance",
}

export enum EventErrMessage {
  no_access = "no access",
}
