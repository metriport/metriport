import { MedicationStatement } from "@medplum/fhirtypes";
import { combineResources, fillMaps, getDateFromResource } from "../shared";

export function deduplicateMedStatements(medications: MedicationStatement[]): {
  combinedMedStatements: MedicationStatement[];
  refReplacementMap: Map<string, string[]>;
} {
  const { medStatementsMap, remainingMedStatements, refReplacementMap } =
    groupSameMedStatements(medications);
  return {
    combinedMedStatements: combineResources({
      combinedMaps: [medStatementsMap],
      remainingResources: remainingMedStatements,
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
export function groupSameMedStatements(medStatements: MedicationStatement[]): {
  medStatementsMap: Map<string, MedicationStatement>;
  remainingMedStatements: MedicationStatement[];
  refReplacementMap: Map<string, string[]>;
} {
  const medStatementsMap = new Map<string, MedicationStatement>();
  const refReplacementMap = new Map<string, string[]>();
  const remainingMedStatements: MedicationStatement[] = [];

  for (const medStatement of medStatements) {
    const medRef = medStatement.medicationReference?.reference;
    const date = getDateFromResource(medStatement, "date-hm");
    const status = medStatement.status;
    if (medRef) {
      const key = JSON.stringify({ medRef, status, date });
      fillMaps(medStatementsMap, key, medStatement, refReplacementMap);
    } else {
      remainingMedStatements.push(medStatement);
    }
  }

  return {
    medStatementsMap,
    remainingMedStatements,
    refReplacementMap: refReplacementMap,
  };
}
