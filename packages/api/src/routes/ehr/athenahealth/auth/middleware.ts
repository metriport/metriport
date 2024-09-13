import { NextFunction, Request, Response } from "express";
import { getCxMapping } from "../../../../command/mapping/cx";
import { getPatientMapping } from "../../../../command/mapping/patient";
import { getJwtToken } from "../../../../command/jwt-token";
import { EhrSources } from "../../../../external/ehr/shared";
import { getAuthorizationToken } from "../../../util";
import { patientParamRoutes } from "../../shared";
import NotFoundError from "../../../../errors/not-found";

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
  if (!authInfo) throw new NotFoundError(`No AthenaHealth token found`);
  const cxExternalId = (authInfo.data as { ah_practice?: string }).ah_practice;
  if (!cxExternalId) throw new Error(`No AthenaHealth externalId value found`);
  const existingCustomer = await getCxMapping({
    externalId: cxExternalId,
    source: EhrSources.ATHENA,
  });
  if (!existingCustomer) throw new NotFoundError(`No AthenaHealth customer found for externalId`);
  const cxId = existingCustomer.cxId;
  req.cxId = cxId;
  let patientExternalId: string | undefined = undefined;
  if (req.path.startsWith(patientParamRoutes.basePath)) {
    patientParamRoutes.paramPaths.map(path => {
      const matches = req.path.match(path.regex);
      if (matches) patientExternalId = matches[path.matchIndex];
    });
    if (patientExternalId) {
      const patietMapping = await getPatientMapping({
        cxId,
        externalId: patientExternalId,
        source: EhrSources.ATHENA,
      });
      if (!patietMapping) throw new NotFoundError(`No AthenaHealth patient found for customer`);
      req.params.id = patietMapping.patientId;
    }
  }
}
