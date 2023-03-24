import { NextFunction, Request, Response } from "express";
import url from "url";

import { getCxIdOrFail } from "../util";
import { ApiTypes } from "../../command/usage/report-usage";
import { Config } from "../../shared/config";
import { analytics } from "../../shared/analytics";

export const analyzeRoute = (apiType: ApiTypes) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const cxId = getCxIdOrFail(req);

    // Link route gets converted to /patient/2.16.840.1.113883.3.9621.5.505.2.1000000004/link
    // Should we maybe consider /link with patientId as a query?
    const reqUrl = apiType === ApiTypes.devices ? req.baseUrl : url.parse(req.url).pathname;

    analytics.capture({
      distinctId: cxId,
      event: "query",
      properties: {
        method: req.method,
        url: reqUrl,
        environment: Config.getEnvironment(),
        apiType,
      },
    });

    next();
  };
};

export const analyzeMedicalRoutes = analyzeRoute(ApiTypes.medical);
export const analyzeDevicesRoutes = analyzeRoute(ApiTypes.devices);
