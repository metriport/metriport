import { Bundle, Observation, Resource } from "@medplum/fhirtypes";
import { isObservation } from "../../fhir";
import { buildCodeCe, buildInstanceIdentifier, createTableHeader } from "../commons";
import { _idAttribute, loincCodeSystem, loincSystemName } from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { AugmentedObservation } from "./augmented-resources";
import { createEntriesFromObservation, createTableRowsFromObservation } from "./observations";

const mentalStatusSectionName = "mentalstatus";
const mentalHealthSurveyCodes = ["44249-1"];
const tableHeaders = ["Question / Observation", "Answer / Status", "Score", "Date Recorded"];

export function buildMentalStatus(fhirBundle: Bundle) {
  const mentalStatusObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isMentalSurveyObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (mentalStatusObservations.length === 0) {
    return undefined;
  }

  const augmentedObservations = mentalStatusObservations.map(
    obs => new AugmentedObservation("2.16.840.1.113883.10.20.22.4.74", mentalStatusSectionName, obs)
  );

  const { trs, entries } = createTableRowsAndEntries(
    augmentedObservations,
    createTableRowsFromObservation,
    createEntriesFromObservation
  );
  const table = {
    [_idAttribute]: mentalStatusSectionName,
    thead: createTableHeader(tableHeaders),
    tbody: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tr: trs.map((row: { tr: { [x: string]: any; td: any } }) => ({
        [_idAttribute]: row.tr[_idAttribute],
        td: row.tr.td,
      })),
    },
  };

  const mentalStatusSection = {
    component: {
      section: {
        templateId: buildInstanceIdentifier({
          root: "2.16.840.1.113883.10.20.22.2.56",
        }),
        code: buildCodeCe({
          code: "10190-7",
          codeSystem: loincCodeSystem,
          codeSystemName: loincSystemName,
          displayName: "Mental status Narrative",
        }),
        title: "MENTAL STATUS",
        text: { table },
        entry: entries,
      },
    },
  };
  return mentalStatusSection;
}

function isMentalSurveyObservation(resource: Resource | undefined): resource is Observation {
  if (!isObservation(resource)) {
    return false;
  }

  return resource?.code?.coding?.[0]?.code
    ? mentalHealthSurveyCodes.includes(resource.code.coding[0].code.toLowerCase())
    : false;
}
