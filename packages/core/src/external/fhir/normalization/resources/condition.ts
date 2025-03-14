import { Condition } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ICD_10_URL } from "../../../../util/constants";
import { chronicityMap } from "../../shared/chronicity-map";
import {
  ChronicityExtension,
  buildChronicityExtension,
} from "../../shared/extensions/chronicity-extension";

export function normalizeConditions(conditions: Condition[]): Condition[] {
  return conditions.map(condition => {
    const updCondition = cloneDeep(condition);
    let chronicityExtension: ChronicityExtension | undefined;

    updCondition.code?.coding?.forEach(coding => {
      if (coding.system !== ICD_10_URL) return;

      if (coding.code) {
        const chronicity = chronicityMap[coding.code.replace(".", "")];
        if (chronicity) {
          chronicityExtension = buildChronicityExtension(chronicity);
        }
      }
    });

    if (chronicityExtension) {
      if (!updCondition.extension) {
        updCondition.extension = [chronicityExtension];
      } else {
        updCondition.extension = [...updCondition.extension, chronicityExtension];
      }
    }

    return updCondition;
  });
}
