import { Request } from "express";
import { Product } from "../../domain/product";
import { EventTypes, analytics } from "../../shared/analytics";
import { getCxId, getCxIdFromHeaders } from "../util";

const medicalRoutes = ["medical", "fhir"];
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
  duration,
}: {
  req: Request;
  method: string;
  url: string;
  duration: number;
}): void => {
  const reqCxId = getCxId(req);
  const headerCxId = getCxIdFromHeaders(req);
  const cxId = reqCxId ?? headerCxId;

  const isMedical = medicalRoutes.some(route => url.includes(route));
  const isDevices = devicesRoutes.some(route => url.includes(route));

  const distinctId = cxId ?? "not-available";
  analytics({
    event: EventTypes.query,
    distinctId,
    properties: {
      method,
      url,
      ...(isMedical
        ? { apiType: Product.medical }
        : isDevices
        ? { apiType: Product.devices }
        : { apiType: "internal" }),
      duration,
    },
  });
};
