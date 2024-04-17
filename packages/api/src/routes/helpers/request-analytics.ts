import { Request } from "express";
import QueryString from "qs";
import { analytics, EventTypes } from "../../shared/analytics";
import { getCxId, getCxIdFromHeaders } from "../util";

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
  params,
  query,
  duration,
}: {
  req: Request;
  method: string;
  url: string;
  params: Record<string, string> | undefined;
  query: QueryString.ParsedQs | undefined;
  duration: number;
}): void => {
  const reqCxId = getCxId(req);
  const headerCxId = getCxIdFromHeaders(req);
  const cxId = reqCxId ?? headerCxId;

  const isDevices = devicesRoutes.some(route => url.includes(route));

  if (!isDevices && cxId) {
    analytics({
      event: EventTypes.query,
      distinctId: cxId,
      properties: {
        method,
        url,
        duration,
        ...params,
        ...query,
      },
    });
  }
};
