import { MedicationAdministration, MedicationAdministrationDosage } from "@medplum/fhirtypes";
import { combineResources, fillMaps } from "../shared";

export function deduplicateMedAdmins(medications: MedicationAdministration[]): {
  combinedMedAdmins: MedicationAdministration[];
  idReplacementMap: Map<string, string[]>;
} {
  const { medAdminsMap, remainingMedAdmins, idReplacementMap } = groupSameMedAdmins(medications);
  return {
    combinedMedAdmins: combineResources({
      combinedMaps: [medAdminsMap],
      remainingResources: remainingMedAdmins,
    }),
    idReplacementMap,
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
  idReplacementMap: Map<string, string[]>;
} {
  const medAdminsMap = new Map<string, MedicationAdministration>();
  const idReplacementMap = new Map<string, string[]>();
  const remainingMedAdmins: MedicationAdministration[] = [];

  for (const medAdmin of medAdmins) {
    // TODO: Deal with medications that contain >1 rxnorm / ndc code
    // const date = getDate(medAdmin);
    const medRef = medAdmin.medicationReference?.reference;
    const dosage = medAdmin.dosage;

    if (medRef && dosage) {
      const key = JSON.stringify(createCompositeKey(medRef, dosage));
      fillMaps(medAdminsMap, key, medAdmin, idReplacementMap);
    } else {
      remainingMedAdmins.push(medAdmin);
    }
  }

  return {
    medAdminsMap,
    remainingMedAdmins,
    idReplacementMap,
  };
}

type CompositeKey = {
  refId: string;
  dosage: MedicationAdministrationDosage | undefined;
};

function createCompositeKey(
  refId: string,
  dosage: MedicationAdministrationDosage | undefined
): CompositeKey {
  return {
    refId,
    dosage,
  };
}
