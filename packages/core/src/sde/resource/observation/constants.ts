import { CodeableConcept } from "@medplum/fhirtypes";

/**
 * The LOINC code for the Montreal Cognitive Assessment (MoCA).
 */
export const MOCA_CODEABLE_CONCEPT: CodeableConcept = {
  coding: [
    {
      system: "http://loinc.org",
      code: "72172-0",
      display: "Montreal Cognitive Assessment [MoCA]",
    },
  ],
};

/**
 * The LOINC code for the total score from performing the Montreal Cognitive Assessment (MoCA).
 */
export const MOCA_SCORE_CODEABLE_CONCEPT: CodeableConcept = {
  coding: [
    {
      system: "http://loinc.org",
      code: "72172-2",
      display: "Total Score [MoCA]",
    },
  ],
  text: "MoCA Cognitive Assessment",
};
