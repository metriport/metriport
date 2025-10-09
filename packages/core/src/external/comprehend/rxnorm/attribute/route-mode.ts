import { RxNormAttributeType, RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { CodeableConcept } from "@medplum/fhirtypes";
import { getAllAttributes } from "../shared";
import { getRouteCode } from "../../../fhir/parser/route-codes";

/**
 * Builds the codeable concept for the route or mode of the medication.
 * @param entity
 * @returns
 */
export function buildRouteOrMode(entity: RxNormEntity): CodeableConcept[] | undefined {
  const routesOrModes = getAllAttributes(entity, RxNormAttributeType.ROUTE_OR_MODE);
  if (!routesOrModes.length) return undefined;

  const codeableConcepts: CodeableConcept[] = [];

  for (const routeOrMode of routesOrModes) {
    const text = routeOrMode.Text;
    if (!text) continue;
    const code = getRouteCode(text);
    if (code) {
      codeableConcepts.push(code);
    }
  }

  return codeableConcepts.length ? codeableConcepts : undefined;
}
