import { MedicationStatement } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  combineResources,
  createRef,
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

export const statusRanking: Record<MedicationStatementStatus, number> = {
  unknown: 0,
  "entered-in-error": 1,
  intended: 2,
  "not-taken": 3,
  "on-hold": 4,
  active: 5,
  stopped: 6,
  completed: 7,
};

export function deduplicateMedStatements(
  medications: MedicationStatement[]
): DeduplicationResult<MedicationStatement> {
  const { medStatementsMap, refReplacementMap, danglingReferences } =
    groupSameMedStatements(medications);
  return {
    combinedResources: combineResources({
      combinedMaps: [medStatementsMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const medStatementsMap = new Map<string, MedicationStatement>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

  function assignMostDescriptiveStatus(
    master: MedicationStatement,
    existing: MedicationStatement,
    target: MedicationStatement
  ): MedicationStatement {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const medStatement of medStatements) {
    const datetime = getDateFromResource(medStatement, "datetime");
    const medRef = medStatement.medicationReference?.reference;
    const dosage = medStatement.dosage;
    if (medRef && datetime && dosage) {
      const key = JSON.stringify({ medRef, datetime, dosage });
      fillMaps(
        medStatementsMap,
        key,
        medStatement,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else if (medRef && datetime) {
      const key = JSON.stringify({ medRef, datetime });
      fillMaps(
        medStatementsMap,
        key,
        medStatement,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else {
      danglingReferencesSet.add(createRef(medStatement));
    }
  }

  return {
    medStatementsMap,
    refReplacementMap: refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
