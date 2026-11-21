import { Observation, ObservationComponent, Quantity } from "@medplum/fhirtypes";
import {
  ActStatusCode,
  CdaCodeCe,
  CdaValueIvlPq,
  CdaValuePq,
  ObservationEntry,
  ObservationEntryRelationship,
  ObservationTableRow,
} from "../../cda-types/shared-types";
import {
  TIMESTAMP_CLEANUP_REGEX,
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildReferenceId,
  buildTemplateIds,
  buildValueEd,
  buildValueSt,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  isLoinc,
  withNullFlavor,
  withoutNullFlavorObject,
} from "../commons";
import {
  _xmlnsXsiAttribute,
  _xmlnsXsiValue,
  _xsiTypeAttribute,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  oids,
  placeholderOrgOid,
} from "../constants";
import { AugmentedObservation } from "./augmented-resources";

export function createObservations(
  observations: Observation[],
  referenceId: string
): { component: ObservationEntry }[] {
  return observations.map(observation => {
    const effectiveTime = observation.effectiveDateTime?.replace(TIMESTAMP_CLEANUP_REGEX, "");
    const valueQuantity = buildResultValueQuantity(observation.valueQuantity);
    const valueSt = buildValueSt(
      observation.valueString ? spellOutLessThan(observation.valueString) : undefined
    );
    const valueEd = buildValueEd(referenceId);

    return {
      component: {
        observation: {
          _classCode: "OBS",
          _moodCode: "EVN",
          templateId: buildTemplateIds({
            root: oids.resultObs,
            extension: extensionValue2015,
          }),
          id: {
            _root: placeholderOrgOid,
            _extension: observation.id ?? observation.identifier?.[0]?.value ?? "",
          },
          code: buildCodeCvFromCodeableConcept(observation.code),
          text: {
            reference: {
              _value: `#${referenceId}`,
            },
          },
          statusCode: withoutNullFlavorObject(fhirStatusToActStatus(observation.status), "_code"),
          effectiveTime: {
            low: withoutNullFlavorObject(effectiveTime, "_value"),
            high: withoutNullFlavorObject(effectiveTime, "_value"),
          },
          value: valueQuantity ?? valueSt ?? valueEd,
          interpretationCode: buildInterpretationCodes(observation),
        },
      },
    };
  });
}

const ucumSystem = "http://unitsofmeasure.org";

/**
 * PQ for a numeric result, IVL_PQ when it has a comparator (e.g. "<0.1").
 * CDA units must be UCUM, so a quantity with a non-UCUM unit is left to the text fallback.
 */
export function buildResultValueQuantity(
  quantity: Quantity | undefined
): CdaValuePq | CdaValueIvlPq | undefined {
  if (quantity?.value == undefined) return undefined;
  const isUcum = quantity.system === ucumSystem;
  if (!isUcum && (quantity.unit || quantity.code)) return undefined;
  const unit = isUcum ? quantity.code ?? quantity.unit : undefined;
  const bound = { _value: quantity.value, ...(unit ? { _unit: unit } : {}) };
  const xsi = { [_xmlnsXsiAttribute]: _xmlnsXsiValue };

  switch (quantity.comparator) {
    case "<":
    case "<=":
      return {
        [_xsiTypeAttribute]: "IVL_PQ",
        ...xsi,
        high: { ...bound, _inclusive: quantity.comparator === "<=" ? "true" : "false" },
      };
    case ">":
    case ">=":
      return {
        [_xsiTypeAttribute]: "IVL_PQ",
        ...xsi,
        low: { ...bound, _inclusive: quantity.comparator === ">=" ? "true" : "false" },
      };
    default:
      return { [_xsiTypeAttribute]: "PQ", ...xsi, ...bound };
  }
}

/**
 * Narrative value, e.g. "less than 0.1 mg/dL". A "<" is spelled out because postProcessXml
 * turns "&lt;" back into "<", which would leave the document invalid.
 */
export function formatObservationValue(observation: Observation): string | undefined {
  const quantity = observation.valueQuantity;
  if (quantity?.value != undefined) {
    const unit = quantity.unit ?? quantity.code;
    return spellOutLessThan(
      `${quantity.comparator ?? ""}${quantity.value}${unit ? ` ${unit}` : ""}`
    );
  }
  if (observation.valueString?.trim()) return spellOutLessThan(observation.valueString.trim());
  const text =
    observation.valueCodeableConcept?.coding?.[0]?.display ??
    observation.valueCodeableConcept?.text;
  return text ? spellOutLessThan(text) : undefined;
}

