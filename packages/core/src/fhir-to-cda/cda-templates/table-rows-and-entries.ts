import { Observation, ObservationComponent } from "@medplum/fhirtypes";
import {
  buildCodeCE,
  buildInstanceIdentifier,
  buildReferenceId,
  formatDateToCDATimeStamp,
  formatDateToHumanReadableFormat,
  isLoinc,
  withoutNullFlavorObject,
} from "./commons";
import { AugmentedObservation, AugmentedResource } from "./components/augmented-resources";
import {
  codeAttribute,
  extensionValue2015,
  idAttribute,
  inlineTextAttribute,
  loincCodeSystem,
  loincSystemName,
  placeholderOrgOid,
  valueAttribute,
} from "./constants";
import {
  CreateEntriesCallback,
  CreateTableRowsCallback,
  ObservationEntry,
  ObservationTableRow,
  TableRowsAndEntriesResult,
} from "./types";

export function createTableRowsAndEntriesFromObservations<T extends AugmentedResource>(
  augObs: T[],
  tableRowsCallback: CreateTableRowsCallback<T>,
  entriesCallback: CreateEntriesCallback<T>
): TableRowsAndEntriesResult {
  const result: TableRowsAndEntriesResult = {
    trs: [],
    entries: [],
  };

  augObs.map((aug, index) => {
    const sectionPrefix = `${aug.sectionName}${index + 1}`;
    const date = formatDateToCDATimeStamp(aug.resource.effectiveDateTime);
    const trs = tableRowsCallback(aug, sectionPrefix, date);
    const entries = entriesCallback(aug, sectionPrefix, date);
    result.trs.push(...trs);
    result.entries.push(...entries);
  });
  return result;
}

export function createTableRowsFromObservation(
  observation: AugmentedObservation,
  socHistPrefix: string,
  date: string | undefined
): ObservationTableRow[] {
  const trs: ObservationTableRow[] = [];
  const formattedDate = formatDateToHumanReadableFormat(date);
  let pairNumber = 0;
  if (observation.resource.component && observation.resource.component.length > 0) {
    const componentTrs = observation.resource.component.flatMap(pair => {
      pairNumber++;
      return createTableRowFromObservation(
        pair,
        buildReferenceId(socHistPrefix, pairNumber),
        formattedDate
      );
    });
    trs.push(...componentTrs);
  }
  if (hasObservationInCode(observation.resource)) {
    pairNumber++;
    trs.push(
      createTableRowFromObservation(
        observation.resource,
        buildReferenceId(socHistPrefix, pairNumber),
        formattedDate
      )
    );
  }
  return trs;
}

export function createTableRowFromObservation(
  observation: Observation | ObservationComponent,
  referenceId: string,
  date: string | undefined
): ObservationTableRow {
  const interpretation = observation.interpretation;
  const score = interpretation?.[0]?.coding?.[0]?.display;
  const intValue = score ? parseInt(score) : undefined;
  const scoreValue = intValue != undefined && !isNaN(intValue) ? intValue.toString() : "N/A";

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
            observation.valueCodeableConcept?.text ??
            "Not on file",
        },
        {
          [inlineTextAttribute]: scoreValue,
        },
        {
          [inlineTextAttribute]: date ?? "Unknown",
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

export function createEntriesFromObservation(
  aug: AugmentedObservation,
  socHistNumber: string,
  date: string | undefined
): ObservationEntry[] {
  let pairNumber = 0;
  const observationEntry = createEntryFromObservation(aug.resource, aug, socHistNumber, date);
  observationEntry.observation.entryRelationship = [];

  if (aug.resource.component && aug.resource.component.length > 0) {
    aug.resource.component.map(pair => {
      pairNumber++;
      const entryRelationshipObservation = createEntryFromObservation(
        pair,
        aug,
        buildReferenceId(socHistNumber, pairNumber),
        date
      );
      if (observationEntry.observation.entryRelationship)
        observationEntry.observation.entryRelationship.push(entryRelationshipObservation);
    });
  }

  return [observationEntry];
}

function createEntryFromObservation(
  observation: Observation | ObservationComponent,
  augObs: AugmentedObservation,
  referenceId: string,
  date?: string
): ObservationEntry {
  const codeSystem = observation.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  const entry = {
    observation: {
      ["@_classCode"]: "OBS",
      ["@_moodCode"]: "EVN",
      templateId: buildInstanceIdentifier({
        root: augObs.typeOid,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: observation.id ?? augObs.resource.id,
      }),

      code: buildCodeCE({
        code: observation.code?.coding?.[0]?.code,
        codeSystem: systemIsLoinc ? loincCodeSystem : codeSystem,
        codeSystemName: systemIsLoinc ? loincSystemName : undefined,
        displayName: observation.code?.coding?.[0]?.display,
      }),
      text: {
        reference: {
          [valueAttribute]: referenceId,
        },
      },
      statusCode: {
        [codeAttribute]: "completed",
      },
      effectiveTime: withoutNullFlavorObject(date, valueAttribute),
      interpretationCode: buildCodeCE({
        code: observation.interpretation?.[0]?.coding?.[0]?.code,
        codeSystem: observation.interpretation?.[0]?.coding?.[0]?.system,
        codeSystemName: observation.interpretation?.[0]?.coding?.[0]?.display,
        displayName: observation.interpretation?.[0]?.coding?.[0]?.display,
      }),
    },
  };
  return entry;
}
