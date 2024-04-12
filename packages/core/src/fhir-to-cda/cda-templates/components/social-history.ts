import { Bundle, Observation, ObservationComponent, Resource } from "@medplum/fhirtypes";
import { isObservation } from "../../fhir";
import {
  buildCodeCE,
  buildInstanceIdentifier,
  buildReferenceId,
  formatDateToCDATimeStamp,
  formatDateToHumanReadableFormat,
  isLoinc,
  withoutNullFlavorObject,
} from "../commons";
import {
  codeAttribute,
  codeSystemAttribute,
  codeSystemNameAttribute,
  displayNameAttribute,
  extensionAttribute,
  extensionValue2015,
  idAttribute,
  inlineTextAttribute,
  loincCodeSystem,
  loincSystemName,
  placeholderOrgOid,
  rootAttribute,
  valueAttribute,
} from "../constants";

const socialHistoryTablePrefix = "socialhistory";

type TableBodyAndEntriesResult = {
  trs: ObservationTableRow[];
  entries: ObservationEntry[];
};

type ObservationTableRow = {
  tr: {
    ["@_ID"]: string;
    td: {
      ["#text"]?: string | undefined;
    }[];
  };
};

type ObservationEntry = {
  observation: {
    ["@_classCode"]: string;
    ["@_moodCode"]: string;
    templateId?: {
      [rootAttribute]?: string;
      [extensionAttribute]?: string;
    };
    id?: {
      [rootAttribute]?: string;
      [extensionAttribute]?: string;
    };
    code?: {
      [codeAttribute]?: string | undefined;
      [codeSystemAttribute]?: string | undefined;
      [codeSystemNameAttribute]?: string | undefined;
      [displayNameAttribute]?: string | undefined;
    };
    text: {
      reference: {
        [valueAttribute]: string;
      };
    };
    statusCode: {
      [codeAttribute]: string;
    };
    effectiveTime?: {
      [valueAttribute]?: string | undefined;
    };
  };
};

export function buildSocialHistory(fhirBundle: Bundle) {
  const socialHistoryObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isSocialHistoryObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (socialHistoryObservations.length === 0) {
    return undefined;
  }

  const { trs, entries } = createTBodyAndEntriesFromObservations(socialHistoryObservations);
  const table = {
    [idAttribute]: socialHistoryTablePrefix,
    thead: {
      tr: [
        {
          th: "Question / Observation",
        },
        {
          th: "Answer / Status",
        },
        {
          th: "Date Recorded",
        },
      ],
    },
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
        title: "Social History",
        text: { table },
        entry: entries,
      },
    },
  };
  return socialHistorySection;
}

function isSocialHistoryObservation(resource: Resource | undefined): resource is Observation {
  return isObservation(resource) && resource?.category?.[0]?.coding?.[0]?.code === "social-history";
}

function createTBodyAndEntriesFromObservations(
  observations: Observation[]
): TableBodyAndEntriesResult {
  const result: TableBodyAndEntriesResult = {
    trs: [],
    entries: [],
  };

  observations.map((observation, observationNumber) => {
    const socHistPrefix = `${socialHistoryTablePrefix}${observationNumber + 1}`;
    const date = formatDateToCDATimeStamp(observation.effectiveDateTime);
    result.trs.push(...createTableRowsFromObservation(observation, socHistPrefix, date));
    result.entries.push(...createEntriesFromObservation(observation, socHistPrefix, date));
  });
  return result;
}

function createTableRowsFromObservation(
  observation: Observation,
  socHistPrefix: string,
  date: string | undefined
): ObservationTableRow[] {
  const trs: ObservationTableRow[] = [];
  const formattedDate = formatDateToHumanReadableFormat(date);
  let pairNumber = 0;
  if (observation.component && observation.component.length > 0) {
    const componentTrs = observation.component.flatMap(pair => {
      pairNumber++;
      return createTableRowFromObservation(
        pair,
        buildReferenceId(socHistPrefix, pairNumber),
        formattedDate
      );
    });
    trs.push(...componentTrs);
  }
  if (hasObservationInCode(observation)) {
    pairNumber++;
    trs.push(
      createTableRowFromObservation(
        observation,
        buildReferenceId(socHistPrefix, pairNumber),
        formattedDate
      )
    );
  }
  return trs;
}

function createTableRowFromObservation(
  observation: Observation | ObservationComponent,
  referenceId: string,
  date: string | undefined
): ObservationTableRow {
  return {
    tr: {
      [idAttribute]: referenceId,
      ["td"]: [
        {
          [inlineTextAttribute]: observation.code?.coding?.[0]?.display ?? observation.code?.text,
        },
        {
          [inlineTextAttribute]:
            observation.valueCodeableConcept?.coding?.[0]?.display ??
            observation.valueCodeableConcept?.text,
        },
        {
          [inlineTextAttribute]: date ?? "",
        },
      ],
    },
  };
}

function hasObservationInCode(observation: Observation): boolean {
  return (
    (observation.code?.coding &&
      observation.code.coding.length > 0 &&
      observation.valueCodeableConcept?.coding &&
      observation.valueCodeableConcept.coding.length > 0) ??
    false
  );
}

function createEntriesFromObservation(
  observation: Observation,
  socHistNumber: string,
  date: string | undefined
): ObservationEntry[] {
  const entries: ObservationEntry[] = [];
  let pairNumber = 0;
  if (observation.component && observation.component.length > 0) {
    observation.component.map(pair => {
      pairNumber++;
      entries.push(
        createEntryFromObservation(pair, socHistNumber, pairNumber, date, observation.id)
      );
    });
  }
  if (hasObservationInCode(observation)) {
    pairNumber++;
    entries.push(
      createEntryFromObservation(observation, socHistNumber, pairNumber, date, observation.id)
    );
  }

  return entries;
}

function createEntryFromObservation(
  observation: Observation | ObservationComponent,
  socHistNumber: string,
  pairNumber: number,
  date: string | undefined,
  observationId?: string
): ObservationEntry {
  const codeSystem = observation.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  const entry = {
    observation: {
      ["@_classCode"]: "OBS",
      ["@_moodCode"]: "EVN",
      templateId: buildInstanceIdentifier({
        root: "2.16.840.1.113883.10.20.22.4.38",
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: observation.id ?? observationId,
      }),

      code: buildCodeCE({
        code: observation.code?.coding?.[0]?.code,
        codeSystem: systemIsLoinc ? loincCodeSystem : codeSystem,
        codeSystemName: systemIsLoinc ? loincSystemName : undefined,
        displayName: observation.code?.coding?.[0]?.display,
      }),
      text: {
        reference: {
          [valueAttribute]: buildReferenceId(socHistNumber, pairNumber),
        },
      },
      statusCode: {
        [codeAttribute]: "completed",
      },
      effectiveTime: withoutNullFlavorObject(date, valueAttribute),
    },
  };
  return entry;
}
