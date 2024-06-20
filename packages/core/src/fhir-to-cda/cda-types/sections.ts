import { CdaTable } from "../cda-templates/table";
import {
  CdaCodeCe,
  CdaInstanceIdentifier,
  ConcernActEntry,
  EncounterEntry,
  ObservationEntry,
  SubstanceAdministationEntry,
  VitalObservationOrganizer,
} from "./shared-types";

type CdaSection<T> =
  | {
      templateId: CdaInstanceIdentifier;
      code: CdaCodeCe;
      title: string;
      text: CdaTable;
      entry: T[];
    }
  | undefined;

export type MedicationSection = CdaSection<SubstanceAdministationEntry>;
export type MentalStatusSection = CdaSection<ObservationEntry>;
export type ProblemsSection = CdaSection<ConcernActEntry>;
export type AllergiesSection = CdaSection<ConcernActEntry>;
export type EncountersSection = CdaSection<EncounterEntry>;
export type VitalSignsSection = CdaSection<VitalObservationOrganizer>;
