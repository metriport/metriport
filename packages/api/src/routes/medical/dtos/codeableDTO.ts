import { CodeableConcept, Coding } from "../../../domain/medical/codeable-concept";

export type CodingDTO = {
  system: string | undefined;
  code: string | undefined;
  display: string | undefined;
};

export type CodeableConceptDTO = {
  coding: CodingDTO[] | undefined;
  text: string | undefined;
};

export function toDTO(domain: CodeableConcept | undefined): CodeableConceptDTO | undefined {
  if (!domain) return undefined;
  return {
    coding: domain.coding ? domain.coding.map(codingToDTO) : undefined,
    text: domain.text ?? undefined,
  };
}

export function codingToDTO(domain: Coding): CodingDTO {
  return {
    system: domain.system ?? undefined,
    code: domain.code ?? undefined,
    display: domain.display ?? undefined,
  };
}
