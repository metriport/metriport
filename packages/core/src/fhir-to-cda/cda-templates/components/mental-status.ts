import { Bundle, Observation, Resource } from "@medplum/fhirtypes";
import { isObservation } from "../../fhir";
import {
  buildCodeCE,
  buildInstanceIdentifier,
  createTableRowsAndEntriesFromObservations,
  createTableHeader,
} from "../commons";
import { idAttribute, loincCodeSystem, loincSystemName } from "../constants";
import { AugmentedObservation } from "./augmented-observation";

const sectionName = "mentalstatus";
const mentalHealthSurveyCodes = ["44249-1"];

export function buildMentalStatus(fhirBundle: Bundle) {
  const mentalStatusObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isMentalSurveyObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (mentalStatusObservations.length === 0) {
    return undefined;
  }

  const augmentedObservations = mentalStatusObservations.map(
    obs => new AugmentedObservation("2.16.840.1.113883.10.20.22.4.74", sectionName, obs)
  );

  const { trs, entries } = createTableRowsAndEntriesFromObservations(augmentedObservations);
  const table = {
    [idAttribute]: sectionName,
    thead: createTableHeader(),
    tbody: {
      tr: trs.map(row => ({
        [idAttribute]: row.tr[idAttribute],
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
        code: buildCodeCE({
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
