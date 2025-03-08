import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { elationWebhookJwtTokenSource } from "../../../../external/ehr/elation/shared";
import { ParseResponse, processCxIdAsync } from "../../shared";

function parseElationPracticeIdWebhook(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== elationWebhookJwtTokenSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
    },
  };
}

export function processCxIdWebhooks(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, elationWebhookJwtTokenSource, parseElationPracticeIdWebhook)
    .then(next)
    .catch(next);
}
