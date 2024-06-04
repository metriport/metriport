import { CdaTable } from "../cda-templates/table";
import {
  CdaCodeCe,
  CdaInstanceIdentifier,
  ObservationEntry,
  ProblemsConcernActEntry,
  SubstanceAdministationEntry,
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
export type ProblemsSection = CdaSection<ProblemsConcernActEntry>;
