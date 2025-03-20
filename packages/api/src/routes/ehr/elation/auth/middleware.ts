import { buildDayjs } from "@metriport/shared/common/date";
import { elationDashSource } from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import { isSubscriptionResource } from "@metriport/shared/interface/external/ehr/elation/subscription";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { getJwtToken, updateTokenExpiration } from "../../../../command/jwt-token";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { shortDurationTokenDuration } from "../../../../external/ehr/elation/command/sync-patient";
import { getElationSigningKeyInfo } from "../../../../external/ehr/elation/shared";
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
    const signingKeyInfo = await getElationSigningKeyInfo(applicationId, webhookResource);
    const verified = verifyWebhookSignature(signingKeyInfo.signingKey, req.body, signature);
    if (verified) {
      req.cxId = signingKeyInfo.cxId;
      req.query = {
        ...req.query,
        practiceId: signingKeyInfo.practiceId,
      };
      return;
    }
  } catch (error) {
    throw new ForbiddenError();
  }
  throw new ForbiddenError();
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
  const newKey = createPublicKey(key);
  const newBody = createJsonDumpsBody(body);
  const verified = crypto.verify(
    null,
    Buffer.from(newBody),
    newKey,
    Buffer.from(signature, "base64")
  );
  return verified;
}

function createPublicKey(key: string) {
  return `
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA${key}
-----END PUBLIC KEY-----
  `;
}

function createJsonDumpsBody(body: object) {
  return JSON.stringify(body).replaceAll('":', '": ').replaceAll(',"', ', "');
}
