import { RxNormEntity, RxNormAttributeType } from "@aws-sdk/client-comprehendmedical";
import { Period } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";
import { parsePeriod } from "../../../fhir/parser/period";
import { ComprehendContext } from "../../types";

export function buildEffectivePeriod(
  entity: RxNormEntity,
  { dateWritten }: ComprehendContext
): Period | undefined {
  const duration = getAttribute(entity, RxNormAttributeType.DURATION);
  const durationValue = duration?.Text;
  if (!durationValue) return undefined;
  return parsePeriod(durationValue, dateWritten);
}
