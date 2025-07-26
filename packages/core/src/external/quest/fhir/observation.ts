import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  Coding,
  Identifier,
  Observation,
  Patient,
  ObservationReferenceRange,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { LOINC_URL, CPT_URL } from "../../../util/constants";
import { getPatientReference } from "./patient";

type ObservationValue = Pick<Observation, "valueQuantity" | "valueString" | "valueCodeableConcept">;

export function getObservation(
  detail: ResponseDetail,
  { patient }: { patient: Patient }
): Observation {
  const identifier = getObservationIdentifier(detail);
  const code = getObservationCode(detail);
  const interpretation = getObservationInterpretation(detail);
  const referenceRange = getObservationReferenceRange(detail);
  const { valueQuantity, valueString } = getObservationValue(detail);

  return {
    resourceType: "Observation",
    id: uuidv7(),
    status: "final",
    subject: getPatientReference(patient),
    ...(valueQuantity ? { valueQuantity } : {}),
    ...(valueString ? { valueString } : {}),
    ...(referenceRange ? { referenceRange } : {}),
    ...(interpretation ? { interpretation } : {}),
    ...(identifier ? { identifier } : {}),
    ...(code ? { code } : {}),
  };
}

function getObservationIdentifier(detail: ResponseDetail): Identifier[] {
  return [
    {
      system: "http://questdiagnostics.com/local-result-code",
      value: detail.localResultCode,
    },
  ];
}

function getObservationCode(detail: ResponseDetail): CodeableConcept {
  const text = detail.resultName;
  const coding: Coding[] = [];
  if (detail.loincCode) {
    coding.push({
      system: LOINC_URL,
      code: detail.loincCode,
    });
  }
  if (detail.localResultCode) {
    coding.push({
      system: "http://questdiagnostics.com/local-result-code",
      code: detail.localResultCode,
      ...(text ? { display: text } : {}),
    });
  }
  if (detail.cptCode) {
    coding.push({
      system: CPT_URL,
      code: detail.cptCode,
    });
  }

  return {
    ...(text ? { text } : {}),
    coding,
  };
}

function getObservationReferenceRange(
  detail: ResponseDetail
): ObservationReferenceRange[] | undefined {
  const low = parseFloat(detail.referenceRangeLow ?? "");
  const high = parseFloat(detail.referenceRangeHigh ?? "");
  const text = detail.referenceRangeAlpha;
  if (!Number.isFinite(low) && !Number.isFinite(high)) return undefined;

  return [
    {
      ...(text ? { text } : {}),
      ...(low ? { low: { value: low } } : {}),
      ...(high ? { high: { value: high } } : {}),
    },
  ];
}

function getObservationValue(detail: ResponseDetail): ObservationValue {
  const values: ObservationValue = {};
  if (detail.resultValue != null) {
    if (detail.resultUnits) {
      values.valueQuantity = {
        value: parseFloat(detail.resultValue),
        unit: detail.resultUnits,
      };
    } else {
      values.valueString = detail.resultValue;
    }
  }
  return values;
}

function getObservationInterpretation(detail: ResponseDetail): CodeableConcept[] | undefined {
  if (!detail.abnormalFlag) return undefined;

  const code = detail.abnormalFlag;
  const display = {
    A: "Abnormal",
    N: "Normal",
    H: "High",
    L: "Low",
  }[code];

  return [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          code,
          ...(display ? { display } : {}),
        },
      ],
    },
  ];
}
