import { Condition } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ICD_10_URL } from "../../../../util/constants";
import { chronicityMap } from "../../shared/chronicity-map";
import { buildChronicityExtension } from "../../shared/extensions/chronicity-extension";

export function normalizeConditions(conditions: Condition[]): Condition[] {
  return conditions.map(condition => {
    const updCondition = cloneDeep(condition);
    const icdCodings = updCondition.code?.coding?.map(coding => {
      if (coding.system !== ICD_10_URL) return coding;

      if (coding.code) {
        const chronicity = chronicityMap[coding.code.replace(".", "")];
        if (chronicity) {
          const chronicityExtension = buildChronicityExtension(chronicity);
          coding.extension = [chronicityExtension];
        }
      }

      return coding;
    });

    if (updCondition.code && icdCodings) {
      updCondition.code.coding = icdCodings;
    }

    return updCondition;
  });
}
