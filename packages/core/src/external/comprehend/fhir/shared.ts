import { RxNormEntity, ICD10CMEntity } from "@aws-sdk/client-comprehendmedical";

export function isConfidentMatch(
  entity: RxNormEntity | ICD10CMEntity,
  confidenceThreshold: number
): boolean {
  return entity.Score != null && entity.Score >= confidenceThreshold;
}
