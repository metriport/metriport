import { MedicationStatement } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  deduplicateWithinMap,
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
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const medStatementsMap = new Map<string, MedicationStatement>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function assignMostDescriptiveStatus(existing: MedicationStatement, target: MedicationStatement) {
    const status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    existing.status = status;
    target.status = status;
  }

  for (const medStatement of medStatements) {
    const datetime = getDateFromResource(medStatement, "datetime");
    const medRef = medStatement.medicationReference?.reference;
    const dosage = medStatement.dosage;
    if (medRef && datetime && dosage) {
      const key = JSON.stringify({ medRef, datetime, dosage });
      deduplicateWithinMap(
        medStatementsMap,
        key,
        medStatement,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else if (medRef && datetime) {
      const key = JSON.stringify({ medRef, datetime });
      deduplicateWithinMap(
        medStatementsMap,
        key,
        medStatement,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else if (medRef) {
      const key = JSON.stringify({ medRef });
      deduplicateWithinMap(
        medStatementsMap,
        key,
        medStatement,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else {
      danglingReferences.add(createRef(medStatement));
    }
  }

  return {
    medStatementsMap,
    refReplacementMap: refReplacementMap,
    danglingReferences,
  };
}
