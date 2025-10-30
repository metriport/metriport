import { DiagnosticReport, Observation, Quantity } from "@medplum/fhirtypes";
import { createDiagnosticReportResource } from "../shared";
import { getObservationCategory } from "../../../external/fhir/resources/observation";
import { MOCA_CODEABLE_CONCEPT, MOCA_SCORE_CODEABLE_CONCEPT } from "./constants";
import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";

interface MocaScoreObservationParams {
  diagnosticReport: DiagnosticReport;
  mocaScore: number;
  mocaVersion?: string;
  originalText?: string;
}

export function createMocaScoreObservation({
  diagnosticReport,
  mocaScore,
  mocaVersion,
  originalText,
}: MocaScoreObservationParams): Observation {
  const observation = createDiagnosticReportResource<Observation>(diagnosticReport, "Observation");
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
  if (originalText) {
    observation.note = [
      {
        text: originalText,
      },
    ];
  }
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
