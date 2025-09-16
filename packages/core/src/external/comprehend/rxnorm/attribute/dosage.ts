import { RxNormEntity, RxNormAttributeType } from "@aws-sdk/client-comprehendmedical";
import { Dosage } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";
import { parseTiming } from "../../../fhir/parser/timing";
import { parseDosage } from "../../../fhir/parser/dosage";
import { getRouteCode } from "../../../fhir/parser/route-codes";

export function buildDosage(entity: RxNormEntity): Dosage | undefined {
  // -> dosage.text or dosage.doseAndRate.doseQuantity
  const dosage = getAttribute(entity, RxNormAttributeType.DOSAGE);
  const frequency = getAttribute(entity, RxNormAttributeType.FREQUENCY);
  const routeOrMode = getAttribute(entity, RxNormAttributeType.ROUTE_OR_MODE);

  const dosageText = dosage?.Text;
  const timing = frequency && frequency.Text ? parseTiming(frequency.Text) : undefined;
  const doseAndRate = dosageText ? parseDosage(dosageText) : undefined;
  const route = routeOrMode && routeOrMode.Text ? getRouteCode(routeOrMode.Text) : undefined; // TODO: add route code to dosage

  return {
    ...(dosageText ? { text: dosageText } : undefined),
    ...(doseAndRate ? { doseAndRate: [doseAndRate] } : undefined),
    ...(timing ? { timing } : undefined),
    ...(route ? { route } : undefined),
  };
}
