import { CdaTable } from "../cda-templates/table";
import {
  CdaCodeCe,
  CdaInstanceIdentifier,
  ConcernActEntry,
  EncounterEntry,
  ObservationEntry,
  ObservationOrganizer,
  SubstanceAdministationEntry,
  TextParagraph,
  TextUnstructured,
} from "./shared-types";

type CdaSection<T> =
  | {
      _nullFlavor?: string;
      templateId: CdaInstanceIdentifier | CdaInstanceIdentifier[];
      code: CdaCodeCe;
      title: string;
      text: CdaTable | TextParagraph | TextUnstructured;
      entry?: T[];
    }
  | undefined;

export type ResultsSection = CdaSection<ObservationOrganizer>;
export type MedicationSection = CdaSection<SubstanceAdministationEntry>;
export type ImmunizationsSection = CdaSection<SubstanceAdministationEntry>;
export type MentalStatusSection = CdaSection<ObservationEntry>;
export type SocialHistorySection = CdaSection<ObservationEntry>;
export type ProblemsSection = CdaSection<ConcernActEntry>;
export type AllergiesSection = CdaSection<ConcernActEntry>;
export type EncountersSection = CdaSection<EncounterEntry>;
export type VitalSignsSection = CdaSection<ObservationOrganizer>;
export type FamilyHistorySection = CdaSection<ObservationOrganizer>;
export type AssessmentAndPlanSection = CdaSection<ObservationOrganizer>;
