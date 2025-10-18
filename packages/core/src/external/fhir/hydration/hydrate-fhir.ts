import { Bundle, Encounter, Medication, Parameters, Resource } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { NDC_URL, RXNORM_URL } from "@metriport/shared/medical";
import { cloneDeep } from "lodash";
import { isUnknownCoding } from "../../../fhir-deduplication/shared";
import { capture } from "../../../util";
import { executeAsynchronously } from "../../../util/concurrency";
import {
  buildFhirParametersFromCoding,
  buildMultipleFhirParametersFromCodings,
  crosswalkCode,
  lookupMultipleCodes,
} from "../../term-server";
import { findCodeableConcepts, isUsefulDisplay } from "../codeable-concept";
import { findPatientResource, isCondition, isEncounter, isMedication } from "../shared";
import { dangerouslyHydrateCondition } from "./resources/condition";

const NUMBER_OF_PARALLEL_CROSSWALKS = 10;

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

  const crosswalkErrors: string[] = [];
  const lookupParametersMap = new Map<string, Parameters>();
  if (hydratedBundle.entry) {
    const encounters = hydratedBundle.entry
      .filter(entry => isEncounter(entry.resource))
      .map(entry => entry.resource as Encounter);
    const patientResource = findPatientResource(hydratedBundle);
    const patientId = patientResource?.id;

    await executeAsynchronously(
      hydratedBundle.entry,
      async entry => {
        const res = entry.resource;
        if (!res) return;

        // TODO: ENG-1149 - Refactor to use batch crosswalk
        try {
          if (isCondition(res)) {
            await dangerouslyHydrateCondition(res, encounters, patientId);
          } else if (isMedication(res)) {
            await dangerouslyHydrateMedication(res);
          }
        } catch (err) {
          // Keep processing other entries even if one crosswalk fails.
          const errorString = errorToString(err, { detailed: true });
          log(`[hydrateFhir] crosswalk failed for ${res.resourceType}: ${errorString}`);
          crosswalkErrors.push(errorString);
        }

        const codes = findCodeableConcepts(res);

        codes.forEach(code => {
          const parameters = buildMultipleFhirParametersFromCodings(code.coding);

          parameters?.forEach(param => {
            if (param.id) lookupParametersMap.set(param.id, param);
          });
        });
      },
      {
        numberOfParallelExecutions: NUMBER_OF_PARALLEL_CROSSWALKS,
      }
    );
  }

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

  if (crosswalkErrors.length > 0) {
    const msg = `Hydration crosswalk errors`;
    const patientResource = findPatientResource(hydratedBundle);
    capture.error(msg, {
      extra: { crosswalkErrors: crosswalkErrors.join("\n "), patientId: patientResource?.id },
    });
  }

  return {
    metadata: {
      ...result.metadata,
      totalBundleCodes: numCodes,
      numReplaced,
      percentReplaced: (numReplaced / numCodes) * 100,
      numMissingDisplays,
      percentFilled: (numMissingDisplays / numCodes) * 100,
    },
    data: hydratedBundle,
  };
}

/**
 * This function hydrates the medication by crosswalking the NDC code to the RXNorm code.
 * if it doesn't already have an RXNorm code.
 */
export async function dangerouslyHydrateMedication(medication: Medication): Promise<void> {
  const existingRxNormCode = medication.code?.coding?.find(coding => coding.system === RXNORM_URL);
  if (existingRxNormCode && !isUnknownCoding(existingRxNormCode)) return;

  const ndcCode = medication.code?.coding?.find(coding => coding.system === NDC_URL);
  if (!ndcCode || !ndcCode.code) return;

  const rxNormCode = await crosswalkCode({
    sourceCode: ndcCode.code,
    sourceSystem: NDC_URL,
    targetSystem: RXNORM_URL,
  });
  if (!rxNormCode) return;
  medication.code?.coding?.push(rxNormCode);
  return;
}
