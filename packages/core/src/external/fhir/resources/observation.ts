import { CodeableConcept } from "@medplum/fhirtypes";
import { OBSERVATION_CATEGORY_URL } from "@metriport/shared/medical";

export type ObservationCategoryCode =
  | "social-history"
  | "vital-signs"
  | "imaging"
  | "laboratory"
  | "procedure"
  | "survey"
  | "exam"
  | "therapy"
  | "activity";
export const observationCategoryDisplay: Record<ObservationCategoryCode, string> = {
  "social-history": "Social History",
  "vital-signs": "Vital Signs",
  imaging: "Imaging",
  laboratory: "Laboratory",
  procedure: "Procedure",
  survey: "Survey",
  exam: "Exam",
  therapy: "Therapy",
  activity: "Activity",
};

export function getObservationCategory(code: ObservationCategoryCode): CodeableConcept {
  return {
    coding: [
      {
        system: OBSERVATION_CATEGORY_URL,
        code,
        display: observationCategoryDisplay[code],
      },
    ],
  };
}
