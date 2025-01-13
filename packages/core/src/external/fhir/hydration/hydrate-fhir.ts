import { Bundle, CodeableConcept, Parameters, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { EventMessageV1 } from "../../analytics/posthog";
import {
  buildTermServerParameter,
  buildTermServerParametersFromCodings,
  lookupMultipleCodes,
} from "../../term-server";

export async function hydrateFhir(
  fhirBundle: Bundle<Resource>,
  metrics: EventMessageV1
): Promise<Bundle<Resource>> {
  const hydratedBundle: Bundle = cloneDeep(fhirBundle);

  const lookupParametersMap = new Map<string, Parameters>();
  hydratedBundle.entry?.forEach(entry => {
    const res = entry.resource;
    if (!res) return;
    const code = getCodeFromResource(res);
    if (!code) return;

    const parameters = buildTermServerParametersFromCodings(code.coding);

    parameters?.forEach(param => {
      if (param.id) lookupParametersMap.set(param.id, param);
    });
  });

  const data = await lookupMultipleCodes(Array.from(lookupParametersMap.values()), metrics);
  if (!data) return hydratedBundle;

  const codesMap = new Map<string, object>();
  data.forEach(d => codesMap.set(d.id, d));

  let numCodes = 0;
  hydratedBundle.entry?.forEach(entry => {
    const res = entry.resource;
    if (!res) return;
    const code = getCodeFromResource(res);
    if (!code) return;

    code.coding?.forEach(coding => {
      if (coding.code && coding.system) {
        numCodes++;
        const param = buildTermServerParameter({ system: coding.system, code: coding.code });
        if (param && param.id) {
          const newMapping = codesMap.get(param.id);
          if (newMapping && "display" in newMapping) {
            coding.display = newMapping.display as string;
          }
        }
      }
    });
  });
  if (metrics.properties) metrics.properties.totalBundleCodes = numCodes;
  return hydratedBundle;
}

/**
 * Returns the code attribute from each resource based on its spec
 */
function getCodeFromResource(res: Resource): CodeableConcept | undefined {
  if (
    res.resourceType === "DiagnosticReport" ||
    res.resourceType === "Medication" ||
    res.resourceType === "Condition" ||
    res.resourceType === "AllergyIntolerance" ||
    res.resourceType === "Procedure" ||
    res.resourceType === "Observation" ||
    res.resourceType === "ServiceRequest"
  ) {
    return res.code;
  } else if (res.resourceType === "Immunization") {
    return res.vaccineCode;
  } else if (res.resourceType === "Practitioner") {
    return res.qualification?.[0];
  } else if (res.resourceType === "Encounter" || res.resourceType === "Location") {
    return res.type?.[0];
  } else if (res.resourceType === "Composition") {
    return res.type;
  }
  return undefined;
}
