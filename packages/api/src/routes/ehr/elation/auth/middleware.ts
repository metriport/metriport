import { buildDayjs } from "@metriport/shared/common/date";
import { ElationSecondaryMappings } from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import { elationDashSource } from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import { isSubscriptionResource } from "@metriport/shared/interface/external/ehr/elation/subscription";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { NextFunction, Request, Response } from "express";
import { getJwtToken, updateTokenExpiration } from "../../../../command/jwt-token";
import { getCxMappingOrFail } from "../../../../command/mapping/cx";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { shortDurationTokenDuration } from "../../../../external/ehr/elation/command/sync-patient";
import { getCxIdAndPracticeIdFromElationApplicationId } from "../../../../external/ehr/elation/shared";
import { getAuthorizationToken } from "../../../util";
import {
  ParseResponse,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processPatientRoute as processPatientRouteShared,
} from "../../shared";

export const tokenEhrPatientIdQueryParam = "elationPatientIdFromToken";
const elationSignatureHeader = "el8-ed25519-signature";

async function processCxIdWebhook(req: Request): Promise<void> {
  const signature = req.headers[elationSignatureHeader];
  if (!signature) throw new ForbiddenError();
  if (Array.isArray(signature)) throw new ForbiddenError();
  const webhookResource = req.body.resource;
  if (!webhookResource) throw new ForbiddenError();
  if (!isSubscriptionResource(webhookResource)) throw new ForbiddenError();
  const applicationId = req.body.application_id;
  if (!applicationId) throw new ForbiddenError();
  try {
    const { cxId, practiceId } = getCxIdAndPracticeIdFromElationApplicationId(applicationId);
    const cxMapping = await getCxMappingOrFail({
      source: EhrSources.elation,
      externalId: practiceId,
    });
    const secondaryMappings = cxMapping.secondaryMappings as ElationSecondaryMappings;
    const key = secondaryMappings.webHooks?.[webhookResource];
    if (!key) throw new ForbiddenError();
    if (!verifyWebhookSignature(key.signingKey, req.body, signature)) throw new ForbiddenError();
    req.cxId = cxId;
    req.query = {
      ...req.query,
      practiceId,
    };
  } catch (error) {
    throw new ForbiddenError();
  }
}

function parseElationPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== elationDashSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  const patientId = tokenData.patientId;
  if (!patientId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
      [tokenEhrPatientIdQueryParam]: patientId,
    },
  };
}

async function shortenLongDurationToken(req: Request): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({ token: accessToken, source: elationDashSource });
  if (!authInfo) throw new ForbiddenError();
  const newExpiration = buildDayjs().add(shortDurationTokenDuration).toDate();
  if (authInfo.exp <= newExpiration) return;
  try {
    await updateTokenExpiration({ id: authInfo.id, exp: newExpiration });
  } catch (error) {
    throw new ForbiddenError();
  }
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, elationDashSource, parseElationPracticeIdDash)
    .then(() => shortenLongDurationToken(req))
    .then(next)
    .catch(next);
}

export function processCxIdWebhooks(req: Request, res: Response, next: NextFunction) {
  processCxIdWebhook(req).then(next).catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, elationDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, elationDashSource).then(next).catch(next);
}

function verifyWebhookSignature(key: string, body: object, signature: string): boolean {
  console.log("verifyWebhookSignature", key, body, signature);
  /*
  const newKey = crypto.createPublicKey(btoa(key));
  const verified = crypto.verify(null, Buffer.from(JSON.stringify(body)), newKey, Buffer.from(atob(signature)));
  return verified;
  */
  return true;
}
