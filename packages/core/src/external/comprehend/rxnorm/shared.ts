import type {
  RxNormAttributeType,
  RxNormAttribute,
  RxNormEntity,
  RxNormConcept,
} from "@aws-sdk/client-comprehendmedical";
import { RxNormEntityCategory } from "@aws-sdk/client-comprehendmedical";

export function getAttribute(
  entity: RxNormEntity,
  type: RxNormAttributeType
): RxNormAttribute | undefined {
  return entity.Attributes?.find(attribute => attribute.Type === type);
}

export function getAllAttributes(
  entity: RxNormEntity,
  type: RxNormAttributeType
): RxNormAttribute[] {
  return entity.Attributes?.filter(attribute => attribute.Type === type) ?? [];
}

export function getRxNormCode(
  entity: RxNormEntity
): { code: string; display?: string } | undefined {
  const rxNormConcept = getBestRxNormConcept(entity);
  if (!rxNormConcept || !rxNormConcept.Code) return undefined;
  const code = rxNormConcept.Code;
  const display = rxNormConcept.Description;
  return { code, ...(display ? { display } : undefined) };
}

function getBestRxNormConcept(entity: RxNormEntity): RxNormConcept | undefined {
  const rxNormConcepts = entity.RxNormConcepts ?? [];
  let bestScore = -1;
  let bestConcept: RxNormConcept | undefined;
  for (const concept of rxNormConcepts) {
    const score = typeof concept.Score === "number" ? concept.Score : -1;
    if (score > bestScore) {
      bestScore = score;
      bestConcept = concept;
    }
  }
  return bestConcept;
}

export function isMedicationEntity(entity: RxNormEntity): boolean {
  return entity.Category === RxNormEntityCategory.MEDICATION;
}

export function isConfidentMatch(entity: RxNormEntity, confidenceThreshold: number): boolean {
  return entity.Score != null && entity.Score >= confidenceThreshold;
}
