import { Condition } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ICD_10_URL } from "../../../../util/constants";
import { chronicityMap } from "../../shared/chronicity-map";
import { getHccForIcd10Code } from "../../shared/hcc-map";
import {
  buildChronicityExtension,
  ChronicityExtension,
  findChronicityExtension,
} from "../../shared/extensions/chronicity-extension";
import { buildHccExtensions, HccExtension } from "../../shared/extensions/hcc-extension";

export function normalizeConditions(conditions: Condition[]): Condition[] {
  return conditions.map(condition => {
    const updCondition = cloneDeep(condition);
    let chronicityExtension: ChronicityExtension | undefined;
    let hccExtensions: HccExtension[] | undefined;

    updCondition.code?.coding?.forEach(coding => {
      if (coding.system !== ICD_10_URL) return;

      if (coding.code) {
        const codeWithoutDot = coding.code.replace(".", "");
        const chronicity = chronicityMap[codeWithoutDot];
        const hccCode = getHccForIcd10Code(codeWithoutDot);

        if (chronicity) {
          const existingChronicityExtension = findChronicityExtension(updCondition.extension ?? []);
          if (existingChronicityExtension) {
            return;
          }
          chronicityExtension = buildChronicityExtension(chronicity);
        }
        if (hccCode) {
          // const existingHccExtension = findHccExtension(updCondition.extension ?? []);
          // if (existingHccExtension) {
          //   return;
          // }
          hccExtensions = buildHccExtensions(hccCode);
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

    if (hccExtensions) {
      if (!updCondition.extension) {
        updCondition.extension = hccExtensions;
      } else {
        updCondition.extension = [...updCondition.extension, ...hccExtensions];
      }
    }

    return updCondition;
  });
}
