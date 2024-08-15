import { MedicationAdministration } from "@medplum/fhirtypes";
import { combineResources, fillMaps, getDateFromResource } from "../shared";

export function deduplicateMedAdmins(medications: MedicationAdministration[]): {
  combinedMedAdmins: MedicationAdministration[];
  refReplacementMap: Map<string, string[]>;
} {
  const { medAdminsMap, remainingMedAdmins, refReplacementMap } = groupSameMedAdmins(medications);
  return {
    combinedMedAdmins: combineResources({
      combinedMaps: [medAdminsMap],
      remainingResources: remainingMedAdmins,
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - medicationReference ID
 * - status
 * - date
 */
export function groupSameMedAdmins(medAdmins: MedicationAdministration[]): {
  medAdminsMap: Map<string, MedicationAdministration>;
  remainingMedAdmins: MedicationAdministration[];
  refReplacementMap: Map<string, string[]>;
} {
  const medAdminsMap = new Map<string, MedicationAdministration>();
  const refReplacementMap = new Map<string, string[]>();
  const remainingMedAdmins: MedicationAdministration[] = [];

  for (const medAdmin of medAdmins) {
    const date = getDateFromResource(medAdmin, "date-hm");
    const status = medAdmin.status;
    const medRef = medAdmin.medicationReference?.reference;
    const dosage = medAdmin.dosage;

    if (medRef && dosage) {
      const key = JSON.stringify({ medRef, status, date, dosage });
      fillMaps(medAdminsMap, key, medAdmin, refReplacementMap);
    } else {
      remainingMedAdmins.push(medAdmin);
    }
  }

  return {
    medAdminsMap,
    remainingMedAdmins,
    refReplacementMap: refReplacementMap,
  };
}

// type CompositeKey = {
//   refId: string;
//   date: string | undefined;
//   dosage: MedicationAdministrationDosage | undefined;
// };

// function createCompositeKey(
//   refId: string,
//   date: string | undefined,
//   dosage: MedicationAdministrationDosage | undefined
// ): CompositeKey {
//   return {
//     refId,
//     date,
//     dosage,
//   };
// }
