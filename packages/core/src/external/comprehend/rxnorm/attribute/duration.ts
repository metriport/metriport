import { RxNormEntity, RxNormAttributeType } from "@aws-sdk/client-comprehendmedical";
import { Period } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";

export function buildDuration(entity: RxNormEntity): Period | undefined {
  const duration = getAttribute(entity, RxNormAttributeType.DURATION);
  const durationValue = duration?.Text;
  if (!durationValue) return undefined;
  // TODO: parse durationValue into a Period
  return undefined;
}
