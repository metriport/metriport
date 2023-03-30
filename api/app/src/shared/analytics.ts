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
  // WILL REMOVE AFTER DEBUGGING
  console.log(postApiKey, "i am the post hog key");
  if (postApiKey) {
    const posthog = new PostHog(postApiKey);

    console.log(posthog, "i am posthog");

    params.properties = {
      ...params.properties,
      environment: Config.getEnvironment(),
      platform: "oss-api",
    };

    posthog.capture(params);
  }
};

export enum EventTypes {
  query = "query",
  error = "error",
}

export enum EventErrMessage {
  no_access = "no access",
}
