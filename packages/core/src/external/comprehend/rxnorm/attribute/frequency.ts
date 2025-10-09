import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { Timing } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";
import { RxNormAttributeType } from "@aws-sdk/client-comprehendmedical";
import { isLatinSigCode, getTimingRepeatForLatinSigCode } from "./frequency/latin-sig-code";

export function buildFrequency(entity: RxNormEntity): Timing | undefined {
  const frequency = getAttribute(entity, RxNormAttributeType.FREQUENCY);
  if (!frequency) return undefined;

  const text = frequency.Text;
  if (!text) return undefined;

  if (isLatinSigCode(text)) {
    const repeat = getTimingRepeatForLatinSigCode(text);
    if (!repeat) return undefined;
    return {
      repeat,
    };
  }

  return undefined;
}