function spellOutLessThan(text: string): string {
  return text.replace(/<=\s*/g, "≤ ").replace(/<\s*/g, "less than ");
}

function buildInterpretationCodes(observation: Observation): CdaCodeCe[] | undefined {
  const codes = observation.interpretation?.flatMap(
    interpretation =>
      interpretation.coding?.map(coding =>
        buildCodeCe({ code: coding.code, codeSystem: coding.system, displayName: coding.display })
      ) ?? []
  );
  return codes?.length ? codes : undefined;
}

export function createTableRowsFromObservation(
  observation: AugmentedObservation,
  socHistPrefix: string
): ObservationTableRow[] {
  const date = formatDateToCdaTimestamp(observation.resource.effectiveDateTime);
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
      _ID: referenceId,
      ["td"]: [
        {
          "#text": observation.code?.coding?.[0]?.display ?? observation.code?.text,
        },
        {
          "#text":
            observation.valueCodeableConcept?.coding?.[0]?.display ??
            observation.valueCodeableConcept?.text ??
            "Not on file",
        },
        {
          "#text": scoreValue,
        },
        {
          "#text": date ?? "Unknown",
        },
      ],
    },
  };
}

export function hasObservationInCode(observation: Observation): boolean {
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
): ObservationEntry {
  let pairNumber = 0;
  const date = formatDateToCdaTimestamp(observation.resource.effectiveDateTime);
  const observationEntry = createEntryFromObservation(
    observation.resource,
    observation,
    socHistNumber,
    date
  );

  if (observation.resource.component && observation.resource.component.length > 0) {
    observationEntry.observation.entryRelationship = [];
    observation.resource.component.map(pair => {
      pairNumber++;
      const entryRelationshipObservation = createEntryFromObservation(
        pair,
        observation,
        buildReferenceId(socHistNumber, pairNumber),
        date
      );
      const entryRelationship = createEntryRelationship(entryRelationshipObservation);
      if (
        observationEntry.observation.entryRelationship &&
        Array.isArray(observationEntry.observation.entryRelationship)
      ) {
        observationEntry.observation.entryRelationship.push(entryRelationship);
      }
    });
  }

  return observationEntry;
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
      _classCode: "OBS",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: augObs.typeOid,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: observation.id ?? augObs.resource.id,
      }),
      code: buildCodeCe({
        code: observation.code?.coding?.[0]?.code,
        codeSystem: systemIsLoinc ? loincCodeSystem : codeSystem,
        codeSystemName: systemIsLoinc ? loincSystemName : undefined,
        displayName: observation.code?.coding?.[0]?.display,
      }), // TODO: If not LOINC, include a translation with a LOINC code
      text: {
        reference: {
          _value: `#${referenceId}`,
        },
      },
      statusCode: {
        _code: "completed",
      },
      effectiveTime: withNullFlavor(date, "_value"),
      value: buildValue(observation),
      interpretationCode: observation.interpretation?.flatMap(interpretation => {
        return (
          interpretation.coding?.map(coding => {
            return buildCodeCe({
              code: coding.code,
              codeSystem: coding.system,
              displayName: coding.display,
            });
          }) || []
        );
      }),
    },
  };
  return entry;
}

function buildValue(observation: Observation | ObservationComponent): CdaValuePq | undefined {
  if (observation.valueQuantity?.value == undefined) return undefined;

  return {
    [_xsiTypeAttribute]: "PQ",
    _unit: observation.valueQuantity?.unit,
    _value: observation.valueQuantity?.value,
  };
}

function createEntryRelationship(entry: ObservationEntry): ObservationEntryRelationship {
  return {
    _typeCode: "COMP",
    observation: {
      ...entry.observation,
    },
  };
}

export function fhirStatusToActStatus(actStatus: string | undefined): ActStatusCode {
  switch (actStatus) {
    case "registered" || "received" || "preliminary":
      return "active";
    case "final" || "completed" || "amended" || "corrected" || "appended":
      return "completed";
    case "cancelled" || "abandoned":
      return "cancelled";
    case "entered-in-error" || "error":
      return "nullified";
    default:
      return "completed";
  }
}
