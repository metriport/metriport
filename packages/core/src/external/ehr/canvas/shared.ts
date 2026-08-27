import { JwtTokenInfo } from "@metriport/shared";
import {
  CanvasAdtEventType,
  canvasAdtEventTypes,
} from "@metriport/shared/interface/external/ehr/canvas/external-event";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import CanvasApi from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getSecretsOauthSchema } from "../secrets";

export async function createCanvasClient({
  cxId,
  practiceId,
  tokenInfo,
}: {
  cxId: string;
  practiceId: string;
  tokenInfo?: JwtTokenInfo;
}) {
  const secrets = await getSecrets({
    cxId,
    practiceId,
    ehr: EhrSources.canvas,
    schema: getSecretsOauthSchema,
  });
  return await CanvasApi.create({
    twoLeggedAuthTokenInfo: tokenInfo,
    practiceId,
    environment: secrets.environment,
    clientKey: secrets.clientKey,
    clientSecret: secrets.clientSecret,
  });
}

export function isCanvasSupportedAdtEvent(
  triggerOrEventType: string
): triggerOrEventType is CanvasAdtEventType {
  const eventType = triggerOrEventType.startsWith("ADT^")
    ? triggerOrEventType
    : `ADT^${triggerOrEventType}`;
  return (canvasAdtEventTypes as readonly string[]).includes(eventType);
}
