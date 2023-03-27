import { PostHog } from "posthog-node";
import { EventMessageV1 } from "posthog-node/src/types";
import { Config } from "./config";

const postApiKey = Config.getPostHogApiKey();

export const analytics = (params: EventMessageV1) => {
  if (postApiKey) {
    const posthog = new PostHog(postApiKey);

    params.properties = {
      ...params.properties,
      environment: Config.getEnvironment(),
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
