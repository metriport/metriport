import { Bundle, Observation } from "@medplum/fhirtypes";
import { SocialHistorySection } from "../../cda-types/sections";
import { isSocialHistoryObservation } from "../../fhir";
import { buildCodeCe, buildInstanceIdentifier, notOnFilePlaceholder } from "../commons";
import { loincCodeSystem, loincSystemName, oids } from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { createTableHeader } from "../table";
import { AugmentedObservation } from "./augmented-resources";
import { createEntriesFromObservation, createTableRowsFromObservation } from "./observations";

const sectionName = "socialhistory";
const tableHeaders = ["Question / Observation", "Answer / Status", "Score", "Date Recorded"];

export function buildSocialHistory(fhirBundle: Bundle): SocialHistorySection {
  const socialHistorySection: SocialHistorySection = {
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
    text: notOnFilePlaceholder,
  };

  const socialHistoryObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isSocialHistoryObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (socialHistoryObservations.length === 0) {
    return socialHistorySection;
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
    _ID: sectionName + "1", // TODO: Potentially need to create separate text tables for different questionnaires
    thead: createTableHeader(tableHeaders),
    tbody: {
      tr: trs.map(row => ({
        _ID: row.tr._ID,
        td: row.tr.td,
      })),
    },
  };

  socialHistorySection.text = { table };
  socialHistorySection.entry = entries;

  return socialHistorySection;
}
