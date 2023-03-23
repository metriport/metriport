import { PostHog } from "posthog-node";
import { Request } from "express";
import url from "url";

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

  client.capture({
    distinctId: cxId,
    event: message,
    properties: {
      method: req.method,
      url: url.parse(req.url).pathname,
      environment: Config.getEnvironment(),
      apiType,
    },
  });
};

export const client = new PostHog(Config.getPostHogApiKey());
