import { PostHog } from "posthog-node";
import { Request } from "express";

import { Config } from "./config";
import { getCxId } from "../routes/util";

export const queryAnalytics = ({
  message,
  req,
  apiType,
}: {
  message: string;
  req: Request;
  apiType: string;
}): void => {
  const cxId = getCxId(req);

  if (!cxId) {
    return;
  }

  analytics.capture({
    distinctId: cxId,
    event: message,
    properties: {
      environment: Config.getEnvironment(),
      apiType,
    },
  });
};

export const analytics = new PostHog(Config.getPostHogApiKey());
