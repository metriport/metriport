import { SNOMED_URL } from "@metriport/shared/medical";

export const QUEST_DIAGNOSTIC_REPORT_TYPE = "http://questdiagnostics.com/diagnostic-report";
export const QUEST_LOCAL_RESULT_CODE_SYSTEM = "http://questdiagnostics.com/local-result-code";
export const QUEST_LOCAL_IDENTIFIER_SYSTEM = "http://questdiagnostics.com/local-identifier";
export const QUEST_CPT_CODE_SYSTEM = "http://questdiagnostics.com/cpt-code";
export const HL7_OBSERVATION_INTERPRETATION_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

export const TEST_NOT_PERFORMED_PREFIX = "TEST NOT PERFORMED";
export const NOTES_AND_COMMENTS_ORDER = "NOTES AND COMMENTS";
export const HISTORICAL_RESULTS_ORDER = "HISTORICAL RESULTS";

export const SNOMED_LABORATORY_PROCEDURE_CODE = {
  system: SNOMED_URL,
  code: "108252007",
  display: "Laboratory procedure",
};
