import { Bundle, Observation, Resource } from "@medplum/fhirtypes";
import { isObservation } from "../../fhir";
import { buildCodeCE, buildInstanceIdentifier, createTableHeader } from "../commons";
import { idAttribute, loincCodeSystem, loincSystemName } from "../constants";
import {
  createEntriesFromObservation,
  createTableRowsAndEntriesFromObservations,
  createTableRowsFromObservation,
} from "../table-rows-and-entries";
import { AugmentedObservation } from "./augmented-resources";

const sectionName = "socialhistory";
const mentalHealthSurveyCodes = ["lg51306-5"];
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
    obs => new AugmentedObservation("2.16.840.1.113883.10.20.22.4.38", sectionName, obs)
  );

  const { trs, entries } = createTableRowsAndEntriesFromObservations(
    augmentedObservations,
    createTableRowsFromObservation,
    createEntriesFromObservation
  );
  const table = {
    [idAttribute]: sectionName + "1", // TODO: make the number dynamic if we add more tables
    thead: createTableHeader(tableHeaders),
    tbody: {
      tr: trs.map(row => ({
        [idAttribute]: row.tr[idAttribute],
        td: row.tr.td,
      })),
    },
  };

  const socialHistorySection = {
    component: {
      section: {
        templateId: buildInstanceIdentifier({
          root: "2.16.840.1.113883.10.20.22.2.17",
        }),
        code: buildCodeCE({
          code: "29762-2",
          codeSystem: loincCodeSystem,
          codeSystemName: loincSystemName,
          displayName: "Social history Narrative",
        }),
        title: "SOCIAL HISTORY",
        text: { table },
        entry: entries,
      },
    },
  };
  return socialHistorySection;
}

function isSocialHistoryObservation(resource: Resource | undefined): resource is Observation {
  if (!isObservation(resource)) {
    return false;
  }

  return resource?.code?.coding?.[0]?.code
    ? mentalHealthSurveyCodes.includes(resource.code.coding[0].code.toLowerCase())
    : false;
}
