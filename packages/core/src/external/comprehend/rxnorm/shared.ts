import type {
  RxNormAttributeType,
  RxNormAttribute,
  RxNormEntity,
} from "@aws-sdk/client-comprehendmedical";
import { RxNormEntityCategory } from "@aws-sdk/client-comprehendmedical";

export function getAttribute(
  entity: RxNormEntity,
  type: RxNormAttributeType
): RxNormAttribute | undefined {
  return entity.Attributes?.find(attribute => attribute.Type === type);
}

export function getRxNormCode(
  entity: RxNormEntity
): { code: string; display?: string } | undefined {
  const rxNormConcept = entity.RxNormConcepts?.[0];
  if (!rxNormConcept || !rxNormConcept.Code) return undefined;
  const code = rxNormConcept.Code;
  const display = rxNormConcept.Description;
  return { code, ...(display ? { display } : undefined) };
}

// readonly DOSAGE: "DOSAGE";
//     readonly DURATION: "DURATION";
//     readonly FORM: "FORM";
//     readonly FREQUENCY: "FREQUENCY";
//     readonly RATE: "RATE";
//     readonly ROUTE_OR_MODE: "ROUTE_OR_MODE";
//     readonly STRENGTH: "STRENGTH";

export function isMedicationEntity(entity: RxNormEntity): boolean {
  return entity.Category === RxNormEntityCategory.MEDICATION;
}

export function isConfidentMatch(entity: RxNormEntity, confidenceThreshold: number): boolean {
  return entity.Score != null && entity.Score >= confidenceThreshold;
}
