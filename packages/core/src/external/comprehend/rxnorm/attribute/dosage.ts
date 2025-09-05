import { RxNormEntity, RxNormAttributeType } from "@aws-sdk/client-comprehendmedical";
import { Dosage } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";
import { parseTimingFromString } from "../../../fhir/parser/timing";

export function buildDosage(entity: RxNormEntity): Dosage | undefined {
  // -> dosage.text or dosage.doseAndRate.doseQuantity
  const dosage = getAttribute(entity, RxNormAttributeType.DOSAGE);
  const frequency = getAttribute(entity, RxNormAttributeType.FREQUENCY);
  // const rate = getAttribute(entity, RxNormAttributeType.RATE);

  // if (!frequency && !rate) return undefined;
  const timing = frequency && frequency.Text ? parseTimingFromString(frequency.Text) : undefined;

  return {
    text: dosage?.Text ?? "",
    doseAndRate: [
      {
        rateQuantity: {
          value: 1,
          unit: "mg",
        },
      },
    ],
    ...(timing ? { timing } : undefined),
  };
}
