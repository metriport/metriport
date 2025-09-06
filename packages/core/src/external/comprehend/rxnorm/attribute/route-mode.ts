import { RxNormAttributeType, RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { SNOMED_URL } from "@metriport/shared/medical";
import { CodeableConcept, Coding } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";

export function buildRouteOrMode(entity: RxNormEntity): CodeableConcept | undefined {
  const routeOrMode = getAttribute(entity, RxNormAttributeType.ROUTE_OR_MODE);
  if (!routeOrMode) return undefined;

  const text = routeOrMode.Text;
  if (!text) return undefined;

  if (isPerOs(text)) {
    return {
      coding: perOsCoding,
      text,
    };
  }

  return undefined;
}

/**
 * "p.o." (per os, Latin for "every day") is a common abbreviation for oral administration of medication.
 */
function isPerOs(text: string): boolean {
  return text.match(/^(p\.?o\.?|per os)$/gi) !== null;
}

const perOsCoding: Coding[] = [
  {
    system: SNOMED_URL,
    code: "26643006",
    display: "Oral route (qualifier value)",
  },
];
