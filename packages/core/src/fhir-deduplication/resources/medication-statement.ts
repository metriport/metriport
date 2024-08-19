import { MedicationStatement } from "@medplum/fhirtypes";
import {
  combineResources,
  fillMaps,
  getDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";

const medicationStatementStatus = [
  "active",
  "completed",
  "entered-in-error",
  "intended",
  "stopped",
  "on-hold",
  "unknown",
  "not-taken",
] as const;
export type MedicationStatementStatus = (typeof medicationStatementStatus)[number];

const statusRanking = {
  unknown: 0,
  "entered-in-error": 1,
  intended: 2,
  "not-taken": 3,
  "on-hold": 4,
  active: 5,
  stopped: 6,
  completed: 7,
};

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

  function assignMostDescriptiveStatus(
    master: MedicationStatement,
    existing: MedicationStatement,
    target: MedicationStatement
  ): MedicationStatement {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const medStatement of medStatements) {
    const date = getDateFromResource(medStatement, "date-hm");
    const medRef = medStatement.medicationReference?.reference;
    const dosage = medStatement.dosage;
    if (medRef) {
      const key = JSON.stringify({ medRef, date, dosage });
      fillMaps(
        medStatementsMap,
        key,
        medStatement,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
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
