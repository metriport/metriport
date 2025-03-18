import { Request } from "express";
import QueryString from "qs";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { getCxId, getCxIdFromHeaders, getCxIdFromQuery } from "../util";

const devicesRoutes = [
  "activity",
  "body",
  "biometrics",
  "nutrition",
  "sleep",
  "user",
  "connect",
  "garmin",
  "withings",
  "apple",
  "fitbit",
  "tenovi",
];

export const analyzeRoute = ({
  req,
  method,
  url,
  client,
  params,
  query,
  duration,
  status,
}: {
  req: Request;
  method: string;
  url: string;
  client: string | undefined;
  params: Record<string, string> | undefined;
  query: QueryString.ParsedQs | undefined;
  duration: number;
  status: number;
}): void => {
  const reqCxId = getCxId(req);
  const headerCxId = getCxIdFromHeaders(req);
  const queryCxId = getCxIdFromQuery(req);
  const cxId = reqCxId ?? headerCxId ?? queryCxId;

  const isDevices = devicesRoutes.some(route => url.includes(route));

  if (!isDevices && cxId) {
    analytics({
      event: EventTypes.query,
      distinctId: cxId,
      properties: {
        method,
        url,
        client,
        duration,
        status,
        ...params,
        ...query,
      },
    });
  }
};
