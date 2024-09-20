import { Bundle, Observation } from "@medplum/fhirtypes";
import { MentalStatusSection } from "../../cda-types/sections";
import { ObservationEntry } from "../../cda-types/shared-types";
import { isMentalSurveyObservation } from "../../fhir";
import { buildCodeCe, buildInstanceIdentifier, notOnFilePlaceholder } from "../commons";
import { loincCodeSystem, loincSystemName, oids } from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { CdaTable, initiateSectionTable } from "../table";
import { AugmentedObservation } from "./augmented-resources";
import { createEntriesFromObservation, createTableRowsFromObservation } from "./observations";

const mentalStatusSectionName = "mentalstatus";
const tableHeaders = ["Question / Observation", "Answer / Status", "Score", "Date Recorded"];

export function buildMentalStatus(fhirBundle: Bundle): MentalStatusSection {
  const mentalStatusSection: MentalStatusSection = {
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
    text: notOnFilePlaceholder,
  };

  const mentalStatusObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isMentalSurveyObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (mentalStatusObservations.length === 0) {
    return mentalStatusSection;
  }

  const augmentedObservations = mentalStatusObservations.map(
    obs => new AugmentedObservation(mentalStatusSectionName, obs, oids.mentalStatusObs)
  );

  const tables: CdaTable[] = [];
  const entries: ObservationEntry[] = [];

  augmentedObservations.forEach((augObs, index) => {
    const { trs, entries: entry } = createTableRowsAndEntries(
      [augObs],
      createTableRowsFromObservation,
      createEntriesFromObservation,
      index
    );

    const table = initiateSectionTable(
      `${mentalStatusSectionName}${index + 1}`,
      tableHeaders,
      trs,
      augObs.resource.code?.text
    );
    tables.push(table);
    entries.push(...entry);
  });

  mentalStatusSection.text = tables;
  mentalStatusSection.entry = entries;

  return mentalStatusSection;
}
