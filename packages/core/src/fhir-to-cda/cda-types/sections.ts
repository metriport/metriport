import { CdaTable } from "../cda-templates/table";
import {
  CdaCodeCe,
  CdaInstanceIdentifier,
  ConcernActEntry,
  EncounterEntry,
  ObservationEntry,
  ObservationOrganizerEntry,
  ProcedureActivityEntry,
  SubstanceAdministationEntry,
  TextParagraph,
  TextUnstructured,
} from "./shared-types";

type CdaSection<T> =
  | {
      _nullFlavor?: string;
      templateId?: CdaInstanceIdentifier | CdaInstanceIdentifier[];
      code: CdaCodeCe;
      title: string;
      text: CdaTable | CdaTable[] | TextParagraph | TextUnstructured | string;
      entry?: T | T[];
    }
  | undefined;

export type ResultsSection = CdaSection<ObservationOrganizerEntry>;
export type MedicationSection = CdaSection<SubstanceAdministationEntry>;
export type ImmunizationsSection = CdaSection<SubstanceAdministationEntry>;
export type MentalStatusSection = CdaSection<ObservationEntry>;
export type SocialHistorySection = CdaSection<ObservationEntry>;
export type ProblemsSection = CdaSection<ConcernActEntry>;
export type AllergiesSection = CdaSection<ConcernActEntry>;
export type EncountersSection = CdaSection<EncounterEntry>;
export type VitalSignsSection = CdaSection<ObservationOrganizerEntry>;
export type FamilyHistorySection = CdaSection<ObservationOrganizerEntry>;
export type NotesSection = CdaSection<ConcernActEntry>;
export type ProceduresSection = CdaSection<ProcedureActivityEntry>;
export type AssessmentAndPlanSection = CdaSection<ObservationOrganizerEntry>;
