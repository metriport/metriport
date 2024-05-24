import { Bundle, Observation } from "@medplum/fhirtypes";
import { isSocialHistoryObservation } from "../../fhir";
import { buildCodeCe, buildInstanceIdentifier, createTableHeader } from "../commons";
import { _idAttribute, loincCodeSystem, loincSystemName, oids } from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { AugmentedObservation } from "./augmented-resources";
import { createEntriesFromObservation, createTableRowsFromObservation } from "./observations";

const sectionName = "socialhistory";
const tableHeaders = ["Question / Observation", "Answer / Status", "Score", "Date Recorded"];

export function buildSocialHistory(fhirBundle: Bundle) {
  const socialHistoryObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isSocialHistoryObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (socialHistoryObservations.length === 0) {
    return undefined;
  }

  const augmentedObservations = socialHistoryObservations.map(
    obs => new AugmentedObservation(sectionName, obs, oids.socialHistoryObs)
  );

  const { trs, entries } = createTableRowsAndEntries(
    augmentedObservations,
    createTableRowsFromObservation,
    createEntriesFromObservation
  );
  const table = {
    [_idAttribute]: sectionName + "1", // TODO: Potentially need to create separate text tables for different questionnaires
    thead: createTableHeader(tableHeaders),
    tbody: {
      tr: trs.map(row => ({
        [_idAttribute]: row.tr[_idAttribute],
        td: row.tr.td,
      })),
    },
  };

  const socialHistorySection = {
    section: {
      templateId: buildInstanceIdentifier({
        root: oids.socialHistorySection,
      }),
      code: buildCodeCe({
        code: "29762-2",
        codeSystem: loincCodeSystem,
        codeSystemName: loincSystemName,
        displayName: "Social history Narrative",
      }),
      title: "SOCIAL HISTORY",
      text: { table },
      entry: entries,
    },
  };
  return socialHistorySection;
}
