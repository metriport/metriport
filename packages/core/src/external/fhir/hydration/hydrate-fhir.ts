import { Bundle, Parameters, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import {
  buildFhirParametersFromCoding,
  buildMultipleFhirParametersFromCodings,
  lookupMultipleCodes,
} from "../../term-server";
import { findCodeableConcepts, isUsefulDisplay } from "../codeable-concept";

/**
 * This function first collects all of the different Coding elements from the Bundle,
 * creates FHIR Parameters[] from them, sends it to the Term Server for interpretation,
 * then looks thru the array again to replace the codes with the results.
 *
 * TODO: 2600 - Potential for code improvements
 * It uses UUID v3 for deterministic ID generation to allow us to cross-reference what we send to what we get back
 * from the Term Server. This approach has pros and cons:
 *
 * Pros:
 * - We use a map of IDs, so the result lookup is super quick
 *
 * Cons:
 * - This implementation doesn't allow us to obfuscate the Term Server-related logic outside of this function.
 */
export async function hydrateFhir(
  fhirBundle: Bundle<Resource>,
  log: typeof console.log
): Promise<{ metadata?: Record<string, string | number>; data: Bundle<Resource> }> {
  const hydratedBundle: Bundle = cloneDeep(fhirBundle);

  const lookupParametersMap = new Map<string, Parameters>();
  hydratedBundle.entry?.forEach(entry => {
    const res = entry.resource;
    if (!res) return;
    const codes = findCodeableConcepts(res);

    codes.forEach(code => {
      const parameters = buildMultipleFhirParametersFromCodings(code.coding);

      parameters?.forEach(param => {
        if (param.id) lookupParametersMap.set(param.id, param);
      });
    });
  });

  const lookupParametersArray = Array.from(lookupParametersMap.values());
  const result = await lookupMultipleCodes(lookupParametersArray, log);
  if (!result) return { data: hydratedBundle };

  const codesMap = new Map<string, object>();
  result.data.forEach(d => codesMap.set(d.id, d));

  let numCodes = 0;
  let numReplaced = 0;
  let numMissingDisplays = 0;
  hydratedBundle.entry?.forEach(entry => {
    const res = entry.resource;
    if (!res) return;
    const codes = findCodeableConcepts(res);

    codes.forEach(code => {
      code.coding?.forEach(coding => {
        if (coding.code && coding.system) {
          numCodes++;
          const param = buildFhirParametersFromCoding({ system: coding.system, code: coding.code });
          if (param && param.id) {
            const newMapping = codesMap.get(param.id);
            if (newMapping && "display" in newMapping && coding.display != newMapping.display) {
              if (!coding.display || !isUsefulDisplay(coding.display)) numMissingDisplays++;
              numReplaced++;
              coding.display = newMapping.display as string;
            }
          }
        }
      });
    });
  });

  return {
    metadata: {
      ...result.metadata,
      totalBundleCodes: numCodes,
      numCodesReplaced: numReplaced,
      percentReplaced: (numReplaced / numCodes) * 100,
      numMissingDisplays,
      percentFilled: (numMissingDisplays / numCodes) * 100,
    },
    data: hydratedBundle,
  };
}
