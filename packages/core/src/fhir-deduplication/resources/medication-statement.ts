import { MedicationStatement } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  assignMostDescriptiveStatus,
  combineResources,
  createRef,
  deduplicateWithinMap,
  getDateFromResource,
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

function preprocessStatus(existing: MedicationStatement, target: MedicationStatement) {
  return assignMostDescriptiveStatus(statusRanking, existing, target);
}

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

  for (const medStatement of medStatements) {
    const datetime = getDateFromResource(medStatement, "datetime");
    const medRef = medStatement.medicationReference?.reference;
    const dosage = medStatement.dosage;
    if (medRef && datetime && dosage) {
      const key = JSON.stringify({ medRef, datetime, dosage });
      deduplicateWithinMap({
        dedupedResourcesMap: medStatementsMap,
        dedupKey: key,
        candidateResource: medStatement,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else if (medRef && datetime) {
      const key = JSON.stringify({ medRef, datetime });
      deduplicateWithinMap({
        dedupedResourcesMap: medStatementsMap,
        dedupKey: key,
        candidateResource: medStatement,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else if (medRef) {
      const key = JSON.stringify({ medRef });
      deduplicateWithinMap({
        dedupedResourcesMap: medStatementsMap,
        dedupKey: key,
        candidateResource: medStatement,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
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
