import {
  Observation,
  Reference,
  Patient,
  Practitioner,
  CodeableConcept,
  Quantity,
  DiagnosticReport,
} from "@medplum/fhirtypes";
import { createResource } from "../shared";
import { getObservationCategory } from "../../../external/fhir/resources/observation";
import { createExtractedFromExtension } from "../extension";

interface MocaScoreObservationParams {
  subject: Reference<Patient>;
  performer: Reference<Practitioner>[];
  extractedFrom: Reference<DiagnosticReport>;
  mocaScore: number;
  mocaVersion?: string;
  originalText?: string;
  effectiveDateTime: string;
}

/**
 * The LOINC code for the Montreal Cognitive Assessment (MoCA).
 */
const MOCA_CODEABLE_CONCEPT: CodeableConcept = {
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
const MOCA_SCORE_CODEABLE_CONCEPT: CodeableConcept = {
  coding: [
    {
      system: "http://loinc.org",
      code: "72172-2",
      display: "Total Score [MoCA]",
    },
  ],
  text: "MoCA Cognitive Assessment",
};

export function createMocaScoreObservation({
  subject,
  performer,
  mocaScore,
  mocaVersion,
  originalText,
  extractedFrom,
  effectiveDateTime,
}: MocaScoreObservationParams): Observation {
  const observation = createResource<Observation>("Observation");
  observation.subject = subject;
  observation.performer = performer;
  observation.category = [getObservationCategory("survey")];
  observation.code = MOCA_SCORE_CODEABLE_CONCEPT;
  observation.effectiveDateTime = effectiveDateTime;
  observation.valueQuantity = createMocaScoreQuantity(mocaScore);
  if (mocaVersion) {
    observation.component = [
      {
        code: MOCA_CODEABLE_CONCEPT,
        valueString: mocaVersion,
      },
    ];
  }
  if (originalText) {
    observation.note = [
      {
        text: originalText,
      },
    ];
  }
  observation.extension = [createExtractedFromExtension(extractedFrom)];
  return observation;
}

function createMocaScoreQuantity(mocaScore: number): Quantity {
  return {
    value: mocaScore,
    unit: "score",
    system: "http://unitsofmeasure.org",
    code: mocaScore.toString(),
  };
}
