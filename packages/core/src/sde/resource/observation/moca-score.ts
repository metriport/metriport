import { Observation, Quantity } from "@medplum/fhirtypes";
import { createResource } from "../shared";
import { getObservationCategory } from "../../../external/fhir/resources/observation";
import { createExtractedFromExtension } from "../extension";
import { MOCA_CODEABLE_CONCEPT, MOCA_SCORE_CODEABLE_CONCEPT } from "./constants";
import { DiagnosticReportParams } from "../diagnostic-report";
import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";

interface MocaScoreObservationParams extends DiagnosticReportParams {
  mocaScore: number;
  mocaVersion?: string;
  originalText?: string;
}

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
  observation.category = [getObservationCategory("survey")];
  observation.code = MOCA_SCORE_CODEABLE_CONCEPT;
  observation.valueQuantity = createMocaScoreQuantity(mocaScore);
  if (mocaVersion) {
    observation.component = [
      {
        code: MOCA_CODEABLE_CONCEPT,
        valueString: mocaVersion,
      },
    ];
  }

  // Copy diagnostic report references
  observation.subject = subject;
  observation.performer = performer;
  observation.effectiveDateTime = effectiveDateTime;
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
    system: UNIT_OF_MEASURE_URL,
    code: mocaScore.toString(),
  };
}
