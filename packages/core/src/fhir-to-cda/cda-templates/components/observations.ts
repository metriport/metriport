import { Observation, ObservationComponent } from "@medplum/fhirtypes";
import {
  CDACodeCV,
  CDAInstanceIdentifier,
  CDAValueST,
  Entry,
  EntryObject,
  ObservationEntry,
  ObservationTableRow,
} from "../../cda-types/shared-types";
import {
  TIMESTAMP_CLEANUP_REGEX,
  buildCodeCE,
  buildCodeCVFromCodeableConcept,
  buildInstanceIdentifier,
  buildReferenceId,
  buildValueST,
  formatDateToCDATimestamp,
  formatDateToHumanReadableFormat,
  isLoinc,
  withoutNullFlavorObject,
} from "../commons";
import {
  classCodeAttribute,
  codeAttribute,
  extensionAttribute,
  extensionValue2015,
  idAttribute,
  inlineTextAttribute,
  loincCodeSystem,
  loincSystemName,
  moodCodeAttribute,
  placeholderOrgOid,
  rootAttribute,
  valueAttribute,
} from "../constants";
import { AugmentedObservation } from "./augmented-resources";

export interface CDAObservation {
  component: {
    observation: {
      [classCodeAttribute]: Entry;
      [moodCodeAttribute]: Entry;
      id?: CDAInstanceIdentifier[] | Entry;
      code: CDACodeCV | Entry;
      text?: Entry;
      statusCode?: EntryObject;
      effectiveTime?: {
        low?: EntryObject;
        high?: EntryObject;
      };
      priorityCode?: Entry;
      // TODO support other types of values like CodeableConcept, Quantity, etc.
      value?: CDAValueST | undefined;
    };
  };
}

export function buildObservations(observations: Observation[]): CDAObservation[] {
  return observations.map(observation => {
    const effectiveTime = observation.effectiveDateTime?.replace(TIMESTAMP_CLEANUP_REGEX, "");
    return {
      component: {
        observation: {
          [classCodeAttribute]: "OBS",
          [moodCodeAttribute]: "EVN",
          templateId: buildInstanceIdentifier({
            root: "2.16.840.1.113883.10.20.22.4.2",
            extension: extensionValue2015,
          }),
          id: {
            [rootAttribute]: placeholderOrgOid,
            [extensionAttribute]: observation.id ?? observation.identifier?.[0]?.value ?? "",
          },
          code: buildCodeCVFromCodeableConcept(observation.code),
          statusCode: withoutNullFlavorObject(observation.status, codeAttribute),
          effectiveTime: {
            low: withoutNullFlavorObject(effectiveTime, valueAttribute),
            high: withoutNullFlavorObject(effectiveTime, valueAttribute),
          },
          value: buildValueST(observation.valueString),
        },
      },
    };
  });
}

export function createTableRowsFromObservation(
  observation: AugmentedObservation,
  socHistPrefix: string
): ObservationTableRow[] {
  const date = formatDateToCDATimestamp(observation.resource.effectiveDateTime);
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
  observation: AugmentedObservation,
  socHistNumber: string
): ObservationEntry[] {
  let pairNumber = 0;
  const date = formatDateToCDATimestamp(observation.resource.effectiveDateTime);
  const observationEntry = createEntryFromObservation(
    observation.resource,
    observation,
    socHistNumber,
    date
  );
  observationEntry.observation.entryRelationship = [];

  if (observation.resource.component && observation.resource.component.length > 0) {
    observation.resource.component.map(pair => {
      pairNumber++;
      const entryRelationshipObservation = createEntryFromObservation(
        pair,
        observation,
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
