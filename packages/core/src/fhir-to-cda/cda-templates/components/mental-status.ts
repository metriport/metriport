import { Bundle, Observation } from "@medplum/fhirtypes";
import { isMentalSurveyObservation } from "../../fhir";
import { buildCodeCe, buildInstanceIdentifier, initiateSectionTable } from "../commons";
import { loincCodeSystem, loincSystemName, oids } from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { AugmentedObservation } from "./augmented-resources";
import { createEntriesFromObservation, createTableRowsFromObservation } from "./observations";
import { MentalStatusSection } from "../../cda-types/sections";

const mentalStatusSectionName = "mentalstatus";
const tableHeaders = ["Question / Observation", "Answer / Status", "Score", "Date Recorded"];

export function buildMentalStatus(fhirBundle: Bundle): MentalStatusSection {
  const mentalStatusObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isMentalSurveyObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (mentalStatusObservations.length === 0) {
    return undefined;
  }

  const augmentedObservations = mentalStatusObservations.map(
    obs => new AugmentedObservation(mentalStatusSectionName, obs, oids.mentalStatusObs)
  );

  const { trs, entries } = createTableRowsAndEntries(
    augmentedObservations,
    createTableRowsFromObservation,
    createEntriesFromObservation
  );

  const table = initiateSectionTable(mentalStatusSectionName, tableHeaders, trs);

  const mentalStatusSection = {
    section: {
      templateId: buildInstanceIdentifier({
        root: oids.mentalStatusSection,
      }),
      code: buildCodeCe({
        code: "10190-7",
        codeSystem: loincCodeSystem,
        codeSystemName: loincSystemName,
        displayName: "Mental status Narrative",
      }),
      title: "MENTAL STATUS",
      text: table,
      entry: entries,
    },
  };
  return mentalStatusSection;
}
