import { NextFunction, Request, Response } from "express";
import { verifyAthena } from "@metriport/core/external/athenahealth/verify-token";
import { hasEhrAccess } from "../../../external/athenahealth/command/access";
import { Config } from "../../../shared/config";

const athenaUrl = Config.getAthenaHealthUrl();

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req)
    .then(() => next())
    .catch(next);
}

async function processCxIdAsync(req: Request): Promise<void> {
  if (!athenaUrl) throw new Error("AthenaHealth not setup");
  const accessToken = req.header("Authorization");
  if (!accessToken) throw new Error("No access token");
  const authInfo = await verifyAthena({
    accessToken,
    baseUrl: athenaUrl,
  });
  const ehrId = authInfo.ah_practice;
  const cxId = await hasEhrAccess({
    ehrId,
    ehrName: "athena",
  });
  if (!cxId) throw new Error(`No AthenaHealth Access found for ehrId ${ehrId}`);
  req.cxId = cxId;
}
