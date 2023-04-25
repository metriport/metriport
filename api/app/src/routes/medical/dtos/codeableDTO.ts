import { CodeableConcept, Coding } from "../../../domain/medical/codeable-concept";
import { MetriportApi } from "../../../fern";

export function toDTO(
  domain: CodeableConcept | undefined
): MetriportApi.CodeableConcept | undefined {
  if (!domain) return undefined;
  return {
    coding: domain.coding ? domain.coding.map(codingToDTO) : undefined,
    text: domain.text ?? undefined,
  };
}

export function codingToDTO(domain: Coding): MetriportApi.Coding {
  return {
    system: domain.system ?? undefined,
    code: domain.code ?? undefined,
    display: domain.display ?? undefined,
  };
}
