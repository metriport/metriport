import { Bundle, Condition, Medication, Parameters, Resource } from "@medplum/fhirtypes";
import { ICD_10_URL, NDC_URL, RXNORM_URL, SNOMED_URL } from "@metriport/shared/medical";
import { cloneDeep } from "lodash";
import { isUnknownCoding } from "../../../fhir-deduplication/shared";
import { executeAsynchronously } from "../../../util/concurrency";
import {
  buildFhirParametersFromCoding,
  buildMultipleFhirParametersFromCodings,
  crosswalkCode,
  lookupMultipleCodes,
} from "../../term-server";
import { findCodeableConcepts, isUsefulDisplay } from "../codeable-concept";
import { isCondition, isMedication } from "../shared";

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

  const lookupParametersMap = new Map<string, Parameters>();
  if (hydratedBundle.entry) {
    await executeAsynchronously(
      hydratedBundle.entry,
      async entry => {
        const res = entry.resource;
        if (!res) return;

        // TODO: ENG-1149 - Refactor to use batch crosswalk
        if (isCondition(res)) {
          await dangerouslyHydrateCondition(res);
        } else if (isMedication(res)) {
          await dangerouslyHydrateMedication(res);
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
 * This function hydrates the condition by crosswalking the SNOMED code to the ICD-10 code
 * if it doesn't already have an ICD-10 code.
 */
async function dangerouslyHydrateCondition(condition: Condition): Promise<void> {
  const snomedCode = condition.code?.coding?.find(coding => coding.system === SNOMED_URL);
  if (!snomedCode || !snomedCode.code) return;

  const existingIcd10Code = condition.code?.coding?.find(coding => coding.system === ICD_10_URL);
  if (existingIcd10Code && !isUnknownCoding(existingIcd10Code)) return;

  const icd10Code = await crosswalkCode({
    sourceCode: snomedCode.code,
    sourceSystem: SNOMED_URL,
    targetSystem: ICD_10_URL,
  });
  if (!icd10Code) return;

  condition.code?.coding?.push(icd10Code);
  return;
}

/**
 * This function hydrates the medication by crosswalking the NDC code to the RXNorm code.
 * if it doesn't already have an RXNorm code.
 */
async function dangerouslyHydrateMedication(medication: Medication): Promise<void> {
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
