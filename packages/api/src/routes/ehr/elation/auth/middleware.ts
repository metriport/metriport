import { elationWebhookSource } from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { ParseResponse, processCxIdAsync } from "../../shared";

function parseElationPracticeIdWebhook(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== elationWebhookSource) throw new ForbiddenError();
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
  processCxIdAsync(req, elationWebhookSource, parseElationPracticeIdWebhook).then(next).catch(next);
}
