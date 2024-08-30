import { NextFunction, Request, Response } from "express";
import { getCxMapping } from "../../../../command/mapping/cx";
import { getJwtToken } from "../../../../command/jwt-token";
import { EhrSources } from "../../../../external/ehr/shared";
import { getAuthorizationToken } from "../../../util";

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req)
    .then(() => next())
    .catch(next);
}

async function processCxIdAsync(req: Request): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({
    token: accessToken,
    source: EhrSources.ATHENA,
  });
  if (!authInfo) throw new Error(`No AthenaHealth token found`);
  const externalId = (authInfo.data as { ah_practice?: string }).ah_practice;
  if (!externalId) {
    throw new Error(
      `No AthenaHealth externalId value found for token ${accessToken.slice(0, 5) + "..."}`
    );
  }
  const existingCustomer = await getCxMapping({
    externalId,
    source: EhrSources.ATHENA,
  });
  if (!existingCustomer) throw new Error(`No AthenaHealth cxId found for externalId ${externalId}`);
  req.cxId = existingCustomer.cxId;
}
